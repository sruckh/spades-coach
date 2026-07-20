// Options modal + authentic Blind Nil. Difficulty tiers and blind nil live in the
// engine; these tests cover the UI that exposes them: the options modal writes
// settings, and the board offers a *hidden-hand* Blind Nil decision only when the
// side is behind by 100+, then dispatches the 3-card exchange.

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ctx } from 'boardgame.io'
import type { Card } from '../src/types'
import type { SpadesView } from '../src/game/Spades'
import { SpadesBoard } from '../src/ui/SpadesBoard'
import { OptionsModal } from '../src/ui/OptionsModal'
import { useUiStore, DEFAULT_SETTINGS } from '../src/store/useUiStore'

const card = (id: string): Card => ({
  suit: id.slice(-1) as Card['suit'],
  rank: id.slice(0, -1) as Card['rank'],
  id,
})

beforeEach(() => {
  useUiStore.setState({ optionsOpen: true, coachOpen: false, whisperText: null, settings: DEFAULT_SETTINGS })
})

describe('OptionsModal writes settings', () => {
  it('picking a difficulty updates the tier', () => {
    render(<OptionsModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Expert' }))
    expect(useUiStore.getState().settings.tier).toBe('expert')
  })

  it('toggles Allow Blind Nil', () => {
    render(<OptionsModal />)
    const sw = screen.getByRole('switch', { name: /Allow Blind Nil/i })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(useUiStore.getState().settings.allowBlindNil).toBe(false)
  })

  it('"Start playing" closes the modal', () => {
    render(<OptionsModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Start playing' }))
    expect(useUiStore.getState().optionsOpen).toBe(false)
  })
})

// ---- board: authentic (hidden-hand) Blind Nil + 3-card pass ----
const HAND: Card[] = ['2S', '3S', '4H', '5H', '6C', '7C', '8D', '9D', '10S', 'JS', 'QH', 'KC', 'AD'].map(card)

function biddingView(over: Partial<SpadesView> = {}): SpadesView {
  return {
    hands: { '0': HAND, '1': [], '2': [], '3': [] },
    handCounts: { '0': 13, '1': 13, '2': 13, '3': 13 },
    bids: { '0': null, '1': null, '2': null, '3': null },
    nilKind: { '0': null, '1': null, '2': null, '3': null },
    blindPass: { '0': [], '1': [], '2': [], '3': [] },
    awaitingExchange: null,
    allowBlindNil: true,
    currentTrick: { leader: '3', suitLed: null, cards: { '0': null, '1': null, '2': null, '3': null } },
    tricks: { NS: 0, EW: 0 },
    tricksByPlayer: { '0': 0, '1': 0, '2': 0, '3': 0 },
    spadesBroken: false,
    score: { NS: 0, EW: 0 },
    bags: { NS: 0, EW: 0 },
    dealer: '0',
    handNumber: 1,
    played: [],
    lastTrick: null,
    lastHand: null,
    ...over,
  }
}

const BID_CTX = {
  numPlayers: 4,
  currentPlayer: '0',
  phase: 'bidding',
  playOrder: ['0', '3', '2', '1'],
  playOrderPos: 0,
  turn: 1,
  activePlayers: null,
} as unknown as Ctx

const noMoves = () => ({ playCard: vi.fn(), placeBid: vi.fn(), blindNil: vi.fn(), exchangeBlind: vi.fn() })

/** Behind by 120 → Blind Nil is on the table. */
const behind = biddingView({ score: { NS: 0, EW: 120 } })

describe('board Blind Nil (authentic, hidden hand)', () => {
  it('offers a hidden-hand decision only when behind by 100+', () => {
    useUiStore.setState({ optionsOpen: false })
    const { container } = render(<SpadesBoard G={behind} ctx={BID_CTX} moves={noMoves()} playerID="0" />)
    // The decision buttons appear, the hand is face-down, and the number grid is hidden.
    expect(screen.getByRole('button', { name: /Blind Nil/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Look at my hand/i })).toBeTruthy()
    expect(container.querySelectorAll('.hand .pc.back').length).toBe(13)
    expect(screen.queryByRole('button', { name: 'Bid 3' })).toBeNull()
  })

  it('declaring Blind Nil dispatches moves.blindNil', () => {
    useUiStore.setState({ optionsOpen: false })
    const moves = noMoves()
    render(<SpadesBoard G={behind} ctx={BID_CTX} moves={moves} playerID="0" />)
    fireEvent.click(screen.getByRole('button', { name: /Blind Nil/i }))
    expect(moves.blindNil).toHaveBeenCalledTimes(1)
  })

  it('"Look at my hand" reveals the bid grid and drops Blind Nil', () => {
    useUiStore.setState({ optionsOpen: false })
    const { container } = render(<SpadesBoard G={behind} ctx={BID_CTX} moves={noMoves()} playerID="0" />)
    fireEvent.click(screen.getByRole('button', { name: /Look at my hand/i }))
    expect(screen.getByRole('button', { name: 'Bid 3' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Blind Nil/i })).toBeNull()
    expect(container.querySelectorAll('.hand .pc.back').length).toBe(0)
  })

  it('does not offer Blind Nil when the side is not behind 100', () => {
    useUiStore.setState({ optionsOpen: false })
    render(
      <SpadesBoard G={biddingView({ score: { NS: 0, EW: 40 } })} ctx={BID_CTX} moves={noMoves()} playerID="0" />,
    )
    expect(screen.queryByRole('button', { name: /Blind Nil/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Bid 3' })).toBeTruthy()
  })

  it('does not offer Blind Nil when the option is off', () => {
    useUiStore.setState({ optionsOpen: false, settings: { ...DEFAULT_SETTINGS, allowBlindNil: false } })
    render(<SpadesBoard G={behind} ctx={BID_CTX} moves={noMoves()} playerID="0" />)
    expect(screen.queryByRole('button', { name: /Blind Nil/i })).toBeNull()
  })

  it('passing 3 cards dispatches moves.exchangeBlind with three ids', () => {
    useUiStore.setState({ optionsOpen: false })
    const moves = noMoves()
    // Human declared blind nil: bid 0, and now owes the exchange.
    const view = biddingView({
      bids: { '0': 0, '1': null, '2': null, '3': null },
      nilKind: { '0': 'blindnil', '1': null, '2': null, '3': null },
      awaitingExchange: '0',
    })
    const { container } = render(<SpadesBoard G={view} ctx={BID_CTX} moves={moves} playerID="0" />)

    const cards = container.querySelectorAll('.hand .pc')
    expect(cards.length).toBe(13)
    fireEvent.click(cards[0])
    fireEvent.click(cards[1])
    fireEvent.click(cards[2])

    fireEvent.click(screen.getByRole('button', { name: /Pass these 3 cards/i }))
    expect(moves.exchangeBlind).toHaveBeenCalledTimes(1)
    expect(moves.exchangeBlind.mock.calls[0][0]).toHaveLength(3)
  })
})
