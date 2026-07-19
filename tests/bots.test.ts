import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'
import { SpadesGame } from '../src/game/Spades'
import type { SpadesState } from '../src/game/Spades'
import { legalPlays } from '../src/analysis/legalPlays'
import { suggestBid } from '../src/analysis/suggestBid'
import { suggestPlay } from '../src/analysis/suggestPlay'
import { makeBot } from '../src/ai/bots'
import type { Card, PlayerID, Tier } from '../src/types'

const TIERS: readonly Tier[] = ['beginner', 'intermediate', 'expert']

interface GameResult {
  moves: string[]
  illegalBids: number
  illegalPlays: number
  terminated: boolean
  winner: string | undefined
  handNumber: number
}

/** Drive a whole game with one tier's bot on every seat, auditing each move. */
async function playGame(tier: Tier, seed: string): Promise<GameResult> {
  const client = Client<SpadesState>({ game: { ...SpadesGame, seed }, numPlayers: 4 })
  client.start()
  const bot = makeBot(tier)

  const moves: string[] = []
  let illegalBids = 0
  let illegalPlays = 0
  let guard = 0
  const CAP = 60 * 500 // generous: ~500 hands before we call it a runaway

  for (; guard < CAP; guard++) {
    const s = client.store.getState()
    if (s.ctx.gameover) break

    const cur = s.ctx.currentPlayer as PlayerID
    const { action } = await bot.play(s, cur)
    if (!action) throw new Error(`bot produced no action (seat ${cur}, phase ${s.ctx.phase})`)

    const { type, args } = action.payload as { type: string; args: unknown[] }
    if (s.ctx.phase === 'bidding') {
      const n = args[0] as number
      if (type !== 'placeBid' || !Number.isInteger(n) || n < 0 || n > 13) illegalBids++
      moves.push(`${cur}:bid:${n}`)
    } else {
      const card = args[0] as Card
      const legal = legalPlays(s.G.hands[cur], s.G.currentTrick, s.G.spadesBroken)
      if (type !== 'playCard' || !legal.some((c) => c.id === card.id)) illegalPlays++
      moves.push(`${cur}:play:${card.id}`)
    }

    client.store.dispatch(action)
  }

  const end = client.store.getState()
  return {
    moves,
    illegalBids,
    illegalPlays,
    terminated: Boolean(end.ctx.gameover),
    winner: end.ctx.gameover?.winner,
    handNumber: end.G.handNumber,
  }
}

const GAMES_PER_TIER = 50

describe('3-tier bots play legally across many seeded games', () => {
  for (const tier of TIERS) {
    it(
      `${tier}: ${GAMES_PER_TIER} full games, zero illegal moves, all terminate`,
      async () => {
        let illegalBids = 0
        let illegalPlays = 0
        let multiHand = 0

        for (let i = 0; i < GAMES_PER_TIER; i++) {
          const r = await playGame(tier, `t7-${tier}-${i}`)
          illegalBids += r.illegalBids
          illegalPlays += r.illegalPlays
          expect(r.terminated).toBe(true)
          expect(['NS', 'EW']).toContain(r.winner)
          if (r.handNumber > 1) multiHand += 1
        }

        expect(illegalBids).toBe(0)
        expect(illegalPlays).toBe(0)
        expect(multiHand).toBe(GAMES_PER_TIER) // every game spanned multiple hands
      },
      60_000,
    )
  }
})

describe('bots are deterministic', () => {
  for (const tier of TIERS) {
    it(`${tier}: same seed + tier reproduces the same moves`, async () => {
      const a = await playGame(tier, `det-${tier}`)
      const b = await playGame(tier, `det-${tier}`)
      expect(a.moves).toEqual(b.moves)
      expect(a.winner).toBe(b.winner)
    })
  }
})

describe('analysis helpers return reasoning', () => {
  const hand: Card[] = [
    { suit: 'S', rank: 'A', id: 'AS' },
    { suit: 'S', rank: 'K', id: 'KS' },
    { suit: 'H', rank: 'A', id: 'AH' },
    { suit: 'D', rank: '3', id: '3D' },
  ]

  it('suggestBid returns a bid in range with a non-empty reason for every tier', () => {
    for (const tier of TIERS) {
      const { bid, reasoning } = suggestBid(hand, tier)
      expect(bid).toBeGreaterThanOrEqual(0)
      expect(bid).toBeLessThanOrEqual(13)
      expect(reasoning.length).toBeGreaterThan(0)
    }
  })

  it('suggestPlay returns a legal card with a non-empty reason for every tier', () => {
    const trick = {
      leader: '0' as PlayerID,
      suitLed: null,
      cards: { '0': null, '1': null, '2': null, '3': null },
    }
    for (const tier of TIERS) {
      const { card, reasoning } = suggestPlay(
        { hand, trick, spadesBroken: false, playerID: '0' },
        tier,
      )
      expect(hand.some((c) => c.id === card.id)).toBe(true)
      expect(reasoning.length).toBeGreaterThan(0)
    }
  })
})

describe('suggestPlay leads intelligently', () => {
  const emptyTrick = {
    leader: '0' as PlayerID,
    suitLed: null,
    cards: { '0': null, '1': null, '2': null, '3': null },
  }
  const card = (id: string): Card => ({ suit: id.slice(-1) as Card['suit'], rank: id.slice(0, -1) as Card['rank'], id })

  it('cashes a sure winner (boss card) instead of throwing it away', () => {
    // A♥ is the best heart out; leading it wins the trick and keeps the lead.
    const hand = ['AH', '5H', '2C', '3D'].map(card)
    const { card: chosen, reasoning } = suggestPlay(
      { hand, trick: emptyTrick, spadesBroken: false, playerID: '0', played: [] },
      'intermediate',
    )
    expect(chosen.id).toBe('AH')
    expect(reasoning).toMatch(/Cash/i)
  })

  it('treats a K as boss once the Ace has already been played', () => {
    const hand = ['KH', '5H', '2C', '3D'].map(card)
    const played = [card('AH')] // the ace is gone → the king is now the best heart
    const { card: chosen } = suggestPlay(
      { hand, trick: emptyTrick, spadesBroken: false, playerID: '0', played },
      'intermediate',
    )
    expect(chosen.id).toBe('KH')
  })

  it('probes low when it holds no sure winner', () => {
    const hand = ['KH', '5H', '2C', '3D'].map(card) // K♥ not boss (A♥ still out)
    const { card: chosen, reasoning } = suggestPlay(
      { hand, trick: emptyTrick, spadesBroken: false, playerID: '0', played: [] },
      'intermediate',
    )
    expect(chosen.id).toBe('5H') // low from the longest side suit
    expect(reasoning).toMatch(/Probe/i)
  })

  it('a Nil bidder ducks the lead instead of cashing winners', () => {
    const hand = ['AH', '5H', '2C', '3D'].map(card)
    const { card: chosen, reasoning } = suggestPlay(
      { hand, trick: emptyTrick, spadesBroken: false, playerID: '0', played: [], bids: { '0': 0, '1': 3, '2': 3, '3': 3 } },
      'intermediate',
    )
    expect(chosen.id).toBe('2C') // lowest card, not the A♥
    expect(reasoning).toMatch(/Nil/i)
  })
})
