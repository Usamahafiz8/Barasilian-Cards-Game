import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameMode, GameStatus, GameVariant, MoveType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EconomyService } from '../economy/economy.service';
import { StatsService } from '../stats/stats.service';
import { generateDeck, shuffle, Card, tossRankValue } from './buraco/deck';
import { validateMeld, canAddToMeld, canPickupDiscardPile, canPickupPot, hasBuraco, sortMeldCards, Meld } from './buraco/rules';
import { calculateScore, calculateMatchReward } from './buraco/scoring';
import { SocketService } from '../../common/socket/socket.service';

export type TurnPhase = 'MUST_DRAW' | 'CAN_MELD_OR_DISCARD' | 'ROUND_ENDED';

export interface TossEntry {
  playerId: string;
  seatIndex: number;
  card: Card;
  rankValue: number;
}

export interface TossRound {
  round: number;
  isTie: boolean;
  players: TossEntry[];
  winnerPlayerId?: string;
  winnerSeatIndex?: number;
  reason?: string;
}

export interface TossResult {
  rounds: TossRound[];
  winnerPlayerId: string;
  winnerSeatIndex: number;
  players: TossEntry[]; // final round entries
  reason: string;
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  variant: GameVariant;
  status: GameStatus;
  stockPile: Card[];
  discardPile: Card[];
  potPiles: Card[][];
  hands: Record<string, Card[]>;
  melds: Record<string, Meld[]>;
  teamMelds: Record<number, Meld[]>;
  players: Array<{ userId: string; teamId: number; isConnected: boolean }>;
  turnOrder: string[];
  currentTurnIndex: number;
  turnPhase: TurnPhase;
  gameStartedAt: number;
  turnStartedAt: number;
  turnDuration: number;
  round: number;
  scores: Record<number, number>;
  moveCount: number;
  potCollectedByTeam: number[];
  // ── Setup / toss ─────────────────────────────────────────
  seatMap: Record<string, number>;      // userId → stable seatIndex
  usernames: Record<string, string>;    // userId → username
  toss: TossResult | null;
  setupComplete: boolean;
  tossComplete: boolean;
}

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private economyService: EconomyService,
    private statsService: StatsService,
    private socketService: SocketService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async checkTurnTimeouts() {
    try {
      const keys = await this.redis.keys('game:*:state');
      await Promise.all(
        keys.map(async (key) => {
          const state = await this.redis.getJson<GameState>(key);
          if (!state || state.status !== GameStatus.IN_PROGRESS) return;
          if (Date.now() - state.turnStartedAt > state.turnDuration * 1000) {
            await this.handleTurnTimeout(state.gameId);
          }
        }),
      );
    } catch (err) {
      this.logger.error('checkTurnTimeouts error', err);
    }
  }

  stateKey(gameId: string) {
    return `game:${gameId}:state`;
  }

  async startGame(roomId: string, mode: GameMode, variant: GameVariant, playerIds: string[]): Promise<GameState> {
    const game = await this.prisma.gameSession.create({
      data: {
        roomId,
        mode,
        variant,
        status: GameStatus.IN_PROGRESS,
        startedAt: new Date(),
        winnerIds: [],
        players: {
          create: playerIds.map((userId, idx) => ({
            userId,
            teamId: variant === GameVariant.ONE_VS_ONE ? idx + 1 : idx % 2 === 0 ? 1 : 2,
          })),
        },
      },
      include: { players: true },
    });

    const dbPlayers = game.players;
    const dbUserIds = dbPlayers.map((p) => p.userId);

    // Fetch usernames in one query
    const users = await this.prisma.user.findMany({
      where: { id: { in: dbUserIds } },
      select: { id: true, username: true },
    });
    const usernames: Record<string, string> = {};
    for (const u of users) usernames[u.id] = u.username;

    // Stable seat indices — order from DB
    const seatMap: Record<string, number> = {};
    dbPlayers.forEach((p, i) => { seatMap[p.userId] = i; });

    // Run toss to determine who goes first
    const tossResult = this.runToss(dbUserIds, seatMap);

    // Deal cards
    const deck = shuffle(generateDeck(mode !== GameMode.PROFESSIONAL));
    const hands: Record<string, Card[]> = {};
    const potPiles: Card[][] = [[], []];

    let deckIdx = 0;
    for (const player of dbPlayers) {
      hands[player.userId] = deck.slice(deckIdx, deckIdx + 11);
      deckIdx += 11;
    }
    potPiles[0] = deck.slice(deckIdx, deckIdx + 11); deckIdx += 11;
    potPiles[1] = deck.slice(deckIdx, deckIdx + 11); deckIdx += 11;

    const stockPile = deck.slice(deckIdx);
    const topCard = stockPile.pop();
    const discardPile: Card[] = topCard ? [topCard] : [];

    // Turn order: clockwise from toss winner's seat
    const winnerSeat = seatMap[tossResult.winnerPlayerId] ?? 0;
    const turnOrder = [
      ...dbUserIds.slice(winnerSeat),
      ...dbUserIds.slice(0, winnerSeat),
    ];
    const players = dbPlayers.map((p) => ({ userId: p.userId, teamId: p.teamId, isConnected: true }));
    const now = Date.now();

    const state: GameState = {
      gameId: game.id,
      mode,
      variant,
      status: GameStatus.IN_PROGRESS,
      stockPile,
      discardPile,
      potPiles,
      hands,
      melds: Object.fromEntries(dbUserIds.map((id) => [id, []])),
      teamMelds: { 1: [], 2: [] },
      players,
      turnOrder,
      currentTurnIndex: 0,
      turnPhase: 'MUST_DRAW',
      gameStartedAt: now,
      turnStartedAt: now,
      turnDuration: 30,
      round: 1,
      scores: { 1: 0, 2: 0 },
      moveCount: 0,
      potCollectedByTeam: [],
      seatMap,
      usernames,
      toss: tossResult,
      setupComplete: true,
      tossComplete: true,
    };

    await this.redis.setJson(this.stateKey(game.id), state, 86400);
    return state;
  }

  async getGameState(gameId: string, requestingUserId: string) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state) throw new NotFoundException('Game state not found');
    return this.buildClientView(state, requestingUserId);
  }

  /**
   * Builds the per-player client view emitted by every game event.
   * Includes stable seatIndex, username, toss metadata, and setup flags.
   */
  private buildClientView(state: GameState, requestingUserId: string) {
    const currentPlayerId = state.turnOrder[state.currentTurnIndex] ?? '';
    const topDiscardCard = state.discardPile.length > 0
      ? state.discardPile[state.discardPile.length - 1]
      : null;

    const sortedPlayers = [...state.players].sort(
      (a, b) => (state.seatMap?.[a.userId] ?? 0) - (state.seatMap?.[b.userId] ?? 0),
    );

    // Aggregate per-player melds into team meld panels — computed fresh each view
    const teamMelds: Record<number, Meld[]> = {};
    for (const p of state.players) {
      if (!teamMelds[p.teamId]) teamMelds[p.teamId] = [];
      for (const m of state.melds[p.userId] || []) {
        teamMelds[p.teamId].push({ ...m, teamId: p.teamId });
      }
    }

    const requestingTeamId = state.players.find((p) => p.userId === requestingUserId)?.teamId;

    const players = sortedPlayers.map((p) => ({
      id: p.userId,
      userId: p.userId,
      username: state.usernames?.[p.userId] ?? '',
      teamId: p.teamId,
      isConnected: p.isConnected,
      seatIndex: state.seatMap?.[p.userId] ?? 0,
      handCount: (state.hands[p.userId] || []).length,
    }));

    return {
      gameId: state.gameId,
      mode: state.mode,
      variant: state.variant,
      status: state.status,
      currentPlayerId,
      turnPhase: state.turnPhase ?? 'MUST_DRAW',
      stockPileCount: state.stockPile.length,
      discardPile: state.discardPile,
      topDiscardCard,
      discardPileCount: state.discardPile.length,
      potPileCounts: state.potPiles.map((p) => p.length),
      players,
      myHand: state.hands[requestingUserId] || [],
      myMelds: requestingTeamId !== undefined ? (teamMelds[requestingTeamId] || []) : [],
      teamMelds,
      turnOrder: state.turnOrder,
      currentTurnIndex: state.currentTurnIndex,
      turnStartedAt: state.turnStartedAt,
      turnDuration: state.turnDuration,
      round: state.round,
      scores: state.scores,
      moveCount: state.moveCount,
      potCollectedByTeam: state.potCollectedByTeam ?? [],
      setupComplete: state.setupComplete ?? true,
      tossComplete: state.tossComplete ?? true,
      toss: state.toss ?? null,
    };
  }

  async processMove(gameId: string, playerId: string, move: { type: MoveType; cardIds?: string[]; meldId?: string; source?: 'STOCK' | 'DISCARD' }) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state) throw new NotFoundException('Game not found');
    if (state.status !== GameStatus.IN_PROGRESS) throw new BadRequestException('GAME_NOT_IN_PROGRESS');

    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    if (currentPlayer !== playerId) throw new BadRequestException('NOT_YOUR_TURN');

    const turnPhase: TurnPhase = state.turnPhase ?? 'MUST_DRAW';
    const hand = state.hands[playerId];
    let result: any = {};

    switch (move.type) {
      case MoveType.DRAW_STOCK: {
        if (turnPhase !== 'MUST_DRAW') throw new BadRequestException('WRONG_PHASE');
        if (state.stockPile.length === 0) {
          if (state.discardPile.length <= 1) throw new BadRequestException('EMPTY_STOCK');
          const top = state.discardPile.pop()!;
          state.stockPile = shuffle(state.discardPile);
          state.discardPile = [top];
        }
        const card = state.stockPile.pop()!;
        hand.push(card);
        state.turnPhase = 'CAN_MELD_OR_DISCARD';
        result = { card, handCount: hand.length, stockPileCount: state.stockPile.length };

        if (state.stockPile.length < 2) {
          await this.redis.setJson(this.stateKey(gameId), state, 86400);
          return this.finalizeGame(gameId, state);
        }
        break;
      }

      case MoveType.DRAW_DISCARD: {
        if (turnPhase !== 'MUST_DRAW') throw new BadRequestException('WRONG_PHASE');
        if (state.discardPile.length === 0) throw new BadRequestException('EMPTY_DISCARD');
        const topCard = state.discardPile[state.discardPile.length - 1];
        if (state.mode !== GameMode.CLASSIC && !canPickupDiscardPile(topCard, hand)) {
          throw new BadRequestException('Cannot pick up discard pile');
        }
        const takenCards = [...state.discardPile];
        hand.push(...takenCards);
        state.discardPile = [];
        state.turnPhase = 'CAN_MELD_OR_DISCARD';
        result = { takenCount: takenCards.length, handCount: hand.length };
        break;
      }

      case MoveType.PLAY_MELD: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        const cards = this.resolveCards(hand, move.cardIds || []);
        const validation = validateMeld(cards, state.mode as string);
        if (!validation.valid) throw new BadRequestException(validation.reason || 'INVALID_MELD');
        const meldType = validation.type!;
        const sortedCards = sortMeldCards(cards, meldType);
        const meldTeamId = state.players.find((p) => p.userId === playerId)?.teamId ?? 1;
        const newMeld: Meld = {
          id: uuidv4(),
          teamId: meldTeamId,
          type: meldType,
          cards: sortedCards,
          isNatural: sortedCards.every((c) => !c.isWild),
          isCanasta: sortedCards.length >= 7,
        };
        state.melds[playerId].push(newMeld);
        (move.cardIds ?? []).forEach((id) => { const idx = hand.findIndex((c) => c.id === id); if (idx !== -1) hand.splice(idx, 1); });
        result = { meld: newMeld, handCount: hand.length };
        if (hand.length === 0) {
          const potAward = this.tryAwardPot(state, playerId, 'PLAY_MELD');
          if (potAward) {
            result.potAwarded = potAward;
          } else {
            state.moveCount++;
            await this.redis.setJson(this.stateKey(gameId), state, 86400);
            await this.prisma.gameMove.create({
              data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: result, isValid: true },
            });
            return this.finalizeGame(gameId, state);
          }
        }
        break;
      }

      case MoveType.ADD_TO_MELD: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        const playerTeamId = state.players.find((p) => p.userId === playerId)?.teamId;
        const teamUserIds = state.players.filter((p) => p.teamId === playerTeamId).map((p) => p.userId);
        let meld: Meld | undefined;
        for (const uid of teamUserIds) {
          meld = state.melds[uid]?.find((m) => m.id === move.meldId);
          if (meld) break;
        }
        if (!meld) throw new NotFoundException('Meld not found');
        const cards = this.resolveCards(hand, move.cardIds || []);
        if (!canAddToMeld(meld, cards, state.mode as string)) throw new BadRequestException('Cannot add those cards to this meld');
        meld.cards.push(...cards);
        meld.cards = sortMeldCards(meld.cards, meld.type);
        meld.isCanasta = meld.cards.length >= 7;
        meld.isNatural = meld.cards.every((c) => !c.isWild);
        (move.cardIds ?? []).forEach((id) => { const idx = hand.findIndex((c) => c.id === id); if (idx !== -1) hand.splice(idx, 1); });
        result = { meld, handCount: hand.length };
        if (hand.length === 0) {
          const potAward = this.tryAwardPot(state, playerId, 'ADD_TO_MELD');
          if (potAward) {
            result.potAwarded = potAward;
          } else {
            state.moveCount++;
            await this.redis.setJson(this.stateKey(gameId), state, 86400);
            await this.prisma.gameMove.create({
              data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: result, isValid: true },
            });
            return this.finalizeGame(gameId, state);
          }
        }
        break;
      }

      case MoveType.DISCARD: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        const cardId = move.cardIds?.[0];
        if (!cardId) throw new BadRequestException('No card specified for discard');
        const idx = hand.findIndex((c) => c.id === cardId);
        if (idx === -1) throw new BadRequestException('Card not in hand');
        const [card] = hand.splice(idx, 1);

        if (hand.length === 0) {
          // Auto-award pot if eligible (tryAwardPot also advances the turn for DISCARD)
          const potAward = this.tryAwardPot(state, playerId, 'DISCARD');
          if (potAward) {
            state.discardPile.push(card);
            result = { discardedCard: card, handCount: hand.length, potAwarded: potAward };
            break;
          }

          // No pot to award — validate and attempt close
          if (state.mode === GameMode.CLASSIC && card.isWild) {
            hand.push(card);
            throw new BadRequestException('Cannot close the game by discarding a wild card (Joker or Pinella)');
          }

          const playerTeamId = state.players.find((p) => p.userId === playerId)?.teamId ?? 1;
          const teamPlayerIds = state.players.filter((p) => p.teamId === playerTeamId).map((p) => p.userId);
          const teamHasBuraco = teamPlayerIds.some((uid) => hasBuraco(state.melds[uid] || []));
          if (!teamHasBuraco) {
            hand.push(card);
            throw new BadRequestException('Your team must have at least one Buraco (7+ cards) to close the game');
          }

          if (!(state.potCollectedByTeam ?? []).includes(playerTeamId)) {
            hand.push(card);
            throw new BadRequestException('Your team must collect the pot before closing the game');
          }

          state.discardPile.push(card);
          return this.finalizeGame(gameId, state, playerTeamId);
        }

        state.discardPile.push(card);
        result = { discardedCard: card, handCount: hand.length };

        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
        state.turnStartedAt = Date.now();
        state.turnPhase = 'MUST_DRAW';
        break;
      }

      case MoveType.PICKUP_POT: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        if (!canPickupPot(hand)) throw new BadRequestException('Hand must be empty to pick up pot');

        const playerTeamId = state.players.find((p) => p.userId === playerId)?.teamId ?? 1;

        if ((state.potCollectedByTeam ?? []).includes(playerTeamId)) {
          throw new BadRequestException('Your team has already collected their pot this game');
        }

        if (state.mode === GameMode.PROFESSIONAL) {
          const teamPlayerIds = state.players.filter((p) => p.teamId === playerTeamId).map((p) => p.userId);
          const teamHasBuraco = teamPlayerIds.some((uid) => hasBuraco(state.melds[uid] || []));
          if (!teamHasBuraco) {
            throw new BadRequestException('Your team must have at least one Buraco before collecting the pot (Professional mode)');
          }
        }

        const pot = state.potPiles.find((p) => p.length > 0);
        if (!pot) throw new BadRequestException('No pot available');
        hand.push(...pot.splice(0, pot.length));

        if (!state.potCollectedByTeam) state.potCollectedByTeam = [];
        state.potCollectedByTeam.push(playerTeamId);

        result = { handCount: hand.length, potCollectedByTeam: state.potCollectedByTeam };
        break;
      }
    }

    state.moveCount++;
    await this.redis.setJson(this.stateKey(gameId), state, 86400);

    await this.prisma.gameMove.create({
      data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: result, isValid: true },
    });

    return {
      state: this.buildClientView(state, playerId),
      result,
      teamId: state.players.find((p) => p.userId === playerId)?.teamId,
      nextTurnPlayerId: state.turnOrder[state.currentTurnIndex],
    };
  }

  async finalizeGame(gameId: string, state?: GameState, closerTeamId?: number) {
    if (!state) state = (await this.redis.getJson<GameState>(this.stateKey(gameId))) ?? undefined;
    if (!state) throw new NotFoundException('Game not found');

    const teamScores: Record<number, number> = { 1: 0, 2: 0 };
    for (const player of state.players) {
      const score = calculateScore(state.melds[player.userId] || [], state.hands[player.userId] || [], state.mode);
      teamScores[player.teamId] = (teamScores[player.teamId] || 0) + score;
    }

    if (closerTeamId !== undefined) {
      teamScores[closerTeamId] = (teamScores[closerTeamId] || 0) + 100;
    }

    const collectedTeams = state.potCollectedByTeam ?? [];
    for (const teamId of [1, 2]) {
      if (!collectedTeams.includes(teamId)) {
        teamScores[teamId] = (teamScores[teamId] || 0) - 100;
      }
    }

    const winnerTeam = teamScores[1] >= teamScores[2] ? 1 : 2;
    const winnerIds = state.players.filter((p) => p.teamId === winnerTeam).map((p) => p.userId);
    const duration = Math.floor((Date.now() - state.gameStartedAt) / 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.gameSession.update({
        where: { id: gameId },
        data: { status: GameStatus.COMPLETED, endedAt: new Date(), winnerIds, winnerTeam, duration,
          players: { updateMany: state.players.map((p) => ({ where: { userId: p.userId }, data: { finalScore: teamScores[p.teamId], result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS' } })) },
        },
      });

      await tx.matchRecord.create({
        data: {
          gameId,
          mode: state.mode,
          variant: state.variant,
          winnerIds,
          winnerTeam,
          scores: teamScores,
          duration,
          players: { create: state.players.map((p) => ({ userId: p.userId, teamId: p.teamId, score: teamScores[p.teamId], result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS' })) },
        },
      });
    });

    await Promise.all(state.players.map(async (p) => {
      const isWinner = winnerIds.includes(p.userId);
      const score = teamScores[p.teamId];
      const reward = calculateMatchReward(score, isWinner);
      await this.statsService.updateAfterMatch(p.userId, isWinner ? 'WIN' : 'LOSS', reward.points, reward.xp);
      await this.economyService.distributeMatchReward(p.userId, gameId, reward.coins);
    }));

    await this.redis.del(this.stateKey(gameId));

    return { winnerTeam, winnerIds, scores: teamScores, duration };
  }

  async handleTurnTimeout(gameId: string) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state || state.status !== GameStatus.IN_PROGRESS) return;

    const playerId = state.turnOrder[state.currentTurnIndex];
    const hand = state.hands[playerId];

    if (hand.length > 0) {
      const [card] = hand.splice(0, 1);
      state.discardPile.push(card);
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      state.turnStartedAt = Date.now();
      state.turnPhase = 'MUST_DRAW';
      await this.redis.setJson(this.stateKey(gameId), state, 86400);

      await this.prisma.gameMove.create({
        data: { gameId, playerId, turnNumber: state.moveCount + 1, moveType: MoveType.DISCARD, cardData: { auto: true, card: card as any }, isValid: true },
      });

      const lastMove = { type: 'TIMEOUT_DISCARD', playerId, cardId: card.id };
      await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (userId) => ({
        lastMove,
        ...this.buildClientView(state, userId),
      }));

      return { playerId, autoAction: 'DISCARD', card };
    }
  }

  // ── Toss ───────────────────────────────────────────────────────────────────

  private runToss(playerIds: string[], seatMap: Record<string, number>): TossResult {
    // Separate toss deck — non-Joker cards only so every draw has a rank value
    let tossDeck = shuffle(generateDeck(false));
    const rounds: TossRound[] = [];
    let winnerPlayerId: string | null = null;
    let winnerSeatIndex = 0;
    let roundNum = 0;

    while (!winnerPlayerId) {
      roundNum++;
      const entries: TossEntry[] = [];

      for (const pid of playerIds) {
        let card = tossDeck.pop();
        while (!card || tossRankValue(card.rank) === 0) {
          if (tossDeck.length === 0) tossDeck = shuffle(generateDeck(false));
          card = tossDeck.pop();
        }
        entries.push({ playerId: pid, seatIndex: seatMap[pid], card, rankValue: tossRankValue(card.rank) });
      }

      const maxRank = Math.max(...entries.map((e) => e.rankValue));
      const winners = entries.filter((e) => e.rankValue === maxRank);
      const isTie = winners.length > 1;

      const round: TossRound = { round: roundNum, isTie, players: entries };
      if (!isTie) {
        round.winnerPlayerId = winners[0].playerId;
        round.winnerSeatIndex = winners[0].seatIndex;
        round.reason = 'HIGH_CARD';
        winnerPlayerId = winners[0].playerId;
        winnerSeatIndex = winners[0].seatIndex;
      }
      rounds.push(round);
    }

    const finalRound = rounds[rounds.length - 1];
    return {
      rounds,
      winnerPlayerId,
      winnerSeatIndex,
      players: [...finalRound.players].sort((a, b) => a.seatIndex - b.seatIndex),
      reason: 'HIGH_CARD',
    };
  }

  private tryAwardPot(
    state: GameState,
    playerId: string,
    moveType: 'PLAY_MELD' | 'ADD_TO_MELD' | 'DISCARD',
  ): { playerId: string; teamId: number; potIndex: number; cardCount: number; cardIds: string[] } | null {
    const hand = state.hands[playerId];
    if (hand.length !== 0) return null;

    const teamId = state.players.find((p) => p.userId === playerId)?.teamId ?? 1;
    if ((state.potCollectedByTeam ?? []).includes(teamId)) return null;

    const potIndex = state.potPiles.findIndex((p) => p.length > 0);
    if (potIndex === -1) return null;

    const potCards = [...state.potPiles[potIndex]];
    hand.push(...potCards);
    state.potPiles[potIndex] = [];
    if (!state.potCollectedByTeam) state.potCollectedByTeam = [];
    state.potCollectedByTeam.push(teamId);

    if (moveType === 'DISCARD') {
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      state.turnStartedAt = Date.now();
      state.turnPhase = 'MUST_DRAW';
    }
    // For PLAY_MELD / ADD_TO_MELD: keep currentTurnIndex and CAN_MELD_OR_DISCARD phase

    return { playerId, teamId, potIndex, cardCount: potCards.length, cardIds: potCards.map((c) => c.id) };
  }

  private resolveCards(hand: Card[], cardIds: string[]): Card[] {
    return cardIds.map((id) => {
      const card = hand.find((c) => c.id === id);
      if (!card) throw new BadRequestException(`Card ${id} not in hand`);
      return card;
    });
  }
}
