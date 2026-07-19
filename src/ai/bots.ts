// Three difficulty tiers of Spades bot, each extending boardgame.io's `Bot`.
// They never re-derive rules: legal moves come from `analysis/legalPlays`, and
// choices come from the shared `suggestBid` / `suggestPlay` helpers (the same
// brains the Coach uses). Choices are fully deterministic, so a given seed +
// tier always reproduces the same game. Tuning per `mem:spades_strategy`.

import { Bot } from 'boardgame.io/ai'
import type { Ctx, State } from 'boardgame.io'
import type { PlayerID, Tier } from '../types'
import { teamOf } from '../types'
import type { SpadesState } from '../game/Spades'
import { legalPlays } from '../analysis/legalPlays'
import { suggestBid } from '../analysis/suggestBid'
import { suggestPlay } from '../analysis/suggestPlay'

/** A candidate move in boardgame.io's `{ move, args }` shape. */
export interface SpadesMove {
  move: 'placeBid' | 'playCard'
  args: unknown[]
}

/**
 * Enumerate the current player's legal moves. Bidding offers every legal bid
 * (0..13); playing offers exactly the legal cards. Shared as the bots' `enumerate`
 * and re-usable as the game's `ai.enumerate` for the framework / debug panel.
 */
export function enumerateMoves(G: SpadesState, ctx: Ctx, playerID?: string): SpadesMove[] {
  const pid = (playerID ?? ctx.currentPlayer) as PlayerID

  if (ctx.phase === 'bidding') {
    if (G.bids[pid] !== null) return []
    return Array.from({ length: 14 }, (_, n) => ({ move: 'placeBid', args: [n] }))
  }
  if (ctx.phase === 'playing') {
    return legalPlays(G.hands[pid], G.currentTrick, G.spadesBroken).map((card) => ({
      move: 'playCard',
      args: [card],
    }))
  }
  return []
}

// ---- pacing (UI only) ----------------------------------------------------
// The Local master fires each bot move ~100ms after the previous state change,
// which makes tricks flash by. We add a small, human-followable delay *inside*
// the bot so each card lands visibly and a finished trick lingers on its winner
// before the next lead. Off by default (0ms) so tests stay instant; the app
// turns it on from the speed setting via `setBotPacing`.
let pacing = { move: 0, reveal: 0 }

/** Set the per-move and post-trick (winner-reveal) bot delays, in ms. */
export function setBotPacing(move: number, reveal: number): void {
  pacing = { move, reveal }
}

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()

const trickIsEmpty = (G: SpadesState): boolean =>
  !Object.values(G.currentTrick.cards).some(Boolean)

type BotState = { G: SpadesState; ctx: Ctx }
type EnumerateFn = ConstructorParameters<typeof Bot>[0]['enumerate']
type BotAction = ReturnType<Bot['enumerate']>[number]

/** Shared bot: picks a move via the analysis helpers, then maps it to a framework action. */
abstract class SpadesBot extends Bot {
  protected abstract readonly tier: Tier

  constructor(seed?: string | number) {
    super({ enumerate: enumerateMoves as unknown as EnumerateFn, seed })
  }

  async play(state: State, playerID: string): Promise<{ action: BotAction }> {
    const { G, ctx } = state as unknown as BotState
    const pid = playerID as PlayerID
    // Wrapped actions, in the same order enumerateMoves produced them.
    const actions = this.enumerate(G, ctx, pid)

    let index: number
    if (ctx.phase === 'bidding') {
      const { bid } = suggestBid(G.hands[pid], this.tier, { score: G.score, team: teamOf(pid) })
      index = bid // candidates are bids 0..13 in order
    } else {
      const legal = legalPlays(G.hands[pid], G.currentTrick, G.spadesBroken)
      const { card } = suggestPlay(
        {
          hand: G.hands[pid],
          trick: G.currentTrick,
          spadesBroken: G.spadesBroken,
          playerID: pid,
          bids: G.bids,
          tricksByPlayer: G.tricksByPlayer,
          played: G.played,
        },
        this.tier,
      )
      index = legal.findIndex((c) => c.id === card.id)

      // Pace the move so the human can follow: a longer beat when leading right
      // after a finished trick (so its winner reveal lingers), else a short beat.
      const revealing = G.lastTrick !== null && trickIsEmpty(G)
      await sleep(revealing ? pacing.reveal : pacing.move)
    }

    return { action: actions[index] }
  }
}

export class BeginnerBot extends SpadesBot {
  protected readonly tier: Tier = 'beginner'
}

export class IntermediateBot extends SpadesBot {
  protected readonly tier: Tier = 'intermediate'
}

export class ExpertBot extends SpadesBot {
  protected readonly tier: Tier = 'expert'
}

/** Construct the bot for a difficulty tier (optionally seeded). */
export function makeBot(tier: Tier, seed?: string | number): SpadesBot {
  if (tier === 'beginner') return new BeginnerBot(seed)
  if (tier === 'intermediate') return new IntermediateBot(seed)
  return new ExpertBot(seed)
}
