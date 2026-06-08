import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameMode, GameStatus, GameVariant, MoveType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EconomyService } from '../economy/economy.service';
import { StatsService } from '../stats/stats.service';
import { generateDeck, shuffle, Card, tossRankValue } from './buraco/deck';
import {
  validateMeld,
  canAddToMeld,
  canPickupDiscardPile,
  canPickupPot,
  hasBuraco,
  hasBuracoOfTwos,
  tryFindMergeTarget,
  sortMeldCards,
  computeMeldHasActingWild,
  Meld,
} from './buraco/rules';
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
  players: TossEntry[];
  reason: string;
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  variant: GameVariant;
  /** Professional Direct = hand empties on-the-fly to close; Indirect = must discard last card. */
  endMode: 'DIRECT' | 'INDIRECT';
  /** Professional MAKART: player with 1 card in hand cannot take discard when pile also has 1 card. */
  makart: boolean;
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
  /**
   * Array of team IDs that have collected a pot; duplicates allowed (team appearing twice = took 2 pots).
   * Classic: max 1 per team. Professional: max 2 per team.
   */
  potCollectedByTeam: number[];
  seatMap: Record<string, number>;
  usernames: Record<string, string>;
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

  async startGame(
    roomId: string,
    mode: GameMode,
    variant: GameVariant,
    playerIds: string[],
    endMode?: string | null,
    makart?: boolean,
  ): Promise<GameState> {
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
    const dbUserIds = dbPlayers.map(p => p.userId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: dbUserIds } },
      select: { id: true, username: true },
    });
    const usernames: Record<string, string> = {};
    for (const u of users) usernames[u.id] = u.username;

    const seatMap: Record<string, number> = {};
    dbPlayers.forEach((p, i) => { seatMap[p.userId] = i; });

    const tossResult = this.runToss(dbUserIds, seatMap);

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

    const winnerSeat = seatMap[tossResult.winnerPlayerId] ?? 0;
    const turnOrder = [...dbUserIds.slice(winnerSeat), ...dbUserIds.slice(0, winnerSeat)];
    const players = dbPlayers.map(p => ({ userId: p.userId, teamId: p.teamId, isConnected: true }));
    const now = Date.now();

    const resolvedEndMode: 'DIRECT' | 'INDIRECT' =
      (endMode === 'DIRECT' ? 'DIRECT' : 'INDIRECT');

    const state: GameState = {
      gameId: game.id,
      mode,
      variant,
      endMode: resolvedEndMode,
      makart: !!makart,
      status: GameStatus.IN_PROGRESS,
      stockPile,
      discardPile,
      potPiles,
      hands,
      melds: Object.fromEntries(dbUserIds.map(id => [id, []])),
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

  private buildClientView(state: GameState, requestingUserId: string) {
    const currentPlayerId = state.turnOrder[state.currentTurnIndex] ?? '';
    const topDiscardCard  = state.discardPile.length > 0
      ? state.discardPile[state.discardPile.length - 1]
      : null;

    const sortedPlayers = [...state.players].sort(
      (a, b) => (state.seatMap?.[a.userId] ?? 0) - (state.seatMap?.[b.userId] ?? 0),
    );

    const teamMelds: Record<number, Meld[]> = {};
    for (const p of state.players) {
      if (!teamMelds[p.teamId]) teamMelds[p.teamId] = [];
      for (const m of state.melds[p.userId] || []) {
        teamMelds[p.teamId].push({ ...m, teamId: p.teamId });
      }
    }

    const requestingTeamId = state.players.find(p => p.userId === requestingUserId)?.teamId;

    const players = sortedPlayers.map(p => ({
      id:          p.userId,
      userId:      p.userId,
      username:    state.usernames?.[p.userId] ?? '',
      teamId:      p.teamId,
      isConnected: p.isConnected,
      seatIndex:   state.seatMap?.[p.userId] ?? 0,
      handCount:   (state.hands[p.userId] || []).length,
    }));

    return {
      gameId:               state.gameId,
      mode:                 state.mode,
      variant:              state.variant,
      endMode:              state.endMode ?? 'INDIRECT',
      makart:               state.makart ?? false,
      status:               state.status,
      currentPlayerId,
      turnPhase:            state.turnPhase ?? 'MUST_DRAW',
      stockPileCount:       state.stockPile.length,
      discardPile:          state.discardPile,
      topDiscardCard,
      discardPileCount:     state.discardPile.length,
      potPileCounts:        state.potPiles.map(p => p.length),
      players,
      myHand:               state.hands[requestingUserId] || [],
      myMelds:              requestingTeamId !== undefined ? (teamMelds[requestingTeamId] || []) : [],
      teamMelds,
      turnOrder:            state.turnOrder,
      currentTurnIndex:     state.currentTurnIndex,
      turnStartedAt:        state.turnStartedAt,
      turnDuration:         state.turnDuration,
      round:                state.round,
      scores:               state.scores,
      moveCount:            state.moveCount,
      potCollectedByTeam:   state.potCollectedByTeam ?? [],
      setupComplete:        state.setupComplete ?? true,
      tossComplete:         state.tossComplete ?? true,
      toss:                 state.toss ?? null,
    };
  }

  async processMove(
    gameId: string,
    playerId: string,
    move: { type: MoveType; cardIds?: string[]; meldId?: string; source?: 'STOCK' | 'DISCARD' },
  ) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state) throw new NotFoundException('Game not found');
    if (state.status !== GameStatus.IN_PROGRESS) throw new BadRequestException('GAME_NOT_IN_PROGRESS');

    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    if (currentPlayer !== playerId) throw new BadRequestException('NOT_YOUR_TURN');

    const turnPhase: TurnPhase = state.turnPhase ?? 'MUST_DRAW';
    const hand = state.hands[playerId];
    const playerTeamId = state.players.find(p => p.userId === playerId)?.teamId ?? 1;
    const teamPlayerIds = state.players.filter(p => p.teamId === playerTeamId).map(p => p.userId);
    let result: any = {};

    switch (move.type) {

      // ────────────────────────────────────────────────────────────────────────
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

        // Classic: ≤ 2 cards remaining (DeckStopClassic = 2); Professional: 0 cards remaining
        const stockLow = state.mode === GameMode.CLASSIC
          ? state.stockPile.length <= 2
          : state.stockPile.length === 0;
        if (stockLow) {
          await this.redis.setJson(this.stateKey(gameId), state, 86400);
          return this.finalizeGame(gameId, state);
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case MoveType.DRAW_DISCARD: {
        if (turnPhase !== 'MUST_DRAW') throw new BadRequestException('WRONG_PHASE');
        if (state.discardPile.length === 0) throw new BadRequestException('EMPTY_DISCARD');

        // MAKART option (Professional): player with 1 card cannot take discard when pile has 1 card
        if (state.makart && hand.length === 1 && state.discardPile.length === 1) {
          throw new BadRequestException('MAKART: must draw from stock when both hand and discard have 1 card');
        }

        const takenCards = [...state.discardPile];
        hand.push(...takenCards);
        state.discardPile = [];
        state.turnPhase = 'CAN_MELD_OR_DISCARD';
        result = { takenCount: takenCards.length, takenCardIds: takenCards.map(c => c.id), handCount: hand.length };
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case MoveType.PLAY_MELD: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        const cards = this.resolveCards(hand, move.cardIds || []);
        const validation = validateMeld(cards, state.mode as string);
        if (!validation.valid) throw new BadRequestException(validation.reason || 'INVALID_MELD');
        const meldType = validation.type!;

        // ── Lookahead: find merge target early (needed for Buraco-exception guard) ─
        const handAfterMeld = hand.filter(c => !cards.some(mc => mc.id === c.id));
        const allTeamMelds = teamPlayerIds.flatMap(uid => state.melds[uid] || []);
        const mergeTarget = tryFindMergeTarget(cards, meldType, allTeamMelds, state.mode as string);
        // True when this play itself reaches 7+ cards (guards are relaxed when a Buraco is formed)
        const thisMeldCreatesCanasta =
          cards.length >= 7 ||
          (mergeTarget !== null && mergeTarget.cards.length + cards.length >= 7);

        // ── Pre-meld Classic / Professional Direct checks ──────────────────────
        if (state.mode === GameMode.CLASSIC) {
          // Classic always requires at least 1 card in hand to discard — no exceptions.
          if (handAfterMeld.length === 0) {
            const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;
            const potAvailable = teamPotCount < 1 && state.potPiles.some(p => p.length > 0);
            if (!potAvailable) {
              throw new BadRequestException(
                'Classic: cannot meld all cards — must leave at least one card to discard',
              );
            }
          }
          // Cannot leave a lone wild as last card — unless this play itself creates a Buraco
          if (handAfterMeld.length === 1 && handAfterMeld[0].isWild && !thisMeldCreatesCanasta) {
            throw new BadRequestException(
              'Classic: cannot leave a lone Joker or 2 as your last card',
            );
          }
        }

        if (state.mode === GameMode.PROFESSIONAL && state.endMode === 'DIRECT') {
          const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;
          // Include this meld's contribution to Buraco detection
          const teamHasBuraco =
            teamPlayerIds.some(uid => hasBuraco(state.melds[uid] || [])) || thisMeldCreatesCanasta;
          const potAvailable = state.potPiles.some(p => p.length > 0) && teamPotCount < 2;

          if (handAfterMeld.length === 0) {
            if (potAvailable) {
              // Will take a pot — first pot requires a Buraco
              if (teamPotCount === 0 && !teamHasBuraco) {
                throw new BadRequestException(
                  'Professional Direct: must have a Buraco before collecting the first pot on-the-fly',
                );
              }
            } else {
              // No pot → this is a close attempt; must have Buraco + both pots
              if (!teamHasBuraco) {
                throw new BadRequestException(
                  'Professional Direct: must have a Buraco before closing on-the-fly',
                );
              }
              if (teamPotCount < 2) {
                throw new BadRequestException(
                  'Professional Direct: must have collected both pots before closing on-the-fly',
                );
              }
            }
          }

          // Never leave exactly 1 card that cannot be played on the fly
          if (handAfterMeld.length === 1) {
            const singleCard = handAfterMeld[0];
            const prospectiveMeld: Meld = mergeTarget
              ? { ...mergeTarget, cards: [...mergeTarget.cards, ...cards] }
              : {
                  id: 'tmp', teamId: playerTeamId, type: meldType, cards,
                  isNatural: !cards.some(c => c.isWild), isCanasta: cards.length >= 7,
                };
            const meldsAfterPlay = mergeTarget
              ? allTeamMelds.map(m => m.id === mergeTarget.id ? prospectiveMeld : m)
              : [...allTeamMelds, prospectiveMeld];
            if (!meldsAfterPlay.some(m => canAddToMeld(m, [singleCard], state.mode as string))) {
              throw new BadRequestException(
                'Professional Direct: this play would leave a card you cannot finish on the fly',
              );
            }
          }
        }

        // ── Remove cards from hand ─────────────────────────────────────────────
        const sortedCards = sortMeldCards(cards, meldType);
        ;(move.cardIds ?? []).forEach(id => {
          const idx = hand.findIndex(c => c.id === id);
          if (idx !== -1) hand.splice(idx, 1);
        });

        if (mergeTarget) {
          mergeTarget.cards = sortMeldCards([...mergeTarget.cards, ...sortedCards], meldType);
          mergeTarget.isCanasta = mergeTarget.cards.length >= 7;
          mergeTarget.isNatural = mergeTarget.cards.every(c => !c.isWild);
          const nowDirty = computeMeldHasActingWild(mergeTarget.cards, meldType);
          mergeTarget.everDirty = state.mode === GameMode.PROFESSIONAL
            ? (mergeTarget.everDirty || nowDirty)
            : nowDirty;
          result = { meld: mergeTarget, merged: true, handCount: hand.length };
        } else {
          const isDirty = computeMeldHasActingWild(sortedCards, meldType);
          const newMeld: Meld = {
            id:        uuidv4(),
            teamId:    playerTeamId,
            type:      meldType,
            cards:     sortedCards,
            isNatural: sortedCards.every(c => !c.isWild),
            isCanasta: sortedCards.length >= 7,
            everDirty: isDirty,
          };
          state.melds[playerId].push(newMeld);
          result = { meld: newMeld, merged: false, handCount: hand.length };
        }

        // ── Professional: Buraco of 2 instant win ───────────────────────────
        if (state.mode === GameMode.PROFESSIONAL) {
          const allMelds = Object.values(state.melds).flat();
          if (hasBuracoOfTwos(allMelds)) {
            state.moveCount++;
            await this.redis.setJson(this.stateKey(gameId), state, 86400);
            await this.prisma.gameMove.create({
              data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: { ...result, buracoOfTwos: true }, isValid: true },
            });
            const finalResult = await this.finalizeGame(gameId, state, playerTeamId);
            this.socketService.emitToRoom(`game:${gameId}`, 'game:end', { gameId, buracoOfTwos: true, ...finalResult });
            return { state: this.buildClientView(state, playerId), result, ...finalResult };
          }
        }

        // ── Hand empty → try pot or close ────────────────────────────────────
        if (hand.length === 0) {
          const potAward = this.tryAwardPot(state, playerId, 'PLAY_MELD');
          if (potAward) {
            result.potAwarded = potAward;
          } else if (state.mode === GameMode.PROFESSIONAL && state.endMode === 'DIRECT') {
            // Close on-the-fly in Professional Direct (close conditions already validated above)
            state.moveCount++;
            await this.redis.setJson(this.stateKey(gameId), state, 86400);
            await this.prisma.gameMove.create({
              data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: result, isValid: true },
            });
            return this.finalizeGame(gameId, state, playerTeamId);
          } else {
            // Classic: already blocked above. Professional Indirect or edge: finalize without close bonus.
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

      // ────────────────────────────────────────────────────────────────────────
      case MoveType.ADD_TO_MELD: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        let meld: Meld | undefined;
        for (const uid of teamPlayerIds) {
          meld = state.melds[uid]?.find(m => m.id === move.meldId);
          if (meld) break;
        }
        if (!meld) throw new NotFoundException('Meld not found');
        const cards = this.resolveCards(hand, move.cardIds || []);
        if (!canAddToMeld(meld, cards, state.mode as string)) {
          throw new BadRequestException('Cannot add those cards to this meld');
        }

        // ── Pre-add Classic / Professional Direct checks ─────────────────────
        const handAfterAdd = hand.filter(c => !cards.some(mc => mc.id === c.id));
        const addCreatesCanasta = meld.cards.length + cards.length >= 7;

        if (state.mode === GameMode.CLASSIC) {
          // Classic always requires ≥1 card in hand — no exceptions
          if (handAfterAdd.length === 0) {
            const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;
            const potAvailable = teamPotCount < 1 && state.potPiles.some(p => p.length > 0);
            if (!potAvailable) {
              throw new BadRequestException(
                'Classic: cannot play all cards — must leave at least one card to discard',
              );
            }
          }
          // Cannot leave lone wild unless this add itself creates a Buraco
          if (handAfterAdd.length === 1 && handAfterAdd[0].isWild && !addCreatesCanasta) {
            throw new BadRequestException(
              'Classic: cannot leave a lone Joker or 2 as your last card',
            );
          }
        }

        if (state.mode === GameMode.PROFESSIONAL && state.endMode === 'DIRECT') {
          const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;
          const teamHasBuraco =
            teamPlayerIds.some(uid => hasBuraco(state.melds[uid] || [])) || addCreatesCanasta;
          const potAvailable = state.potPiles.some(p => p.length > 0) && teamPotCount < 2;

          if (handAfterAdd.length === 0) {
            if (potAvailable) {
              if (teamPotCount === 0 && !teamHasBuraco) {
                throw new BadRequestException(
                  'Professional Direct: must have a Buraco before collecting the first pot on-the-fly',
                );
              }
            } else {
              if (!teamHasBuraco) {
                throw new BadRequestException(
                  'Professional Direct: must have a Buraco before closing on-the-fly',
                );
              }
              if (teamPotCount < 2) {
                throw new BadRequestException(
                  'Professional Direct: must have collected both pots before closing on-the-fly',
                );
              }
            }
          }

          // Never leave exactly 1 card that cannot be played on the fly
          if (handAfterAdd.length === 1) {
            const singleCard = handAfterAdd[0];
            const updatedMeld: Meld = { ...meld, cards: [...meld.cards, ...cards] };
            const teamMeldsAfterAdd = teamPlayerIds
              .flatMap(uid => state.melds[uid] || [])
              .map(m => (m.id === meld.id ? updatedMeld : m));
            if (!teamMeldsAfterAdd.some(m => canAddToMeld(m, [singleCard], state.mode as string))) {
              throw new BadRequestException(
                'Professional Direct: this play would leave a card you cannot finish on the fly',
              );
            }
          }
        }

        // ── Apply add ────────────────────────────────────────────────────────
        meld.cards.push(...cards);
        meld.cards     = sortMeldCards(meld.cards, meld.type);
        meld.isCanasta = meld.cards.length >= 7;
        meld.isNatural = meld.cards.every(c => !c.isWild);
        const nowDirty = computeMeldHasActingWild(meld.cards, meld.type);
        meld.everDirty = state.mode === GameMode.PROFESSIONAL
          ? (meld.everDirty || nowDirty)
          : nowDirty;
        ;(move.cardIds ?? []).forEach(id => {
          const idx = hand.findIndex(c => c.id === id);
          if (idx !== -1) hand.splice(idx, 1);
        });
        result = { meld, handCount: hand.length };

        // ── Professional: Buraco of 2 instant win ───────────────────────────
        if (state.mode === GameMode.PROFESSIONAL) {
          const allMelds = Object.values(state.melds).flat();
          if (hasBuracoOfTwos(allMelds)) {
            state.moveCount++;
            await this.redis.setJson(this.stateKey(gameId), state, 86400);
            await this.prisma.gameMove.create({
              data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: { ...result, buracoOfTwos: true }, isValid: true },
            });
            const finalResult = await this.finalizeGame(gameId, state, playerTeamId);
            this.socketService.emitToRoom(`game:${gameId}`, 'game:end', { gameId, buracoOfTwos: true, ...finalResult });
            return { state: this.buildClientView(state, playerId), result, ...finalResult };
          }
        }

        // ── Hand empty → try pot or close ────────────────────────────────────
        if (hand.length === 0) {
          const potAward = this.tryAwardPot(state, playerId, 'ADD_TO_MELD');
          if (potAward) {
            result.potAwarded = potAward;
          } else if (state.mode === GameMode.PROFESSIONAL && state.endMode === 'DIRECT') {
            state.moveCount++;
            await this.redis.setJson(this.stateKey(gameId), state, 86400);
            await this.prisma.gameMove.create({
              data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: result, isValid: true },
            });
            return this.finalizeGame(gameId, state, playerTeamId);
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

      // ────────────────────────────────────────────────────────────────────────
      case MoveType.DISCARD: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        const cardId = move.cardIds?.[0];
        if (!cardId) throw new BadRequestException('No card specified for discard');
        const idx = hand.findIndex(c => c.id === cardId);
        if (idx === -1) throw new BadRequestException('Card not in hand');
        const [card] = hand.splice(idx, 1);

        // Professional Direct: finishing by discard is never allowed — must empty hand on the fly
        if (state.mode === GameMode.PROFESSIONAL && state.endMode === 'DIRECT' && hand.length === 0) {
          hand.push(card);
          throw new BadRequestException(
            'Professional Direct: you cannot discard your last card. You must finish on the fly.',
          );
        }

        if (hand.length === 0) {
          // Auto-award pot first (tryAwardPot also advances the turn for DISCARD)
          const potAward = this.tryAwardPot(state, playerId, 'DISCARD');
          if (potAward) {
            state.discardPile.push(card);
            result = { discardedCard: card, handCount: hand.length, potAwarded: potAward };
            break;
          }

          // No pot — validate close
          if (state.mode === GameMode.CLASSIC && card.isWild) {
            hand.push(card);
            throw new BadRequestException('Classic: cannot close the game by discarding a wild card');
          }

          const teamHasBuraco = teamPlayerIds.some(uid => hasBuraco(state.melds[uid] || []));
          if (!teamHasBuraco) {
            hand.push(card);
            throw new BadRequestException('Your team must have at least one Buraco (7+ cards) to close the game');
          }

          const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;
          const requiredPots = state.mode === GameMode.PROFESSIONAL ? 2 : 1;
          if (teamPotCount < requiredPots) {
            hand.push(card);
            throw new BadRequestException(
              state.mode === GameMode.PROFESSIONAL
                ? 'Professional: must collect both pots before closing the game'
                : 'Your team must collect the pot before closing the game',
            );
          }

          state.discardPile.push(card);
          return this.finalizeGame(gameId, state, playerTeamId);
        }

        state.discardPile.push(card);
        result = { discardedCard: card, handCount: hand.length };
        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
        state.turnStartedAt    = Date.now();
        state.turnPhase        = 'MUST_DRAW';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case MoveType.PICKUP_POT: {
        if (turnPhase !== 'CAN_MELD_OR_DISCARD') throw new BadRequestException('WRONG_PHASE');
        if (!canPickupPot(hand)) throw new BadRequestException('Hand must be empty to pick up pot');

        const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;

        const isClassic      = state.mode === GameMode.CLASSIC;
        const maxPots        = isClassic ? 1 : 2;
        if (teamPotCount >= maxPots) {
          throw new BadRequestException(
            isClassic
              ? 'Classic: your team has already collected their pot'
              : 'Your team has already collected both pots',
          );
        }

        // Professional: must have Buraco before taking first pot
        if (state.mode === GameMode.PROFESSIONAL && teamPotCount === 0) {
          const teamHasBuraco = teamPlayerIds.some(uid => hasBuraco(state.melds[uid] || []));
          if (!teamHasBuraco) {
            throw new BadRequestException(
              'Professional: must have at least one Buraco before collecting the pot',
            );
          }
        }

        // Second pot (and Professional Direct first pot): only on-the-fly (hand empty via meld, not manual PICKUP_POT)
        // PICKUP_POT is the manual command — block second pot here
        if (teamPotCount >= 1) {
          throw new BadRequestException(
            'Second pot can only be taken on-the-fly (by melding all cards, not manually)',
          );
        }

        const pot = state.potPiles.find(p => p.length > 0);
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
      state:            this.buildClientView(state, playerId),
      result,
      teamId:           state.players.find(p => p.userId === playerId)?.teamId,
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

    const winnerTeam  = teamScores[1] >= teamScores[2] ? 1 : 2;
    const winnerIds   = state.players.filter(p => p.teamId === winnerTeam).map(p => p.userId);
    const duration    = Math.floor((Date.now() - state.gameStartedAt) / 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.COMPLETED,
          endedAt: new Date(),
          winnerIds,
          winnerTeam,
          duration,
          players: {
            updateMany: state.players.map(p => ({
              where: { userId: p.userId },
              data: { finalScore: teamScores[p.teamId], result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS' },
            })),
          },
        },
      });

      await tx.matchRecord.create({
        data: {
          gameId,
          mode:      state.mode,
          variant:   state.variant,
          winnerIds,
          winnerTeam,
          scores:    teamScores,
          duration,
          players: {
            create: state.players.map(p => ({
              userId: p.userId,
              teamId: p.teamId,
              score:  teamScores[p.teamId],
              result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS',
            })),
          },
        },
      });
    });

    await Promise.all(state.players.map(async (p) => {
      const isWinner = winnerIds.includes(p.userId);
      const score    = teamScores[p.teamId];
      const reward   = calculateMatchReward(score, isWinner);
      await this.statsService.updateAfterMatch(p.userId, isWinner ? 'WIN' : 'LOSS', reward.points, reward.xp);
      await this.economyService.distributeMatchReward(p.userId, gameId, reward.coins);
    }));

    await this.redis.del(this.stateKey(gameId));

    return { winnerTeam, winnerIds, scores: teamScores, duration };
  }

  async abandonGame(
    gameId: string,
    abandoningUserId: string,
  ): Promise<{ winnerTeam: number; winnerIds: string[]; scores: Record<number, number>; duration: number } | null> {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state || state.status !== GameStatus.IN_PROGRESS) return null;
    if (state.variant !== GameVariant.ONE_VS_ONE) return null;

    const abandoner = state.players.find(p => p.userId === abandoningUserId);
    if (!abandoner) return null;

    const winnerTeam = abandoner.teamId === 1 ? 2 : 1;
    const winnerIds  = state.players.filter(p => p.teamId === winnerTeam).map(p => p.userId);
    const duration   = Math.floor((Date.now() - state.gameStartedAt) / 1000);
    const scores: Record<number, number> = { 1: 0, 2: 0 };

    await this.prisma.$transaction(async (tx) => {
      await tx.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.COMPLETED,
          endedAt: new Date(),
          winnerIds,
          winnerTeam,
          duration,
          players: {
            updateMany: state.players.map(p => ({
              where: { userId: p.userId },
              data: { result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS' },
            })),
          },
        },
      });
      await tx.matchRecord.create({
        data: {
          gameId,
          mode:    state.mode,
          variant: state.variant,
          winnerIds,
          winnerTeam,
          scores,
          duration,
          players: {
            create: state.players.map(p => ({
              userId: p.userId,
              teamId: p.teamId,
              score:  0,
              result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS',
            })),
          },
        },
      });
    });

    await Promise.all(
      state.players.map(async (p) => {
        const isWinner = winnerIds.includes(p.userId);
        const reward   = calculateMatchReward(0, isWinner);
        await this.statsService.updateAfterMatch(p.userId, isWinner ? 'WIN' : 'LOSS', reward.points, reward.xp);
        await this.economyService.distributeMatchReward(p.userId, gameId, reward.coins);
      }),
    );

    await this.redis.del(this.stateKey(gameId));
    return { winnerTeam, winnerIds, scores, duration };
  }

  async resignGame(
    gameId: string,
    resigningUserId: string,
  ): Promise<{ winnerTeam: number; winnerIds: string[]; scores: Record<number, number>; duration: number } | null> {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state || state.status !== GameStatus.IN_PROGRESS) return null;

    const resigner = state.players.find(p => p.userId === resigningUserId);
    if (!resigner) return null;

    const winnerTeam = resigner.teamId === 1 ? 2 : 1;
    const winnerIds  = state.players.filter(p => p.teamId === winnerTeam).map(p => p.userId);
    const duration   = Math.floor((Date.now() - state.gameStartedAt) / 1000);
    const scores: Record<number, number> = { 1: 0, 2: 0 };

    await this.prisma.$transaction(async (tx) => {
      await tx.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.COMPLETED,
          endedAt: new Date(),
          winnerIds,
          winnerTeam,
          duration,
          players: {
            updateMany: state.players.map(p => ({
              where: { userId: p.userId },
              data: { result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS' },
            })),
          },
        },
      });
      await tx.matchRecord.create({
        data: {
          gameId,
          mode:    state.mode,
          variant: state.variant,
          winnerIds,
          winnerTeam,
          scores,
          duration,
          players: {
            create: state.players.map(p => ({
              userId: p.userId,
              teamId: p.teamId,
              score:  0,
              result: winnerIds.includes(p.userId) ? 'WIN' : 'LOSS',
            })),
          },
        },
      });
    });

    await Promise.all(
      state.players.map(async (p) => {
        const isWinner = winnerIds.includes(p.userId);
        const reward   = calculateMatchReward(0, isWinner);
        await this.statsService.updateAfterMatch(p.userId, isWinner ? 'WIN' : 'LOSS', reward.points, reward.xp);
        await this.economyService.distributeMatchReward(p.userId, gameId, reward.coins);
      }),
    );

    await this.redis.del(this.stateKey(gameId));
    return { winnerTeam, winnerIds, scores, duration };
  }

  async getGameResult(gameId: string) {
    const record = await this.prisma.matchRecord.findUnique({
      where: { gameId },
      include: {
        players: {
          include: { user: { select: { username: true, avatarUrl: true } } },
        },
      },
    });
    if (!record) throw new NotFoundException('Game result not found');
    return record;
  }

  async handleTurnTimeout(gameId: string) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state || state.status !== GameStatus.IN_PROGRESS) return;
    if (state.turnPhase === 'ROUND_ENDED') return;

    const playerId = state.turnOrder[state.currentTurnIndex];
    const hand     = state.hands[playerId];

    let drawnCard: Card | undefined;
    if (state.turnPhase === 'MUST_DRAW') {
      if (state.stockPile.length === 0 && state.discardPile.length > 1) {
        const top = state.discardPile.pop()!;
        state.stockPile = shuffle(state.discardPile);
        state.discardPile = [top];
      }
      if (state.stockPile.length > 0) {
        drawnCard = state.stockPile.pop()!;
        hand.push(drawnCard);
        state.turnPhase = 'CAN_MELD_OR_DISCARD';

        const stockLow = state.mode === GameMode.CLASSIC
          ? state.stockPile.length <= 2
          : state.stockPile.length === 0;
        if (stockLow) {
          state.moveCount++;
          await this.redis.setJson(this.stateKey(gameId), state, 86400);
          await this.prisma.gameMove.create({
            data: { gameId, playerId, turnNumber: state.moveCount, moveType: MoveType.DRAW_STOCK, cardData: { auto: true, card: drawnCard as any }, isValid: true },
          });
          const drawMove = { type: 'TIMEOUT_DRAW', playerId, cardId: drawnCard.id };
          this.socketService.emitToRoom(`game:${gameId}`, 'game:move_played', drawMove);
          await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (uid) => ({
            lastMove: drawMove,
            ...this.buildClientView(state, uid),
          }));
          const finalResult = await this.finalizeGame(gameId, state);
          this.socketService.emitToRoom(`game:${gameId}`, 'game:end', { gameId, ...finalResult });
          return { playerId, autoAction: 'DRAW_THEN_FINALIZE', card: drawnCard };
        }
      }
    }

    const discardIdx = this.pickLegalDiscardIndex(state, playerId, hand);

    if (drawnCard) {
      const drawMove = { type: 'TIMEOUT_DRAW', playerId, cardId: drawnCard.id };
      this.socketService.emitToRoom(`game:${gameId}`, 'game:move_played', drawMove);
      await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (uid) => ({
        lastMove: drawMove,
        ...this.buildClientView(state, uid),
      }));
    }

    if (discardIdx === -1 || hand.length === 0) {
      this.logger.warn(`Timeout: no legal discard for ${playerId} (hand=${hand.length}), advancing turn`);
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      state.turnStartedAt    = Date.now();
      state.turnPhase        = 'MUST_DRAW';
      await this.redis.setJson(this.stateKey(gameId), state, 86400);
      if (!drawnCard) {
        await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (uid) => ({
          lastMove: { type: 'TIMEOUT_ADVANCE', playerId },
          ...this.buildClientView(state, uid),
        }));
      }
      return { playerId, autoAction: 'ADVANCE_NO_DISCARD' };
    }

    const [discardedCard] = hand.splice(discardIdx, 1);
    state.discardPile.push(discardedCard);

    if (hand.length === 0) {
      const potAward = this.tryAwardPot(state, playerId, 'DISCARD');
      if (potAward) {
        state.moveCount++;
        await this.redis.setJson(this.stateKey(gameId), state, 86400);
        await this.prisma.gameMove.create({
          data: { gameId, playerId, turnNumber: state.moveCount, moveType: MoveType.DISCARD, cardData: { auto: true, card: discardedCard as any, potAwarded: potAward }, isValid: true },
        });
        const discardMove = { type: 'TIMEOUT_DISCARD', playerId, cardId: discardedCard.id, potAwarded: potAward };
        this.socketService.emitToRoom(`game:${gameId}`, 'game:move_played', discardMove);
        await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (uid) => ({
          lastMove: discardMove,
          ...this.buildClientView(state, uid),
        }));
        return { playerId, autoAction: drawnCard ? 'DRAW_THEN_DISCARD' : 'DISCARD', card: discardedCard };
      }

      const playerTeamId = state.players.find(p => p.userId === playerId)?.teamId ?? 1;
      state.moveCount++;
      await this.redis.setJson(this.stateKey(gameId), state, 86400);
      await this.prisma.gameMove.create({
        data: { gameId, playerId, turnNumber: state.moveCount, moveType: MoveType.DISCARD, cardData: { auto: true, card: discardedCard as any }, isValid: true },
      });
      const discardMove = { type: 'TIMEOUT_DISCARD', playerId, cardId: discardedCard.id };
      this.socketService.emitToRoom(`game:${gameId}`, 'game:move_played', discardMove);
      await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (uid) => ({
        lastMove: discardMove,
        ...this.buildClientView(state, uid),
      }));
      const finalResult = await this.finalizeGame(gameId, state, playerTeamId);
      this.socketService.emitToRoom(`game:${gameId}`, 'game:end', { gameId, ...finalResult });
      return { playerId, autoAction: drawnCard ? 'DRAW_THEN_DISCARD' : 'DISCARD', card: discardedCard };
    }

    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
    state.turnStartedAt    = Date.now();
    state.turnPhase        = 'MUST_DRAW';
    state.moveCount++;
    await this.redis.setJson(this.stateKey(gameId), state, 86400);
    await this.prisma.gameMove.create({
      data: { gameId, playerId, turnNumber: state.moveCount, moveType: MoveType.DISCARD, cardData: { auto: true, card: discardedCard as any }, isValid: true },
    });

    const discardMove = { type: 'TIMEOUT_DISCARD', playerId, cardId: discardedCard.id };
    this.socketService.emitToRoom(`game:${gameId}`, 'game:move_played', discardMove);
    await this.socketService.emitPerPlayer(`game:${gameId}`, 'game:state_updated', async (uid) => ({
      lastMove: discardMove,
      ...this.buildClientView(state, uid),
    }));

    return { playerId, autoAction: drawnCard ? 'DRAW_THEN_DISCARD' : 'DISCARD', card: discardedCard };
  }

  private pickLegalDiscardIndex(state: GameState, playerId: string, hand: Card[]): number {
    if (hand.length === 0) return -1;

    if (hand.length > 1) return Math.floor(Math.random() * hand.length);

    // hand.length === 1 — discarding it would attempt to close; validate conditions
    const playerTeamId = state.players.find(p => p.userId === playerId)?.teamId ?? 1;
    const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === playerTeamId).length;
    const hasPotToAward = teamPotCount < (state.mode === GameMode.CLASSIC ? 1 : 2)
      && state.potPiles.some(p => p.length > 0);
    if (hasPotToAward) return 0;

    const card = hand[0];
    if (state.mode === GameMode.CLASSIC && card.isWild) return -1;

    const teamPlayerIds = state.players.filter(p => p.teamId === playerTeamId).map(p => p.userId);
    const teamHasBuraco = teamPlayerIds.some(uid => hasBuraco(state.melds[uid] || []));
    if (!teamHasBuraco) return -1;
    if (teamPotCount === 0) return -1;

    return 0;
  }

  // ── Toss ───────────────────────────────────────────────────────────────────

  private runToss(playerIds: string[], seatMap: Record<string, number>): TossResult {
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

      const maxRank = Math.max(...entries.map(e => e.rankValue));
      const winners = entries.filter(e => e.rankValue === maxRank);
      const isTie   = winners.length > 1;

      const round: TossRound = { round: roundNum, isTie, players: entries };
      if (!isTie) {
        round.winnerPlayerId  = winners[0].playerId;
        round.winnerSeatIndex = winners[0].seatIndex;
        round.reason          = 'HIGH_CARD';
        winnerPlayerId  = winners[0].playerId;
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

  /**
   * Awards a pot to the player whose hand just became empty.
   *
   * Classic:
   *   - Max 1 pot per team.
   *   - DISCARD path: pot taken, turn ends (advance turn).
   *   - PLAY_MELD / ADD_TO_MELD path: pot taken, turn continues (same phase).
   *
   * Professional:
   *   - Max 2 pots per team.
   *   - Must have at least 1 Buraco before taking the FIRST pot.
   *   - Direct mode: first pot only on-the-fly (PLAY_MELD / ADD_TO_MELD), not DISCARD.
   *   - Second pot: only on-the-fly (PLAY_MELD / ADD_TO_MELD), not DISCARD.
   */
  private tryAwardPot(
    state: GameState,
    playerId: string,
    moveType: 'PLAY_MELD' | 'ADD_TO_MELD' | 'DISCARD',
  ): { playerId: string; teamId: number; potIndex: number; cardCount: number; cardIds: string[] } | null {
    const hand = state.hands[playerId];
    if (hand.length !== 0) return null;

    const teamId      = state.players.find(p => p.userId === playerId)?.teamId ?? 1;
    const teamPotCount = (state.potCollectedByTeam ?? []).filter(id => id === teamId).length;
    const isClassic    = state.mode === GameMode.CLASSIC;
    const maxPots      = isClassic ? 1 : 2;
    if (teamPotCount >= maxPots) return null;

    const isSecondPot = teamPotCount >= 1;

    // Second pot: only on-the-fly
    if (isSecondPot && moveType === 'DISCARD') return null;

    // Professional restrictions
    if (!isClassic) {
      const teamPlayerIds = state.players.filter(p => p.teamId === teamId).map(p => p.userId);
      const teamHasBuraco = teamPlayerIds.some(uid => hasBuraco(state.melds[uid] || []));

      // Must have Buraco before first pot
      if (!isSecondPot && !teamHasBuraco) return null;

      // Direct mode: first pot only on-the-fly
      if (!isSecondPot && state.endMode === 'DIRECT' && moveType === 'DISCARD') return null;
    }

    const potIndex = state.potPiles.findIndex(p => p.length > 0);
    if (potIndex === -1) return null;

    const potCards = [...state.potPiles[potIndex]];
    hand.push(...potCards);
    state.potPiles[potIndex] = [];
    if (!state.potCollectedByTeam) state.potCollectedByTeam = [];
    state.potCollectedByTeam.push(teamId);

    if (moveType === 'DISCARD') {
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      state.turnStartedAt    = Date.now();
      state.turnPhase        = 'MUST_DRAW';
    }

    return { playerId, teamId, potIndex, cardCount: potCards.length, cardIds: potCards.map(c => c.id) };
  }

  private resolveCards(hand: Card[], cardIds: string[]): Card[] {
    return cardIds.map(id => {
      const card = hand.find(c => c.id === id);
      if (!card) throw new BadRequestException(`Card ${id} not in hand`);
      return card;
    });
  }
}
