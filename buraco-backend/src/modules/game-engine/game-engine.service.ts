import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameMode, GameStatus, GameVariant, MoveType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EconomyService } from '../economy/economy.service';
import { StatsService } from '../stats/stats.service';
import { generateDeck, shuffle, Card } from './buraco/deck';
import { validateMeld, canAddToMeld, canPickupDiscardPile, canPickupPot, Meld } from './buraco/rules';
import { calculateScore, calculateMatchReward } from './buraco/scoring';

export interface GameState {
  gameId: string;
  mode: GameMode;
  variant: GameVariant;
  status: GameStatus;
  stockPile: Card[];
  discardPile: Card[];
  potPiles: Card[][];
  hands: Record<string, Card[]>;         // userId → cards (private)
  melds: Record<string, Meld[]>;         // userId → melds
  teamMelds: Record<number, Meld[]>;     // teamId → shared melds (for 2v2)
  players: Array<{ userId: string; teamId: number; isConnected: boolean }>;
  turnOrder: string[];
  currentTurnIndex: number;
  turnStartedAt: number;
  turnDuration: number;
  round: number;
  scores: Record<number, number>;        // teamId → score
  moveCount: number;
}

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private economyService: EconomyService,
    private statsService: StatsService,
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
            teamId: variant === GameVariant.ONE_VS_ONE ? idx + 1 : idx < 2 ? 1 : 2,
          })),
        },
      },
      include: { players: true },
    });

    const deck = shuffle(generateDeck());
    const hands: Record<string, Card[]> = {};
    const potPiles: Card[][] = [[], []];

    // Deal 11 cards to each player
    let deckIdx = 0;
    for (const player of game.players) {
      hands[player.userId] = deck.slice(deckIdx, deckIdx + 11);
      deckIdx += 11;
    }

    // Create 2 pot piles of 11 cards each
    potPiles[0] = deck.slice(deckIdx, deckIdx + 11);
    deckIdx += 11;
    potPiles[1] = deck.slice(deckIdx, deckIdx + 11);
    deckIdx += 11;

    const stockPile = deck.slice(deckIdx);
    const topCard = stockPile.pop();
    const discardPile: Card[] = topCard ? [topCard] : [];

    const turnOrder = playerIds; // randomize in production
    const players = game.players.map((p) => ({ userId: p.userId, teamId: p.teamId, isConnected: true }));

    const state: GameState = {
      gameId: game.id,
      mode,
      variant,
      status: GameStatus.IN_PROGRESS,
      stockPile,
      discardPile,
      potPiles,
      hands,
      melds: Object.fromEntries(playerIds.map((id) => [id, []])),
      teamMelds: { 1: [], 2: [] },
      players,
      turnOrder,
      currentTurnIndex: 0,
      turnStartedAt: Date.now(),
      turnDuration: 30,
      round: 1,
      scores: { 1: 0, 2: 0 },
      moveCount: 0,
    };

    await this.redis.setJson(this.stateKey(game.id), state, 86400);
    return state;
  }

  async getGameState(gameId: string, requestingUserId: string): Promise<GameState & { myHand: Card[]; myMelds: Meld[] }> {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state) throw new NotFoundException('Game state not found');

    return {
      ...state,
      myHand: state.hands[requestingUserId] || [],
      myMelds: state.melds[requestingUserId] || [],
      hands: Object.fromEntries(Object.entries(state.hands).map(([uid, cards]) => [uid, uid === requestingUserId ? cards : cards.map(() => ({ id: '?', rank: '?', suit: '?', isWild: false } as any))])),
    };
  }

  async processMove(gameId: string, playerId: string, move: { type: MoveType; cardIds?: string[]; meldId?: string; source?: 'STOCK' | 'DISCARD' }) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state) throw new NotFoundException('Game not found');
    if (state.status !== GameStatus.IN_PROGRESS) throw new BadRequestException('GAME_NOT_IN_PROGRESS');

    const currentPlayer = state.turnOrder[state.currentTurnIndex];
    if (currentPlayer !== playerId) throw new BadRequestException('NOT_YOUR_TURN');

    const hand = state.hands[playerId];
    let result: any = {};

    switch (move.type) {
      case MoveType.DRAW_STOCK: {
        const card = state.stockPile.pop();
        if (!card) throw new BadRequestException('Stock pile is empty');
        hand.push(card);
        result = { card, handCount: hand.length, stockPileCount: state.stockPile.length };
        break;
      }

      case MoveType.DRAW_DISCARD: {
        const topCard = state.discardPile[state.discardPile.length - 1];
        if (!topCard) throw new BadRequestException('Discard pile is empty');
        if (!canPickupDiscardPile(topCard, hand)) throw new BadRequestException('Cannot pick up discard pile');
        state.discardPile.pop();
        hand.push(topCard);
        result = { card: topCard, handCount: hand.length };
        break;
      }

      case MoveType.PLAY_MELD: {
        const cards = this.resolveCards(hand, move.cardIds || []);
        const validation = validateMeld(cards);
        if (!validation.valid) throw new BadRequestException(validation.reason || 'INVALID_MELD');
        const newMeld: Meld = { id: uuidv4(), cards, isNatural: cards.every((c) => !c.isWild), isCanasta: cards.length >= 7 };
        state.melds[playerId].push(newMeld);
        (move.cardIds ?? []).forEach((id) => { const idx = hand.findIndex((c) => c.id === id); if (idx !== -1) hand.splice(idx, 1); });
        result = { meld: newMeld, handCount: hand.length };
        break;
      }

      case MoveType.ADD_TO_MELD: {
        const meld = state.melds[playerId]?.find((m) => m.id === move.meldId);
        if (!meld) throw new NotFoundException('Meld not found');
        const cards = this.resolveCards(hand, move.cardIds || []);
        if (!canAddToMeld(meld, cards)) throw new BadRequestException('Cannot add those cards to this meld');
        meld.cards.push(...cards);
        meld.isCanasta = meld.cards.length >= 7;
        meld.isNatural = meld.cards.every((c) => !c.isWild);
        (move.cardIds ?? []).forEach((id) => { const idx = hand.findIndex((c) => c.id === id); if (idx !== -1) hand.splice(idx, 1); });
        result = { meld, handCount: hand.length };
        break;
      }

      case MoveType.DISCARD: {
        const cardId = move.cardIds?.[0];
        if (!cardId) throw new BadRequestException('No card specified for discard');
        const idx = hand.findIndex((c) => c.id === cardId);
        if (idx === -1) throw new BadRequestException('Card not in hand');
        const [card] = hand.splice(idx, 1);
        state.discardPile.push(card);
        result = { discardedCard: card, handCount: hand.length };

        // Check game end: hand is empty after discard
        if (hand.length === 0 && state.potPiles.every((p) => p.length === 0)) {
          return this.finalizeGame(gameId, state);
        }

        // Advance turn after discard
        state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
        state.turnStartedAt = Date.now();
        break;
      }

      case MoveType.PICKUP_POT: {
        if (!canPickupPot(hand)) throw new BadRequestException('Hand must be empty to pick up pot');
        const pot = state.potPiles.find((p) => p.length > 0);
        if (!pot) throw new BadRequestException('No pot available');
        hand.push(...pot.splice(0, pot.length));
        result = { handCount: hand.length };
        break;
      }
    }

    state.moveCount++;
    await this.redis.setJson(this.stateKey(gameId), state, 86400);

    // Log move to DB
    await this.prisma.gameMove.create({
      data: { gameId, playerId, turnNumber: state.moveCount, moveType: move.type, cardData: result, isValid: true },
    });

    return { state, result, nextTurnPlayerId: state.turnOrder[state.currentTurnIndex] };
  }

  async finalizeGame(gameId: string, state?: GameState) {
    if (!state) state = (await this.redis.getJson<GameState>(this.stateKey(gameId))) ?? undefined;
    if (!state) throw new NotFoundException('Game not found');

    // Calculate scores
    const teamScores: Record<number, number> = { 1: 0, 2: 0 };
    for (const player of state.players) {
      const score = calculateScore(state.melds[player.userId] || [], state.hands[player.userId] || []);
      teamScores[player.teamId] = (teamScores[player.teamId] || 0) + score;
    }

    const winnerTeam = teamScores[1] >= teamScores[2] ? 1 : 2;
    const winnerIds = state.players.filter((p) => p.teamId === winnerTeam).map((p) => p.userId);
    const duration = Math.floor((Date.now() - state.turnStartedAt) / 1000);

    // Persist result
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

    // Update stats and economy
    await Promise.all(state.players.map(async (p) => {
      const isWinner = winnerIds.includes(p.userId);
      const score = teamScores[p.teamId];
      const reward = calculateMatchReward(score, isWinner);
      await this.statsService.updateAfterMatch(p.userId, isWinner ? 'WIN' : 'LOSS', reward.points, reward.xp);
      await this.economyService.distributeMatchReward(p.userId, gameId, reward.coins);
    }));

    // Cleanup Redis
    await this.redis.del(this.stateKey(gameId));

    return { winnerTeam, winnerIds, scores: teamScores, duration };
  }

  async handleTurnTimeout(gameId: string) {
    const state = await this.redis.getJson<GameState>(this.stateKey(gameId));
    if (!state || state.status !== GameStatus.IN_PROGRESS) return;

    const playerId = state.turnOrder[state.currentTurnIndex];
    const hand = state.hands[playerId];

    // Auto-discard first card
    if (hand.length > 0) {
      const [card] = hand.splice(0, 1);
      state.discardPile.push(card);
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      state.turnStartedAt = Date.now();
      await this.redis.setJson(this.stateKey(gameId), state, 86400);

      await this.prisma.gameMove.create({
        data: { gameId, playerId, turnNumber: state.moveCount + 1, moveType: MoveType.DISCARD, cardData: { auto: true, card: card as any }, isValid: true },
      });

      return { playerId, autoAction: 'DISCARD', card };
    }
  }

  private resolveCards(hand: Card[], cardIds: string[]): Card[] {
    return cardIds.map((id) => {
      const card = hand.find((c) => c.id === id);
      if (!card) throw new BadRequestException(`Card ${id} not in hand`);
      return card;
    });
  }
}
