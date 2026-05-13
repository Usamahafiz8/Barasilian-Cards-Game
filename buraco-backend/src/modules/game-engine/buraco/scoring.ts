import { GameMode } from '@prisma/client';
import { Card, cardValue } from './deck';
import { Meld } from './rules';

// Semi-clean: 7+ cards, exactly 1 wild, wild is at the very start or end of the sequence
function isSemiClean(meld: Meld): boolean {
  if (meld.cards.length < 7) return false;
  const wilds = meld.cards.filter((c) => c.isWild);
  if (wilds.length !== 1) return false;
  return meld.cards[0].isWild || meld.cards[meld.cards.length - 1].isWild;
}

function buracBonus(meld: Meld, mode: GameMode): number {
  if (meld.cards.length < 7) return 0;
  const hasWild = meld.cards.some((c) => c.isWild);
  if (!hasWild) return 200; // Clean Buraco
  if (mode === GameMode.CLASSIC && isSemiClean(meld)) return 150; // Semi-clean (CLASSIC only)
  return 100; // Dirty Buraco
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
      coins: Math.max(200, Math.floor(score / 10)),
      xp: 100 + Math.floor(score / 50),
      points: 50 + Math.floor(score / 20),
    };
  }
  return { coins: 50, xp: 25, points: 0 };
}
