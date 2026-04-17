import { Card, cardValue } from './deck';
import { Meld, isNaturalCanasta, isCanasta } from './rules';

export function calculateScore(melds: Meld[], hand: Card[]): number {
  let score = 0;

  // Add meld card values
  for (const meld of melds) {
    for (const card of meld.cards) score += cardValue(card);
    if (isNaturalCanasta(meld)) score += 500;
    else if (isCanasta(meld)) score += 300;
  }

  // Subtract unmelded hand cards
  for (const card of hand) score -= cardValue(card);

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
