import { describe, expect, it } from 'vitest'
import { evaluateHand } from '../src/analysis/handEval'
import type { Card, Rank, Suit } from '../src/types'

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit, id: `${rank}${suit}` })

describe('evaluateHand', () => {
  it('empty hand => zeros and every suit void', () => {
    const e = evaluateHand([])
    expect(e.sureTricks).toBe(0)
    expect(e.spadesLength).toBe(0)
    expect(e.potentialBySuit).toEqual({ S: 0, H: 0, D: 0, C: 0 })
    expect(new Set(e.voids)).toEqual(new Set<Suit>(['S', 'H', 'D', 'C']))
  })

  it('sums honors: A=1, K=0.75, Q=0.5', () => {
    const e = evaluateHand([card('A', 'H'), card('K', 'D'), card('Q', 'C')])
    expect(e.sureTricks).toBeCloseTo(2.25)
    expect(e.spadesLength).toBe(0)
    expect(e.voids).toEqual(['S'])
  })

  it('counts spade length beyond four as extra tricks', () => {
    const spades = (['A', 'K', 'Q', 'J', '10', '9'] as Rank[]).map((r) => card(r, 'S'))
    const e = evaluateHand(spades)
    expect(e.spadesLength).toBe(6)
    // honors A+K+Q = 2.25, plus (6 - 4) = 2 length tricks
    expect(e.sureTricks).toBeCloseTo(4.25)
    expect(e.potentialBySuit.S).toBeCloseTo(4.25)
    expect(e.voids).toEqual(['H', 'D', 'C'])
  })

  it('reports no bonus for four or fewer spades', () => {
    const e = evaluateHand((['A', 'K', 'Q', 'J'] as Rank[]).map((r) => card(r, 'S')))
    expect(e.spadesLength).toBe(4)
    expect(e.sureTricks).toBeCloseTo(2.25)
  })
})
