import { GameMode } from '@prisma/client';
import { Card, cardValue } from './deck';
import { Meld, computeMeldHasActingWild } from './rules';

/**
 * Buraco bonus for a 7+ card meld.
 *
 * Classic:
 *   Clean     (no acting wild)  → 200
 *   Semi-clean (1 acting wild at the very start or end of a RUN) → 150
 *   Dirty     (1 acting wild internal to a RUN, or any wild in a SET) → 100
 *
 * Professional:
 *   Once a meld is ever dirty, it stays dirty (everDirty flag).
 *   Semi-clean does not exist in Professional.
 *   Clean (no acting wild, and never was dirty) → 200
 *   Dirty (acting wild, OR everDirty) → 100
 */
function buracBonus(meld: Meld, mode: GameMode): number {
  if (meld.cards.length < 7) return 0;

  const hasActingWild = computeMeldHasActingWild(meld.cards, meld.type);

  if (mode === GameMode.PROFESSIONAL) {
    const isDirty = hasActingWild || !!meld.everDirty;
    return isDirty ? 100 : 200;
  }

  // Classic
  if (!hasActingWild) return 200; // Clean
  if (isSemiCleanClassic(meld)) return 150; // Semi-clean
  return 100; // Dirty
}

/**
 * Classic only: semi-clean = 7+ cards, exactly 1 wild, wild at the very start or end.
 * Uses the sorted card order (sortMeldCards puts wilds at their gap positions).
 */
function isSemiCleanClassic(meld: Meld): boolean {
  if (meld.cards.length < 7) return false;
  const wilds = meld.cards.filter(c => c.isWild);
  if (wilds.length !== 1) return false;
  return meld.cards[0].isWild || meld.cards[meld.cards.length - 1].isWild;
}

export function calculateScore(melds: Meld[], hand: Card[], mode: GameMode = GameMode.CLASSIC): number {
  const isPro = mode === GameMode.PROFESSIONAL;
  let score = 0;

  for (const meld of melds) {
    for (const card of meld.cards) score += cardValue(card, isPro);
    score += buracBonus(meld, mode);
  }

  for (const card of hand) score -= cardValue(card, isPro);

  return score;
}

export function calculateMatchReward(score: number, isWinner: boolean): { coins: number; xp: number; points: number } {
  if (isWinner) {
    return {
      coins:  Math.max(200, Math.floor(score / 10)),
      xp:     100 + Math.floor(score / 50),
      points: 50  + Math.floor(score / 20),
    };
  }
  return { coins: 50, xp: 25, points: 0 };
}
