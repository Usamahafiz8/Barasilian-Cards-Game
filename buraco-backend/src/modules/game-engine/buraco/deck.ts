import { v4 as uuidv4 } from 'uuid';

export type Suit = 'HEARTS' | 'DIAMONDS' | 'CLUBS' | 'SPADES';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';

export interface Card {
  id: string;
  suit: Suit | 'JOKER';
  rank: Rank;
  isWild: boolean;
}

const SUITS: Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeCard(suit: Suit | 'JOKER', rank: Rank): Card {
  return {
    id: uuidv4(),
    suit,
    rank,
    isWild: rank === 'JOKER' || rank === '2',
  };
}

// CLASSIC: 2 decks + jokers = 108 cards. PROFESSIONAL: 2 decks, no jokers = 104 cards.
export function generateDeck(includeJokers: boolean = true): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push(makeCard(suit, rank));
      }
    }
    if (includeJokers) {
      deck.push(makeCard('JOKER', 'JOKER'));
      deck.push(makeCard('JOKER', 'JOKER'));
    }
  }
  return deck;
}

export function shuffle<T>(deck: T[]): T[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// isProfessional: 2 is worth 10 (same as face cards); CLASSIC: 2 (Pinella) = 20, Joker = 30
export function cardValue(card: Card, isProfessional = false): number {
  if (card.rank === 'JOKER') return 30;
  if (card.rank === 'A') return 15;
  if (card.rank === '2') return isProfessional ? 10 : 20;
  if (['J', 'Q', 'K', '8', '9', '10'].includes(card.rank)) return 10;
  return 5; // 3–7
}

export function rankOrder(rank: Rank): number {
  const order: Record<Rank, number> = {
    A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
    '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, JOKER: 0,
  };
  return order[rank];
}

// Used for toss: Joker > Ace > King > … > 2 (Joker=15, Ace=14, 2=2).
export function tossRankValue(rank: Rank): number {
  if (rank === 'JOKER') return 15;
  if (rank === 'A') return 14;
  return rankOrder(rank); // K=13 … 2=2
}
