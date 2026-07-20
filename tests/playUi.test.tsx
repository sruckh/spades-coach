// Play-UI contract: card highlight states come ONLY from the engine's
// `legalPlays` (never hard-coded), and tapping an illegal (locked) card is blocked
// without throwing and without dispatching a move. A legal tap stages the card and
// the ActionBar confirms it via moves.playCard.

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ctx } from 'boardgame.io'
import type { Card } from '../src/types'
import { legalPlays } from '../src/analysis/legalPlays'
import type { SpadesView } from '../src/game/Spades'
import { deriveHandCards, sortHand } from '../src/ui/play'
import { SpadesBoard } from '../src/ui/SpadesBoard'
import { useUiStore, DEFAULT_SETTINGS } from '../src/store/useUiStore'

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit, id: `${rank}${suit}` })

// Human (South '0') is following a heart lead: hearts are legal, everything else
// locked. The A♠ / 3♣ / 7♦ must render locked.
const HAND0: Card[] = [card('5', 'H'), card('9', 'H'), card('A', 'S'), card('3', 'C'), card('7', 'D')]
const LED = card('K', 'H')

function makeView(): SpadesView {
  return {
    hands: { '0': HAND0, '1': [], '2': [], '3': [] },
    handCounts: { '0': 5, '1': 13, '2': 13, '3': 12 },
    bids: { '0': 3, '1': 3, '2': 2, '3': 4 },
    nilKind: { '0': null, '1': null, '2': null, '3': null },
    blindPass: { '0': [], '1': [], '2': [], '3': [] },
    awaitingExchange: null,
    allowBlindNil: true,
    currentTrick: { leader: '3', suitLed: 'H', cards: { '0': null, '1': null, '2': null, '3': LED } },
    played: [LED],
    lastTrick: null,
    lastHand: null,
    tricks: { NS: 0, EW: 0 },
    tricksByPlayer: { '0': 0, '1': 0, '2': 0, '3': 0 },
    spadesBroken: false,
    score: { NS: 0, EW: 0 },
    bags: { NS: 0, EW: 0 },
    dealer: '0',
    handNumber: 1,
  }
}

const CTX = {
  numPlayers: 4,
  currentPlayer: '0',
  phase: 'playing',
  playOrder: ['0', '3', '2', '1'],
  playOrderPos: 0,
  turn: 4,
  activePlayers: null,
} as unknown as Ctx

function renderBoard() {
  const moves = { playCard: vi.fn(), placeBid: vi.fn(), blindNil: vi.fn(), exchangeBlind: vi.fn() }
  const utils = render(<SpadesBoard G={makeView()} ctx={CTX} moves={moves} playerID="0" />)
  return { ...utils, moves }
}

beforeEach(() => {
  // Reset ephemeral UI state between renders (module-singleton store).
  useUiStore.setState({
    selectedCard: null,
    whisperText: null,
    coachOpen: false,
    optionsOpen: false,
    settings: DEFAULT_SETTINGS,
  })
})

describe('card states derive from legalPlays', () => {
  it('locks exactly the cards legalPlays excludes (not hard-coded)', () => {
    const trick = { suitLed: 'H' as const, cards: makeView().currentTrick.cards }
    const legal = legalPlays(HAND0, trick, false)
    const derived = deriveHandCards(HAND0, trick, false)

    for (const c of HAND0) {
      const d = derived.find((x) => x.id === c.id)!
      const inLegal = legal.some((l) => l.id === c.id)
      expect(d.state).toBe(inLegal ? (c.suit === 'S' ? 'spade' : 'playable') : 'locked')
    }
    // Two hearts legal → three locked.
    expect(derived.filter((d) => d.state === 'locked')).toHaveLength(HAND0.length - legal.length)
  })

  it('marks a legal spade as the trump ("spade") state, not hard-coded playable', () => {
    // Leading with spades broken: every card is legal; the spade gets the ring.
    const emptyTrick = { suitLed: null, cards: { '0': null, '1': null, '2': null, '3': null } }
    const derived = deriveHandCards(HAND0, emptyTrick, true)
    expect(derived.find((d) => d.id === 'AS')!.state).toBe('spade')
    expect(derived.find((d) => d.id === '5H')!.state).toBe('playable')
  })

  it('renders locked cards for the illegal plays in the DOM', () => {
    const { container } = renderBoard()
    // A♠, 3♣, 7♦ are locked; 5♥, 9♥ are playable.
    expect(container.querySelectorAll('.pc.locked')).toHaveLength(3)
    expect(container.querySelectorAll('.pc.playable')).toHaveLength(2)
  })
})

describe('sortHand orders the fan for reading', () => {
  it('alternates suit colours (♠♥♣♦) and runs high→low within a suit', () => {
    const shuffled = ['3C', '7D', 'AS', '5H', 'KS', '2C', 'QH', 'AD'].map((id) => ({
      rank: id.slice(0, -1) as Card['rank'],
      suit: id.slice(-1) as Card['suit'],
      id,
    }))
    expect(sortHand(shuffled).map((c) => c.id)).toEqual([
      'AS', 'KS', // spades, high→low
      'QH', '5H', // hearts
      '3C', '2C', // clubs
      'AD', '7D', // diamonds
    ])
  })

  it('does not mutate the input hand', () => {
    const hand = [card('2', 'C'), card('A', 'S')]
    const before = hand.map((c) => c.id)
    sortHand(hand)
    expect(hand.map((c) => c.id)).toEqual(before)
  })
})

describe('illegal tap is blocked', () => {
  it('does not throw and does not dispatch playCard when a locked card is tapped', () => {
    const { container, moves } = renderBoard()
    const locked = container.querySelector('.pc.locked') as HTMLElement
    expect(locked).not.toBeNull()
    expect(() => fireEvent.click(locked)).not.toThrow()
    expect(moves.playCard).not.toHaveBeenCalled()
  })
})

describe('legal tap stages then plays', () => {
  it('selecting a legal card then confirming dispatches playCard once', () => {
    const { container, moves } = renderBoard()
    const playable = container.querySelector('.pc.playable') as HTMLElement
    fireEvent.click(playable)
    // ActionBar primary becomes "Play <card>".
    const confirm = screen.getByRole('button', { name: /^Play / })
    fireEvent.click(confirm)
    expect(moves.playCard).toHaveBeenCalledTimes(1)
  })
})
