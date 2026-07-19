import { describe, expect, it } from 'vitest'
import {
  compareForTrick,
  createDeck,
  deal,
  makeRng,
  mulberry32,
  rankValue,
  shuffle,
} from '../src/game/deck'
import type { Card, PlayerID, Rank, Suit } from '../src/types'

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${rank}${suit}` })

describe('createDeck', () => {
  it('produces 52 cards, all unique', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((c) => c.id)).size).toBe(52)
  })
})

describe('rankValue', () => {
  it('orders A high down to 2 low', () => {
    expect(rankValue('A')).toBe(14)
    expect(rankValue('K')).toBe(13)
    expect(rankValue('10')).toBe(10)
    expect(rankValue('2')).toBe(2)
  })
})

describe('seeded shuffle', () => {
  it('is deterministic: same seed => identical order', () => {
    const a = shuffle(createDeck(), makeRng('seed-alpha'))
    const b = shuffle(createDeck(), makeRng('seed-alpha'))
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })

  it('different seeds produce different orders', () => {
    const a = shuffle(createDeck(), makeRng('seed-alpha'))
    const c = shuffle(createDeck(), makeRng('seed-beta'))
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id))
  })

  it('does not mutate the input deck', () => {
    const deck = createDeck()
    const before = deck.map((c) => c.id)
    shuffle(deck, mulberry32(123))
    expect(deck.map((c) => c.id)).toEqual(before)
  })
})

describe('deal', () => {
  it('gives 13 cards to each of the 4 players, covering the whole deck', () => {
    const hands = deal(shuffle(createDeck(), makeRng('deal-seed')))
    const pids: PlayerID[] = ['0', '1', '2', '3']
    for (const p of pids) expect(hands[p]).toHaveLength(13)
    const all = pids.flatMap((p) => hands[p].map((c) => c.id))
    expect(new Set(all).size).toBe(52)
  })
})

describe('compareForTrick', () => {
  it('a spade beats any non-spade regardless of the led suit', () => {
    expect(compareForTrick('H', card('2', 'S'), card('A', 'H'))).toBeGreaterThan(0)
  })
  it('higher card of the led suit wins when no spade is present', () => {
    expect(compareForTrick('H', card('K', 'H'), card('Q', 'H'))).toBeGreaterThan(0)
  })
  it('an off-suit, non-spade card cannot beat a led-suit card', () => {
    expect(compareForTrick('H', card('A', 'D'), card('3', 'H'))).toBeLessThan(0)
  })
  it('between two spades, the higher rank wins', () => {
    expect(compareForTrick('C', card('A', 'S'), card('K', 'S'))).toBeGreaterThan(0)
  })
})
