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

let cardCounter = 0;

function makeCard(suit: Suit | 'JOKER', rank: Rank): Card {
  cardCounter++;
  return {
    id: `c${cardCounter}_${suit}_${rank}`,
    suit,
    rank,
    isWild: rank === 'JOKER' || rank === '2',
  };
}

export function generateDeck(): Card[] {
  const deck: Card[] = [];
  // Two full decks
  for (let d = 0; d < 2; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push(makeCard(suit, rank));
      }
    }
    // 2 jokers per deck
    deck.push(makeCard('JOKER', 'JOKER'));
    deck.push(makeCard('JOKER', 'JOKER'));
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardValue(card: Card): number {
  if (card.rank === 'JOKER') return 50;
  if (card.rank === 'A') return 15;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === '2') return 20;
  return parseInt(card.rank);
}

export function rankOrder(rank: Rank): number {
  const order: Record<Rank, number> = {
    A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
    '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, JOKER: 0,
  };
  return order[rank];
}
