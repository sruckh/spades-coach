// Pure hand evaluation — shared by the bidding AI and the Coach (no duplicated
// rule logic). Framework-free: type-only import, no React / boardgame.io.

import type { Card, Suit } from '../types'

const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']

/** High-card trick expectation: Ace≈1, King≈0.75, Queen≈0.5. */
const HONOR: Record<string, number> = { A: 1, K: 0.75, Q: 0.5 }

export interface HandEval {
  /** Expected tricks: honor values + long-spade length bonus. */
  sureTricks: number
  /** Per-suit contribution to `sureTricks`. */
  potentialBySuit: Record<Suit, number>
  spadesLength: number
  /** Suits with zero cards (ruffing potential). */
  voids: Suit[]
}

/**
 * Heuristic per `mem:spades_rules`/§Layer B: honor values plus roughly one extra
 * trick per long spade (each spade beyond the 4th is likely a winner).
 */
export function evaluateHand(hand: readonly Card[]): HandEval {
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 }
  const potentialBySuit: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 }

  for (const card of hand) {
    counts[card.suit] += 1
    potentialBySuit[card.suit] += HONOR[card.rank] ?? 0
  }

  const spadesLength = counts.S
  const spadeLengthBonus = Math.max(0, spadesLength - 4)
  potentialBySuit.S += spadeLengthBonus

  const sureTricks = SUITS.reduce((sum, suit) => sum + potentialBySuit[suit], 0)
  const voids = SUITS.filter((suit) => counts[suit] === 0)

  return { sureTricks, potentialBySuit, spadesLength, voids }
}
