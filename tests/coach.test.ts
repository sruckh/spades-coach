import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { coachAdvice } from '../src/analysis/coach'
import type { CoachState } from '../src/analysis/coach'
import type { Card, PlayerID } from '../src/types'

/** Build a card from its id, e.g. "10H" → { rank:'10', suit:'H', id:'10H' }. */
function c(id: string): Card {
  return { suit: id.slice(-1) as Card['suit'], rank: id.slice(0, -1) as Card['rank'], id }
}

const emptyTrick = (leader: PlayerID) => ({
  leader,
  suitLed: null,
  cards: { '0': null, '1': null, '2': null, '3': null } as Record<PlayerID, Card | null>,
})

function reasoned(a: { headline: string; body: string; tip: string }) {
  expect(a.headline.length).toBeGreaterThan(0)
  expect(a.body.length).toBeGreaterThan(0)
  expect(a.tip.length).toBeGreaterThan(0)
}

describe('coachAdvice across contexts', () => {
  const hand = ['AS', 'KS', '7S', 'AH', 'QH', '4H', 'KD', '3D', '9C', '5C', '2C', '8D', '6H'].map(c)

  const preBid: CoachState = {
    tier: 'intermediate',
    playerID: '0',
    hand,
    phase: 'bidding',
    score: { NS: 0, EW: 0 },
  }

  const leadChoice: CoachState = {
    tier: 'intermediate',
    playerID: '0',
    hand,
    phase: 'playing',
    trick: emptyTrick('0'),
    spadesBroken: false,
    bids: { '0': 4, '1': 3, '2': 3, '3': 3 },
    tricksByPlayer: { '0': 0, '1': 0, '2': 0, '3': 0 },
    bags: { NS: 0, EW: 0 },
  }

  // NS bid 3 (0:2 + 2:1) and already have 4 tricks → contract made, extra = bags.
  const bagWarning: CoachState = {
    tier: 'intermediate',
    playerID: '0',
    hand,
    phase: 'playing',
    trick: emptyTrick('0'),
    spadesBroken: true,
    bids: { '0': 2, '1': 4, '2': 1, '3': 4 },
    tricksByPlayer: { '0': 2, '1': 3, '2': 2, '3': 2 },
    bags: { NS: 0, EW: 0 },
  }

  it('gives a reasoned bid before bidding', () => {
    const a = coachAdvice(preBid)
    reasoned(a)
    expect(a.suggestedAction).toEqual({ kind: 'bid', bid: expect.any(Number) })
  })

  it('gives a reasoned lead when on lead', () => {
    const a = coachAdvice(leadChoice)
    reasoned(a)
    expect(a.headline).toMatch(/^Lead the /)
    expect(a.suggestedAction?.kind).toBe('play')
  })

  it('warns about bags once the contract is made', () => {
    const a = coachAdvice(bagWarning)
    reasoned(a)
    expect(a.headline).toBe('Careful — bag risk')
    expect(a.body).toMatch(/bag/i)
  })

  it('the three contexts produce distinct advice', () => {
    const headlines = [preBid, leadChoice, bagWarning].map((s) => coachAdvice(s).headline)
    expect(new Set(headlines).size).toBe(3)
  })
})

// The Coach advises but never plays: it must not reference the boardgame.io move API.
describe('the Coach never dispatches a move', () => {
  const files = ['src/analysis/coach.ts', 'src/ui/CoachSheet.tsx']
  for (const rel of files) {
    it(`${rel} contains no move dispatch`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8')
      expect(src).not.toMatch(/\bmoves\s*[.[]/)
      expect(src).not.toMatch(/\.(playCard|placeBid|blindNil|exchangeBlind)\s*\(/)
      expect(src).not.toMatch(/\bdispatch\s*\(/)
    })
  }
})
