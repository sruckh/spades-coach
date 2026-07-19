import { describe, expect, it } from 'vitest'
import { gameWinner, scoreHand, scoreHandBreakdown } from '../src/game/scoring'
import type { HandForScoring } from '../src/game/scoring'
import type { Bid, NilKind, PlayerID, Team } from '../src/types'

/** A hand-scoring input; unspecified seats bid a harmless 1 and take no tricks. */
function fixture(o: {
  bids?: Partial<Record<PlayerID, Bid>>
  nilKind?: Partial<Record<PlayerID, NilKind>>
  tricks?: Partial<Record<PlayerID, number>>
  bags?: Partial<Record<Team, number>>
}): HandForScoring {
  return {
    bids: { '0': 1, '1': 1, '2': 1, '3': 1, ...o.bids },
    nilKind: { '0': null, '1': null, '2': null, '3': null, ...o.nilKind },
    tricksByPlayer: { '0': 0, '1': 0, '2': 0, '3': 0, ...o.tricks },
    bags: { NS: 0, EW: 0, ...o.bags },
  }
}

// NS = seats 0 (South) + 2 (North). Every case asserts the NS partnership.
describe('scoreHand matrix', () => {
  it('a contract made exactly scores +10 × bid with no bags', () => {
    const r = scoreHand(fixture({ bids: { '0': 3, '2': 3 }, tricks: { '0': 3, '2': 3 } }))
    expect(r.NS).toEqual({ points: 60, bags: 0 })
  })

  it('a set scores 0 — not -10 × bid', () => {
    const r = scoreHand(fixture({ bids: { '0': 4, '2': 3 }, tricks: { '0': 3, '2': 3 } }))
    expect(r.NS).toEqual({ points: 0, bags: 0 })
  })

  it('overtricks add +1 each and accumulate as bags', () => {
    const r = scoreHand(fixture({ bids: { '0': 2, '2': 2 }, tricks: { '0': 3, '2': 3 } }))
    // bid 4, took 6 → +40 + 2 bags.
    expect(r.NS).toEqual({ points: 42, bags: 2 })
  })

  it('a made Nil scores +100 on top of the partner’s contract', () => {
    const r = scoreHand(
      fixture({ bids: { '0': 0, '2': 4 }, nilKind: { '0': 'nil' }, tricks: { '0': 0, '2': 4 } }),
    )
    // partner +40, nil +100.
    expect(r.NS).toEqual({ points: 140, bags: 0 })
  })

  it('a failed Nil scores -100 and its tricks become bags, not contract tricks', () => {
    const r = scoreHand(
      fixture({ bids: { '0': 0, '2': 4 }, nilKind: { '0': 'nil' }, tricks: { '0': 2, '2': 4 } }),
    )
    // partner makes 4 (nil's 2 don't count) → +40; nil fail -100; +2 bags.
    expect(r.NS).toEqual({ points: -58, bags: 2 })
  })

  it('a made Blind Nil scores +200', () => {
    const r = scoreHand(
      fixture({ bids: { '0': 0, '2': 3 }, nilKind: { '0': 'blindnil' }, tricks: { '0': 0, '2': 3 } }),
    )
    expect(r.NS).toEqual({ points: 230, bags: 0 })
  })

  it('a failed Blind Nil scores -200 and its tricks are bags', () => {
    const r = scoreHand(
      fixture({ bids: { '0': 0, '2': 3 }, nilKind: { '0': 'blindnil' }, tricks: { '0': 1, '2': 3 } }),
    )
    // partner +30, blind fail -200, +1 bag.
    expect(r.NS).toEqual({ points: -169, bags: 1 })
  })

  it('sandbag: every 10 cumulative bags costs -100 and the remainder carries', () => {
    const r = scoreHand(
      fixture({ bids: { '0': 2, '2': 2 }, tricks: { '0': 4, '2': 3 }, bags: { NS: 8 } }),
    )
    // bid 4, took 7 → +40 + 3 bags; 8+3 = 11 bags → -100, carry 1.
    expect(r.NS).toEqual({ points: -57, bags: 1 })
  })
})

describe('scoreHandBreakdown itemises the hand', () => {
  it('explains a made contract with an overtrick bag', () => {
    const b = scoreHandBreakdown(fixture({ bids: { '0': 3, '2': 3 }, tricks: { '0': 4, '2': 3 } })).NS
    expect(b).toMatchObject({
      bid: 6,
      tricks: 7,
      contractTricks: 7,
      made: true,
      contractPoints: 60,
      overtrickBags: 1,
      bagsThisHand: 1,
      bagsAfter: 1,
      sandbagPenalty: 0,
      points: 61,
    })
  })

  it('explains a set as 0 contract points', () => {
    const b = scoreHandBreakdown(fixture({ bids: { '0': 4, '2': 3 }, tricks: { '0': 3, '2': 3 } })).NS
    expect(b).toMatchObject({ made: false, contractPoints: 0, overtrickBags: 0, points: 0 })
  })

  it('itemises a made Nil alongside the partner contract', () => {
    const b = scoreHandBreakdown(
      fixture({ bids: { '0': 0, '2': 4 }, nilKind: { '0': 'nil' }, tricks: { '0': 0, '2': 4 } }),
    ).NS
    expect(b.nils).toEqual([{ player: '0', kind: 'nil', tricks: 0, made: true, delta: 100 }])
    expect(b).toMatchObject({ bid: 4, made: true, contractPoints: 40, nilPoints: 100, points: 140 })
  })

  it('records the sandbag penalty when 10 bags accumulate', () => {
    const b = scoreHandBreakdown(
      fixture({ bids: { '0': 2, '2': 2 }, tricks: { '0': 4, '2': 3 }, bags: { NS: 8 } }),
    ).NS
    expect(b).toMatchObject({ bagsThisHand: 3, bagsBefore: 8, sandbagPenalty: -100, bagsAfter: 1 })
  })

  it('scoreHand is exactly the breakdown reduced to points + carried bags', () => {
    const cases: HandForScoring[] = [
      fixture({ bids: { '0': 3, '2': 3 }, tricks: { '0': 4, '2': 3 } }),
      fixture({ bids: { '0': 4, '2': 3 }, tricks: { '0': 3, '2': 3 } }),
      fixture({ bids: { '0': 0, '2': 4 }, nilKind: { '0': 'nil' }, tricks: { '0': 2, '2': 4 } }),
      fixture({ bids: { '0': 2, '2': 2 }, tricks: { '0': 4, '2': 3 }, bags: { NS: 8 } }),
    ]
    for (const g of cases) {
      const s = scoreHand(g)
      const b = scoreHandBreakdown(g)
      for (const team of ['NS', 'EW'] as const) {
        expect(s[team]).toEqual({ points: b[team].points, bags: b[team].bagsAfter })
      }
    }
  })
})

describe('gameWinner', () => {
  it('declares the team that reaches the 200 target', () => {
    expect(gameWinner({ NS: 210, EW: 150 })).toBe('NS')
    expect(gameWinner({ NS: 140, EW: 205 })).toBe('EW')
  })

  it('breaks a both-crossed hand by the higher score', () => {
    expect(gameWinner({ NS: 215, EW: 205 })).toBe('NS')
    expect(gameWinner({ NS: 200, EW: 240 })).toBe('EW')
  })

  it('keeps playing when nobody has reached the target', () => {
    expect(gameWinner({ NS: 199, EW: 180 })).toBeNull()
  })

  it('keeps playing on an exact tie at or above the target', () => {
    expect(gameWinner({ NS: 205, EW: 205 })).toBeNull()
    expect(gameWinner({ NS: 200, EW: 200 })).toBeNull()
  })
})
