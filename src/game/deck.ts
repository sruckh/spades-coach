// Pure deck utilities: build, seedable RNG, shuffle, deal, trick ordering.
// Framework-free (no React, no boardgame.io) so the engine, AI, and tests all
// share one deterministic source. See `mem:spades_rules`.

import type { Card, PlayerID, Rank, Suit } from '../types'

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
]

/** Trick-taking value, high→low: A=14 … 2=2. */
export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2
}

/** A fresh, ordered 52-card deck. Ids are `${rank}${suit}` (e.g. "AS", "10H"). */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}${suit}` })
    }
  }
  return deck
}

// ---- seedable RNG (mulberry32 seeded from a string via xmur3) ----

/** Hash a string seed into a 32-bit unsigned int. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

/** Deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Convenience: build an RNG from a string seed. */
export function makeRng(seed: string): () => number {
  return mulberry32(hashSeed(seed))
}

/** Fisher–Yates shuffle. Pure: returns a new array, never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** Deal a deck round-robin into 4 hands of 13. */
export function deal(deck: readonly Card[], players = 4): Record<PlayerID, Card[]> {
  const hands: Record<PlayerID, Card[]> = { '0': [], '1': [], '2': [], '3': [] }
  deck.forEach((card, i) => {
    const pid = String(i % players) as PlayerID
    hands[pid].push(card)
  })
  return hands
}

/**
 * Trick comparator relative to the led suit: a spade beats any non-spade; within
 * spades or within the led suit, higher rank wins; an off-suit non-spade cannot win.
 * Returns >0 when `a` beats `b`, <0 when `b` beats `a`.
 */
export function compareForTrick(ledSuit: Suit, a: Card, b: Card): number {
  return trickPower(ledSuit, a) - trickPower(ledSuit, b)
}

function trickPower(ledSuit: Suit, card: Card): number {
  if (card.suit === 'S') return 200 + rankValue(card.rank)
  if (card.suit === ledSuit) return 100 + rankValue(card.rank)
  return rankValue(card.rank) // off-suit discard — cannot win
}
