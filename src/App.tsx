// App root: wires the boardgame.io React client for a single local match — the
// human is South ('0'); East/West/North ('1'/'2'/'3') are AI seats driven by the
// tier's bot. The Local master only runs bots when the game exposes `ai.enumerate`,
// so we attach it here (leaving the pure engine untouched). Difficulty comes from
// the UI store; changing it rebuilds the client for a fresh match at that tier.

import { useEffect, useMemo } from 'react'
import type { ComponentType } from 'react'
import { Client } from 'boardgame.io/react'
import type { BoardProps } from 'boardgame.io/react'
import { Local } from 'boardgame.io/multiplayer'
import type { Settings, Tier } from './types'
import { SpadesGame, type SpadesState } from './game/Spades'
import { BeginnerBot, ExpertBot, IntermediateBot, enumerateMoves, setBotPacing } from './ai/bots'
import { SpadesBoard } from './ui/SpadesBoard'
import { useUiStore } from './store/useUiStore'

// How long a bot waits before each move [per-card, post-trick winner-reveal] (ms).
// Slower speeds linger longer so the human can follow the play and see who won.
const PACING: Record<Settings['speed'], [move: number, reveal: number]> = {
  slow: [850, 1800],
  normal: [550, 1150],
  fast: [250, 550],
}

const BOT_BY_TIER = {
  beginner: BeginnerBot,
  intermediate: IntermediateBot,
  expert: ExpertBot,
} as const

// Expose `ai.enumerate` so the Local master instantiates + runs the bots. The
// engine (`SpadesGame`) stays pure; enumeration lives in the AI layer.
const game = { ...SpadesGame, ai: { enumerate: enumerateMoves } }

// SpadesBoard reads the redacted view (`SpadesView`); bridge to the framework's
// BoardProps<SpadesState> at this boundary.
const board = SpadesBoard as unknown as ComponentType<BoardProps<SpadesState>>

function makeClient(tier: Tier) {
  const Bot = BOT_BY_TIER[tier]
  return Client<SpadesState>({
    game,
    board,
    numPlayers: 4,
    multiplayer: Local({ bots: { '1': Bot, '2': Bot, '3': Bot } }),
    debug: false,
  })
}

export function App() {
  const tier = useUiStore((s) => s.settings.tier)
  const speed = useUiStore((s) => s.settings.speed)
  const gameKey = useUiStore((s) => s.gameKey)
  // Rebuild the client on difficulty change OR when Play Again / Exit bumps
  // gameKey — a fresh client + the `key` below remount a clean match.
  const SpadesClient = useMemo(() => makeClient(tier), [tier, gameKey])
  useEffect(() => {
    setBotPacing(...PACING[speed])
  }, [speed])
  return <SpadesClient key={gameKey} playerID="0" />
}
