import { Client } from 'boardgame.io/client'
import { describe, expect, it } from 'vitest'
import { INVALID_MOVE } from 'boardgame.io/core'
import {
  CLOCKWISE_PLAYERS,
  SpadesGame,
  blindNil,
  exchangeBlind,
  leftOf,
  legalPlaysFor,
  newTrick,
  placeBid,
  playCard,
  resolveTrick,
  setup,
  stripSecrets,
} from '../src/game/Spades'
import type { SpadesState, Trick } from '../src/game/Spades'
import { makeRng, shuffle } from '../src/game/deck'
import type { Card, PlayerID, Suit, Team } from '../src/types'

const PIDS: readonly PlayerID[] = ['0', '1', '2', '3']

/** A deterministic `random` plugin stand-in backed by our own seeded shuffle. */
function randomWith(seed: string) {
  return { Shuffle: <T>(deck: T[]): T[] => shuffle(deck, makeRng(seed)) }
}

/** Build a raw, *unredacted* initial state (bypasses playerView). */
function rawSetup(seed = 'fixed', allowBlindNil = true): SpadesState {
  return setup({ random: randomWith(seed) }, { allowBlindNil })
}

/** A no-op turn controller for driving move reducers directly. */
const noEvents = { endTurn: () => {} }

describe('setup', () => {
  it('deals 13 cards to every seat, covering the whole 52-card deck', () => {
    const G = rawSetup()
    for (const p of PIDS) expect(G.hands[p]).toHaveLength(13)
    const all = PIDS.flatMap((p) => G.hands[p].map((c) => c.id))
    expect(new Set(all).size).toBe(52)
  })

  it('is deterministic: the same seed deals identical hands', () => {
    const a = rawSetup('same')
    const b = rawSetup('same')
    for (const p of PIDS) {
      expect(a.hands[p].map((c) => c.id)).toEqual(b.hands[p].map((c) => c.id))
    }
  })

  it('different seeds deal different hands', () => {
    const a = PIDS.flatMap((p) => rawSetup('seed-a').hands[p].map((c) => c.id))
    const b = PIDS.flatMap((p) => rawSetup('seed-b').hands[p].map((c) => c.id))
    expect(a).not.toEqual(b)
  })

  it('starts with no bids placed and South as dealer', () => {
    const G = rawSetup()
    expect(G.dealer).toBe('0')
    expect(G.handNumber).toBe(1)
    for (const p of PIDS) {
      expect(G.bids[p]).toBeNull()
      expect(G.nilKind[p]).toBeNull()
    }
  })
})

describe('bidding turn order (integration)', () => {
  it('starts left of the dealer and proceeds clockwise (S→W→N→E)', () => {
    // Dealer is '0' (South); clockwise ids are 0→3→2→1, so the first bidder is
    // '3' (West) and the round runs 3, 2, 1, 0.
    expect(CLOCKWISE_PLAYERS).toEqual(['0', '3', '2', '1'])

    const client = Client<SpadesState>({ game: { ...SpadesGame, seed: 'fixed' }, numPlayers: 4 })
    client.start()

    const seen: PlayerID[] = []
    for (let i = 0; i < 4; i++) {
      const s = client.getState()
      if (!s) throw new Error('no state')
      seen.push(s.ctx.currentPlayer as PlayerID)
      client.moves.placeBid(3)
    }
    expect(seen).toEqual(['3', '2', '1', '0'])

    const end = client.getState()
    if (!end) throw new Error('no state')
    // Phase closes once every bid is in.
    expect(end.ctx.phase).not.toBe('bidding')
    for (const p of PIDS) expect(end.G.bids[p]).toBe(3)
  })
})

describe('placeBid validation', () => {
  it('records 0 as a Nil bid', () => {
    const G = rawSetup()
    expect(placeBid({ G, playerID: '3', events: noEvents }, 0)).not.toBe(INVALID_MOVE)
    expect(G.bids['3']).toBe(0)
    expect(G.nilKind['3']).toBe('nil')
  })

  it('records a positive bid with no nil flavour', () => {
    const G = rawSetup()
    placeBid({ G, playerID: '3', events: noEvents }, 5)
    expect(G.bids['3']).toBe(5)
    expect(G.nilKind['3']).toBeNull()
  })

  it('rejects out-of-range and non-integer bids, leaving state untouched', () => {
    for (const bad of [-1, 14, 2.5]) {
      const G = rawSetup()
      expect(placeBid({ G, playerID: '3', events: noEvents }, bad)).toBe(INVALID_MOVE)
      expect(G.bids['3']).toBeNull()
    }
  })

  it('rejects a second bid from the same player', () => {
    const G = rawSetup()
    placeBid({ G, playerID: '3', events: noEvents }, 4)
    expect(placeBid({ G, playerID: '3', events: noEvents }, 5)).toBe(INVALID_MOVE)
    expect(G.bids['3']).toBe(4)
  })
})

describe('blind nil + exchange', () => {
  it('declares blind nil and swaps three cards with the partner', () => {
    const G = rawSetup()
    const bidder: PlayerID = '3' // West bids first
    const partner: PlayerID = '1' // West's partner is East
    const give = G.hands[bidder].slice(0, 3).map((c) => c.id)

    blindNil({ G, playerID: bidder })
    expect(G.bids[bidder]).toBe(0)
    expect(G.nilKind[bidder]).toBe('blindnil')
    expect(G.awaitingExchange).toBe(bidder)

    expect(exchangeBlind({ G, playerID: bidder, events: noEvents }, give)).not.toBe(INVALID_MOVE)

    expect(G.awaitingExchange).toBeNull()
    // Both hands stay at 13.
    expect(G.hands[bidder]).toHaveLength(13)
    expect(G.hands[partner]).toHaveLength(13)
    // The three given cards left the bidder and reached the partner.
    for (const id of give) {
      expect(G.hands[bidder].map((c) => c.id)).not.toContain(id)
      expect(G.hands[partner].map((c) => c.id)).toContain(id)
    }
    expect(G.blindPass[bidder].map((c) => c.id)).toEqual(give)
    // No card is duplicated or lost across the two hands after the swap.
    const both = [...G.hands[bidder], ...G.hands[partner]].map((c) => c.id)
    expect(new Set(both).size).toBe(26)
  })

  it('rejects blind nil when the house rule is disabled', () => {
    const G = rawSetup('fixed', false)
    expect(blindNil({ G, playerID: '3' })).toBe(INVALID_MOVE)
    expect(G.bids['3']).toBeNull()
    expect(G.awaitingExchange).toBeNull()
  })

  it('rejects an exchange that is not exactly three owned cards', () => {
    const G = rawSetup()
    blindNil({ G, playerID: '3' })
    const two = G.hands['3'].slice(0, 2).map((c) => c.id)
    expect(exchangeBlind({ G, playerID: '3', events: noEvents }, two)).toBe(INVALID_MOVE)
    expect(G.awaitingExchange).toBe('3')
  })

  it('rejects an exchange of cards the bidder does not hold', () => {
    const G = rawSetup()
    blindNil({ G, playerID: '3' })
    // Cards from the partner's hand are not the bidder's to pass.
    const owned = new Set(G.hands['3'].map((c) => c.id))
    const foreign = G.hands['1'].filter((c) => !owned.has(c.id)).slice(0, 3).map((c) => c.id)
    expect(foreign).toHaveLength(3)
    expect(exchangeBlind({ G, playerID: '3', events: noEvents }, foreign)).toBe(INVALID_MOVE)
    expect(G.awaitingExchange).toBe('3')
  })
})

describe('playerView redaction', () => {
  it('keeps only the viewer’s hand and exposes counts for the rest', () => {
    const G = rawSetup()
    const view = stripSecrets(G, '3')
    expect(view.hands['3']).toHaveLength(13)
    for (const p of PIDS) {
      if (p !== '3') expect(view.hands[p]).toHaveLength(0)
      expect(view.handCounts[p]).toBe(13)
    }
  })

  it('a null spectator sees no hands but still sees counts', () => {
    const G = rawSetup()
    const view = stripSecrets(G, null)
    for (const p of PIDS) {
      expect(view.hands[p]).toHaveLength(0)
      expect(view.handCounts[p]).toBe(13)
    }
  })

  it('is applied by the boardgame.io client for a seated player', () => {
    const client = Client<SpadesState>({
      game: { ...SpadesGame, seed: 'fixed' },
      numPlayers: 4,
      playerID: '3',
    })
    client.start()
    const s = client.getState()
    if (!s) throw new Error('no state')
    // Client filters through playerView: only seat '3' sees a full hand.
    expect(s.G.hands['3']).toHaveLength(13)
    expect(s.G.hands['0']).toHaveLength(0)
  })
})

// ---- T5: play phase ----

/** Build a card from its id, e.g. "10H" → { rank:'10', suit:'H', id:'10H' }. */
function c(id: string): Card {
  return { suit: id.slice(-1) as Suit, rank: id.slice(0, -1) as Card['rank'], id }
}

/** A controlled play-phase state: only the given hands/trick, nothing else in flight. */
function playState(opts: {
  hands: Partial<Record<PlayerID, Card[]>>
  trick?: Trick
  spadesBroken?: boolean
}): SpadesState {
  const G = rawSetup()
  G.hands = { '0': [], '1': [], '2': [], '3': [], ...opts.hands }
  G.currentTrick = opts.trick ?? newTrick('0')
  G.tricks = { NS: 0, EW: 0 }
  G.tricksByPlayer = { '0': 0, '1': 0, '2': 0, '3': 0 }
  G.spadesBroken = opts.spadesBroken ?? false
  return G
}

/** A trick already led in `suit` by seat '0'. */
function ledTrick(suit: Suit, leadCard: Card): Trick {
  return { leader: '0', suitLed: suit, cards: { '0': leadCard, '1': null, '2': null, '3': null } }
}

describe('playCard follow-suit', () => {
  it('rejects an off-suit card while the led suit is still held', () => {
    const G = playState({ hands: { '3': [c('2H'), c('3C')] }, trick: ledTrick('H', c('KH')) })
    expect(playCard({ G, playerID: '3' }, c('3C'))).toBe(INVALID_MOVE)
    expect(G.hands['3']).toHaveLength(2) // state untouched on a rejected move
    expect(playCard({ G, playerID: '3' }, c('2H'))).not.toBe(INVALID_MOVE)
    expect(G.currentTrick.cards['3']?.id).toBe('2H')
  })

  it('lets a void seat play any card, including a trump', () => {
    const G = playState({ hands: { '3': [c('3C'), c('AS')] }, trick: ledTrick('H', c('KH')) })
    expect(playCard({ G, playerID: '3' }, c('AS'))).not.toBe(INVALID_MOVE)
    expect(G.currentTrick.cards['3']?.id).toBe('AS')
  })
})

describe('breaking spades', () => {
  it('forbids leading a spade before spades are broken', () => {
    const G = playState({ hands: { '0': [c('AS'), c('2H')] } })
    expect(playCard({ G, playerID: '0' }, c('AS'))).toBe(INVALID_MOVE)
    expect(playCard({ G, playerID: '0' }, c('2H'))).not.toBe(INVALID_MOVE)
  })

  it('allows leading a spade when the hand is all spades', () => {
    const G = playState({ hands: { '0': [c('AS'), c('KS')] } })
    expect(playCard({ G, playerID: '0' }, c('AS'))).not.toBe(INVALID_MOVE)
  })

  it('allows leading a spade once broken', () => {
    const G = playState({ hands: { '0': [c('AS'), c('2H')] }, spadesBroken: true })
    expect(playCard({ G, playerID: '0' }, c('AS'))).not.toBe(INVALID_MOVE)
  })

  it('breaks spades when a spade is played off-suit', () => {
    const G = playState({ hands: { '0': [c('2H')], '3': [c('AS')] } })
    playCard({ G, playerID: '0' }, c('2H')) // heart lead
    expect(G.spadesBroken).toBe(false)
    playCard({ G, playerID: '3' }, c('AS')) // void in hearts → trumps in
    expect(G.spadesBroken).toBe(true)
  })
})

describe('resolveTrick winner', () => {
  it('the highest spade beats any non-spade', () => {
    const t: Trick = {
      leader: '0',
      suitLed: 'H',
      cards: { '0': c('KH'), '1': c('3H'), '2': c('AH'), '3': c('2S') },
    }
    expect(resolveTrick(t)).toBe('3')
  })

  it('the highest of the led suit wins when no spade is played', () => {
    const t: Trick = {
      leader: '0',
      suitLed: 'H',
      cards: { '0': c('KH'), '1': c('3H'), '2': c('AH'), '3': c('9C') },
    }
    expect(resolveTrick(t)).toBe('2')
  })

  it('an off-suit non-spade cannot win even at high rank', () => {
    const t: Trick = {
      leader: '0',
      suitLed: 'D',
      cards: { '0': c('2D'), '1': c('AC'), '2': c('AH'), '3': c('KC') },
    }
    expect(resolveTrick(t)).toBe('0')
  })

  it('among several spades the highest wins', () => {
    const t: Trick = {
      leader: '0',
      suitLed: 'H',
      cards: { '0': c('KH'), '1': c('2S'), '2': c('QS'), '3': c('5S') },
    }
    expect(resolveTrick(t)).toBe('2')
  })
})

describe('trick completion', () => {
  it('counts the trick to the winner and hands them the next lead', () => {
    const G = playState({
      hands: { '0': [c('KH')], '3': [c('2S')], '2': [c('AH')], '1': [c('3H')] },
    })
    // Clockwise from leader '0': 0 → 3 → 2 → 1.
    playCard({ G, playerID: '0' }, c('KH'))
    playCard({ G, playerID: '3' }, c('2S'))
    playCard({ G, playerID: '2' }, c('AH'))
    playCard({ G, playerID: '1' }, c('3H'))

    expect(G.tricksByPlayer['3']).toBe(1) // the lone spade takes it
    expect(G.tricks.EW).toBe(1)
    expect(G.tricks.NS).toBe(0)
    expect(G.currentTrick.leader).toBe('3') // winner leads next
    expect(G.currentTrick.cards['0']).toBeNull() // fresh trick
    for (const p of PIDS) expect(G.hands[p]).toHaveLength(0)
  })
})

describe('winner reveal + played tracking', () => {
  it('records the played pile and snapshots the finished trick with its winner', () => {
    const G = playState({
      hands: { '0': [c('KH')], '3': [c('2S')], '2': [c('AH')], '1': [c('3H')] },
    })
    playCard({ G, playerID: '0' }, c('KH'))
    expect(G.played.map((x) => x.id)).toEqual(['KH'])
    expect(G.lastTrick).toBeNull()

    playCard({ G, playerID: '3' }, c('2S'))
    playCard({ G, playerID: '2' }, c('AH'))
    playCard({ G, playerID: '1' }, c('3H'))

    expect(G.played).toHaveLength(4)
    expect(G.lastTrick?.winner).toBe('3') // the lone spade took it
    expect(G.lastTrick?.cards['2'].id).toBe('AH')
    expect(G.lastTrick?.suitLed).toBe('H')
  })

  it('clears the reveal snapshot once the next lead is played', () => {
    const G = playState({
      hands: {
        '0': [c('KH')],
        '3': [c('2S'), c('6C')],
        '2': [c('AH')],
        '1': [c('3H')],
      },
    })
    // First trick: '3' trumps in and wins.
    playCard({ G, playerID: '0' }, c('KH'))
    playCard({ G, playerID: '3' }, c('2S'))
    playCard({ G, playerID: '2' }, c('AH'))
    playCard({ G, playerID: '1' }, c('3H'))
    expect(G.lastTrick).not.toBeNull()

    // Winner '3' leads the next trick → the reveal ends.
    playCard({ G, playerID: '3' }, c('6C'))
    expect(G.lastTrick).toBeNull()
  })
})

describe('play phase (integration)', () => {
  it('transitions from bidding to playing, led by the seat left of the dealer', () => {
    const client = Client<SpadesState>({ game: { ...SpadesGame, seed: 'fixed' }, numPlayers: 4 })
    client.start()
    for (let i = 0; i < 4; i++) client.moves.placeBid(3)

    const s = client.getState()
    if (!s) throw new Error('no state')
    expect(s.ctx.phase).toBe('playing')
    expect(leftOf('0')).toBe('3')
    expect(s.ctx.currentPlayer).toBe('3')
  })
})

describe('a full 13-trick hand', () => {
  it('plays out legally, the winner leads each trick, and all 13 tricks resolve', () => {
    const G = rawSetup('fixed')
    let plays = 0

    while (G.tricks.NS + G.tricks.EW < 13) {
      const trick = G.currentTrick
      const pos = PIDS.filter((p) => trick.cards[p] !== null).length // 0..3
      const seat = CLOCKWISE_PLAYERS[(CLOCKWISE_PLAYERS.indexOf(trick.leader) + pos) % 4]
      const legal = legalPlaysFor(G.hands[seat], trick, G.spadesBroken)
      expect(legal.length).toBeGreaterThan(0)

      const card = legal[0]
      const before = { ...trick.cards }
      expect(playCard({ G, playerID: seat }, card)).not.toBe(INVALID_MOVE)
      plays += 1

      if (pos === 3) {
        // The trick just resolved: whoever won must be seated to lead next.
        before[seat] = card
        const winner = resolveTrick({ leader: trick.leader, suitLed: trick.suitLed, cards: before })
        expect(G.currentTrick.leader).toBe(winner)
      }
    }

    expect(plays).toBe(52)
    expect(G.tricks.NS + G.tricks.EW).toBe(13)
    expect(PIDS.reduce((n, p) => n + G.tricksByPlayer[p], 0)).toBe(13)
    for (const p of PIDS) expect(G.hands[p]).toHaveLength(0)
  })
})

describe('scoring + game loop (integration)', () => {
  it('runs full hands to a 200-point winner, rotating the dealer and re-dealing', () => {
    // Drive the real boardgame.io client through whole hands. An identity
    // playerView lets this single master client read every seat's cards.
    const game = { ...SpadesGame, seed: 'game-1', playerView: ({ G }: { G: SpadesState }) => G }
    const client = Client<SpadesState>({ game, numPlayers: 4 })
    client.start()

    const dealersSeen = new Set<PlayerID>()
    let guard = 0
    for (; guard < 20000; guard++) {
      const s = client.getState()
      if (!s || s.ctx.gameover) break

      dealersSeen.add(s.G.dealer)
      const cur = s.ctx.currentPlayer as PlayerID
      if (s.ctx.phase === 'bidding') {
        client.moves.placeBid(3) // team contract 6 → one side always makes
      } else if (s.ctx.phase === 'playing') {
        const legal = legalPlaysFor(s.G.hands[cur], s.G.currentTrick, s.G.spadesBroken)
        client.moves.playCard(legal[0])
      } else {
        break
      }
    }

    const end = client.getState()
    if (!end) throw new Error('no state')
    expect(guard).toBeLessThan(20000) // terminated, not spun out
    expect(end.ctx.gameover).toBeDefined()

    const winner = end.ctx.gameover.winner as Team
    const loser: Team = winner === 'NS' ? 'EW' : 'NS'
    expect(['NS', 'EW']).toContain(winner)
    expect(end.G.score[winner]).toBeGreaterThanOrEqual(200)
    expect(end.G.score[winner]).toBeGreaterThan(end.G.score[loser]) // never an exact tie
    expect(end.G.handNumber).toBeGreaterThan(1) // several hands played
    expect(dealersSeen.size).toBeGreaterThan(1) // dealer rotated between hands
  })
})
