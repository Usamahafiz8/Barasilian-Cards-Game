import { Card, rankOrder } from './deck';

export type MeldType = 'SET' | 'RUN';

export interface Meld {
  id: string;
  type: MeldType;
  cards: Card[];
  isNatural: boolean;
  isCanasta: boolean;
}

/**
 * Validates a meld and returns its type.
 *
 * SET rules:  all naturals same rank, max 1 wild (any kind), at least 1 natural.
 * RUN rules:  all naturals same suit, consecutive (gaps filled by wilds), max 1 wild.
 *   Classic:     any wild (Joker or 2) may fill a gap.
 *   Professional: only a 2 may fill a run gap — Jokers are barred from runs.
 */
export function validateMeld(
  cards: Card[],
  mode: string = 'CLASSIC',
): { valid: boolean; type?: MeldType; reason?: string } {
  if (cards.length < 3) return { valid: false, reason: 'A meld must have at least 3 cards' };

  const naturals = cards.filter((c) => !c.isWild);
  const wilds = cards.filter((c) => c.isWild);

  if (naturals.length === 0) return { valid: false, reason: 'A meld must have at least one natural card' };

  // ── SET ──────────────────────────────────────────────────────────────────
  if (wilds.length <= 1 && isValidSet(naturals)) {
    return { valid: true, type: 'SET' };
  }

  // ── RUN ──────────────────────────────────────────────────────────────────
  // Professional: Jokers cannot fill runs; only a 2 may.
  if (mode === 'PROFESSIONAL') {
    if (wilds.some((c) => c.rank === 'JOKER')) {
      return { valid: false, reason: 'Jokers cannot fill runs in Professional mode' };
    }
    const twos = wilds.filter((c) => c.rank === '2');
    if (twos.length > 1) {
      return { valid: false, reason: 'A run can contain at most one 2 in Professional mode' };
    }
    if (isValidRun(naturals, twos.length)) return { valid: true, type: 'RUN' };
  } else {
    // Classic: any single wild allowed
    if (wilds.length > 1) return { valid: false, reason: 'A meld can contain at most one wild card' };
    if (isValidRun(naturals, wilds.length)) return { valid: true, type: 'RUN' };
  }

  return { valid: false, reason: 'Cards do not form a valid set or run' };
}

// ── Internal validators ───────────────────────────────────────────────────

function isValidSet(naturals: Card[]): boolean {
  const ranks = naturals.map((c) => c.rank);
  return new Set(ranks).size === 1;
}

/**
 * Checks that the natural cards alone can form a consecutive same-suit run
 * when `wildCount` wilds are available to fill gaps.
 * Tries Ace as low (1) first, then as high (14).
 */
function isValidRun(naturals: Card[], wildCount: number): boolean {
  if (naturals.length === 0) return false;
  const suits = new Set(naturals.map((c) => c.suit));
  if (suits.size > 1) return false;

  const ranks = naturals.map((c) => rankOrder(c.rank));

  if (fitsWithWilds(ranks, wildCount)) return true;

  // Retry with Ace as high (14)
  if (naturals.some((c) => c.rank === 'A')) {
    const highRanks = ranks.map((r) => (r === 1 ? 14 : r));
    if (fitsWithWilds(highRanks, wildCount)) return true;
  }

  return false;
}

function fitsWithWilds(ranks: number[], wildCount: number): boolean {
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) return false; // duplicate rank
  }
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    gaps += sorted[i] - sorted[i - 1] - 1;
  }
  return gaps <= wildCount;
}

// ── Card sort ─────────────────────────────────────────────────────────────

/**
 * Returns meld cards in logical display order:
 *   SET  — naturals first (any order), wild(s) last.
 *   RUN  — high-to-low, with each wild placed at the gap it fills;
 *          if no internal gap, the wild extends the lower end.
 */
export function sortMeldCards(cards: Card[], type: MeldType): Card[] {
  return type === 'RUN' ? sortRunCards(cards) : sortSetCards(cards);
}

function sortSetCards(cards: Card[]): Card[] {
  return [...cards.filter((c) => !c.isWild), ...cards.filter((c) => c.isWild)];
}

function shouldAceBeHigh(naturals: Card[]): boolean {
  if (!naturals.some((c) => c.rank === 'A')) return false;
  // If any other natural is a high card (10–K), treat Ace as high (14).
  return naturals.some((c) => c.rank !== 'A' && rankOrder(c.rank) >= 10);
}

function sortRunCards(cards: Card[]): Card[] {
  const naturals = cards.filter((c) => !c.isWild);
  const wilds = cards.filter((c) => c.isWild);

  const aceHigh = shouldAceBeHigh(naturals);
  const rank = (c: Card) => (aceHigh && c.rank === 'A' ? 14 : rankOrder(c.rank));

  // Sort naturals high → low
  const sorted = [...naturals].sort((a, b) => rank(b) - rank(a));

  if (wilds.length === 0) return sorted;

  // Place the single wild at the first internal gap found
  for (let i = 0; i < sorted.length - 1; i++) {
    if (rank(sorted[i]) - rank(sorted[i + 1]) > 1) {
      return [...sorted.slice(0, i + 1), wilds[0], ...sorted.slice(i + 1)];
    }
  }

  // No internal gap — wild extends the lower end
  return [...sorted, wilds[0]];
}

// ── Public helpers ────────────────────────────────────────────────────────

/**
 * Returns true if `newCards` can legally be added to `meld`.
 * The combined result must be valid AND preserve the meld's original type.
 */
export function canAddToMeld(meld: Meld, newCards: Card[], mode: string = 'CLASSIC'): boolean {
  const combined = [...meld.cards, ...newCards];
  const result = validateMeld(combined, mode);
  return result.valid && result.type === meld.type;
}

export function canPickupDiscardPile(topCard: Card, hand: Card[]): boolean {
  const naturalsInHand = hand.filter((c) => !c.isWild);
  for (const c1 of naturalsInHand) {
    for (const c2 of naturalsInHand) {
      if (c1.id === c2.id) continue;
      if (validateMeld([topCard, c1, c2]).valid) return true;
    }
  }
  return false;
}

export function canPickupPot(hand: Card[]): boolean {
  return hand.length === 0;
}

export function hasBuraco(melds: Meld[]): boolean {
  return melds.some((m) => m.cards.length >= 7);
}

export function isCanasta(meld: Meld): boolean {
  return meld.cards.length >= 7;
}

export function isNaturalCanasta(meld: Meld): boolean {
  return isCanasta(meld) && meld.cards.every((c) => !c.isWild);
}
