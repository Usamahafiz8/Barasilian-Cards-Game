import { Card, rankOrder, Suit } from './deck';

export interface Meld {
  id: string;
  cards: Card[];
  isNatural: boolean;
  isCanasta: boolean;
}

export function validateMeld(cards: Card[]): { valid: boolean; reason?: string } {
  if (cards.length < 3) return { valid: false, reason: 'A meld must have at least 3 cards' };

  const naturals = cards.filter((c) => !c.isWild);
  const wilds = cards.filter((c) => c.isWild);

  if (naturals.length === 0) return { valid: false, reason: 'A meld must have at least one natural card' };
  if (wilds.length > naturals.length) return { valid: false, reason: 'Cannot have more wilds than natural cards' };

  // Check if it's a SET (same rank)
  if (isValidSet(naturals)) return { valid: true };

  // Check if it's a SEQUENCE (same suit, consecutive)
  if (isValidSequence(cards)) return { valid: true };

  return { valid: false, reason: 'Cards do not form a valid set or sequence' };
}

function isValidSet(naturals: Card[]): boolean {
  const ranks = naturals.map((c) => c.rank);
  return new Set(ranks).size === 1;
}

function isValidSequence(cards: Card[]): boolean {
  const naturals = cards.filter((c) => !c.isWild);
  const suits = new Set(naturals.map((c) => c.suit));
  if (suits.size > 1) return false;

  const sortedRanks = naturals.map((c) => rankOrder(c.rank)).sort((a, b) => a - b);
  const wilds = cards.filter((c) => c.isWild).length;
  let gaps = 0;

  for (let i = 1; i < sortedRanks.length; i++) {
    const diff = sortedRanks[i] - sortedRanks[i - 1];
    if (diff === 1) continue;
    if (diff > 1) gaps += diff - 1;
    else return false; // duplicate rank
  }

  return gaps <= wilds;
}

export function canAddToMeld(meld: Meld, cards: Card[]): boolean {
  const combined = [...meld.cards, ...cards];
  const result = validateMeld(combined);
  return result.valid;
}

export function isCanasta(meld: Meld): boolean {
  return meld.cards.length >= 7;
}

export function isNaturalCanasta(meld: Meld): boolean {
  return isCanasta(meld) && meld.cards.every((c) => !c.isWild);
}

export function canPickupDiscardPile(topCard: Card, hand: Card[]): boolean {
  // Can pick up discard pile if you can form a meld with the top card + 2 from hand
  const naturalsInHand = hand.filter((c) => !c.isWild);
  for (const c1 of naturalsInHand) {
    for (const c2 of naturalsInHand) {
      if (c1.id === c2.id) continue;
      const test = validateMeld([topCard, c1, c2]);
      if (test.valid) return true;
    }
  }
  return false;
}

export function canPickupPot(hand: Card[]): boolean {
  return hand.length === 0;
}
