// Feature coverage for the three UI additions: (1) the official-rules overlay
// opened from the Options screen, (2) the win/lose game-over animation, and
// (3) the Play Again / Exit modal that follows it. GameOver is exercised
// directly (reduced motion → the result menu appears without relying on the
// full 200-point game loop) and once through SpadesBoard to prove the mount
// condition (gameover + final summary dismissed).

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ctx } from 'boardgame.io'
import type { SpadesView } from '../src/game/Spades'
import { scoreHandBreakdown } from '../src/game/scoring'
import { SpadesBoard } from '../src/ui/SpadesBoard'
import { OptionsModal } from '../src/ui/OptionsModal'
import { GameOver } from '../src/ui/GameOver'
import { useUiStore, DEFAULT_SETTINGS } from '../src/store/useUiStore'

beforeEach(() => {
  useUiStore.setState({
    optionsOpen: true,
    coachOpen: false,
    whisperText: null,
    selectedCard: null,
    lastHandSeen: null,
    rulesOpen: false,
    gameKey: 0,
    exited: false,
    settings: DEFAULT_SETTINGS,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const noMoves = () => ({
  playCard: vi.fn(),
  placeBid: vi.fn(),
  blindNil: vi.fn(),
  exchangeBlind: vi.fn(),
})

describe('Options screen — official rules overlay', () => {
  it('opens a scrollable rules dialog and closes it', () => {
    render(<OptionsModal />)
    // Initially only the options dialog is present — no rules dialog.
    expect(screen.queryByTestId('rules')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /How to play/i }))
    const rules = screen.getByTestId('rules')
    expect(rules).toBeTruthy()
    expect(rules.getAttribute('aria-modal')).toBe('true')
    // The body scrolls.
    expect(rules.querySelector('.rules-body')).toBeTruthy()
    expect(screen.getByText(/Spades are always trump/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close rules' }))
    expect(screen.queryByTestId('rules')).toBeNull()
  })

  it('Escape closes the rules overlay', () => {
    render(<OptionsModal />)
    fireEvent.click(screen.getByRole('button', { name: /How to play/i }))
    expect(screen.getByTestId('rules')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('rules')).toBeNull()
  })
})

describe('GameOver — animation + Play Again / Exit', () => {
  it('win: shows the win headline plus the result menu, and Play Again restarts', async () => {
    render(<GameOver win={true} reduced={true} />)
    expect(screen.getByText('You win!')).toBeTruthy()

    const playAgain = await screen.findByRole('button', { name: 'Play Again' }, { timeout: 2000 })
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy()

    // Play Again bumps the gameKey (App remounts a fresh match) and clears the
    // ephemeral view state from the finished game.
    expect(useUiStore.getState().gameKey).toBe(0)
    fireEvent.click(playAgain)
    expect(useUiStore.getState().gameKey).toBe(1)
    expect(useUiStore.getState().lastHandSeen).toBeNull()
    expect(useUiStore.getState().exited).toBe(false)
  })

  it('lose: shows the lose headline', async () => {
    render(<GameOver win={false} reduced={true} />)
    expect(screen.getByText('You lost')).toBeTruthy()
    await screen.findByRole('button', { name: 'Play Again' }, { timeout: 2000 })
  })

  it('Exit attempts to close and falls back to the goodbye screen', async () => {
    // jsdom's window.close is a no-op, so the 450ms fallback should fire.
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})
    render(<GameOver win={true} reduced={true} />)
    const exit = await screen.findByRole('button', { name: 'Exit' }, { timeout: 2000 })
    fireEvent.click(exit)
    expect(closeSpy).toHaveBeenCalled()
    await waitFor(() => expect(useUiStore.getState().exited).toBe(true), { timeout: 2000 })
    closeSpy.mockRestore()
  })
})

// ---- board integration: the overlay mounts once the final summary is dismissed ----
function gameoverView(lastHandNumber = 9): SpadesView {
  const bids = { '0': 4, '1': 3, '2': 2, '3': 2 }
  const tricksByPlayer = { '0': 4, '1': 3, '2': 3, '3': 3 }
  const nilKind = { '0': null, '1': null, '2': null, '3': null }
  const bags = { NS: 0, EW: 1 }
  // A real LastHand (team-keyed breakdown + handNumber) so HandSummary renders.
  const breakdown = scoreHandBreakdown({ bids, tricksByPlayer, nilKind, bags })
  return {
    hands: { '0': [], '1': [], '2': [], '3': [] },
    handCounts: { '0': 0, '1': 0, '2': 0, '3': 0 },
    bids,
    nilKind,
    blindPass: { '0': [], '1': [], '2': [], '3': [] },
    awaitingExchange: null,
    allowBlindNil: true,
    currentTrick: { leader: '0', suitLed: null, cards: { '0': null, '1': null, '2': null, '3': null } },
    tricks: { NS: 7, EW: 6 },
    tricksByPlayer,
    spadesBroken: true,
    score: { NS: 210, EW: 150 },
    bags,
    dealer: '0',
    handNumber: lastHandNumber,
    played: [],
    lastTrick: null,
    lastHand: { ...breakdown, handNumber: lastHandNumber },
  }
}

const GAMEOVER_CTX = {
  numPlayers: 4,
  currentPlayer: '0',
  phase: 'playing',
  playOrder: ['0', '3', '2', '1'],
  playOrderPos: 0,
  turn: 1,
  activePlayers: null,
  gameover: { winner: 'NS' },
} as unknown as Ctx

describe('board mounts the game-over overlay', () => {
  it('shows the win overlay + Play Again after the final summary is dismissed', async () => {
    // Final summary already dismissed → HandSummary is hidden, GameOver shows.
    useUiStore.setState({ optionsOpen: false, lastHandSeen: 9 })
    const { container } = render(
      <SpadesBoard G={gameoverView(9)} ctx={GAMEOVER_CTX} moves={noMoves()} playerID="0" />,
    )
    expect(container.querySelector('.gameover.win')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Play Again' }, { timeout: 2000 }))
    expect(useUiStore.getState().gameKey).toBe(1)
  })

  it('does not show the overlay while the final score summary is still up', () => {
    useUiStore.setState({ optionsOpen: false, lastHandSeen: null })
    const { container } = render(
      <SpadesBoard G={gameoverView(9)} ctx={GAMEOVER_CTX} moves={noMoves()} playerID="0" />,
    )
    // HandSummary is showing ("Final hand"), the game-over overlay is not.
    expect(container.querySelector('.gameover')).toBeNull()
    expect(screen.getByText('Final hand')).toBeTruthy()
  })
})
