// Bidding advice — shared by the AI bots and (in T8) the Coach. Pure: it reads a
// hand and a little table context and returns a legal bid (0..13, 0 = Nil) plus a
// human-readable reason. Heuristics per `mem:spades_strategy` §Hand evaluation.

import type { Card, Team, Tier } from '../types'
import { evaluateHand } from './handEval'
import { rankValue } from '../game/deck'

/** Optional table context that sharpens higher-tier bids. */
export interface BidContext {
  /** Running score per team, for catch-up / setting decisions. */
  score?: Record<Team, number>
  /** Which team the bidder is on (used with `score`). */
  team?: Team
}

export interface BidSuggestion {
  /** A legal bid: 0 = Nil, 1..13 = tricks. */
  bid: number
  /** Why this bid — consumed by the Coach and shown to the player. */
  reasoning: string
}

const clampBid = (n: number): number => Math.max(1, Math.min(13, n))

/**
 * A conservative Nil profile: nothing that is likely to win a trick — no
 * non-spade above 9, no spade above 8, few spades, and a short suit to duck into.
 */
export function isNilHand(hand: readonly Card[]): boolean {
  const evaln = evaluateHand(hand)
  const noWinners = hand.every((c) =>
    c.suit === 'S' ? rankValue(c.rank) <= 8 : rankValue(c.rank) <= 9,
  )
  const shortSuit = evaln.voids.length > 0 || hasNearVoid(hand)
  return noWinners && evaln.spadesLength <= 3 && shortSuit
}

function hasNearVoid(hand: readonly Card[]): boolean {
  const counts: Record<string, number> = { S: 0, H: 0, D: 0, C: 0 }
  for (const c of hand) counts[c.suit] += 1
  return (['H', 'D', 'C'] as const).some((s) => counts[s] > 0 && counts[s] <= 2)
}

/** Suggest a bid for `hand` at the given difficulty `tier`. */
export function suggestBid(hand: readonly Card[], tier: Tier, ctx: BidContext = {}): BidSuggestion {
  const evaln = evaluateHand(hand)
  const sure = evaln.sureTricks
  const rounded = Math.round(sure)

  if (tier === 'expert' && isNilHand(hand)) {
    return {
      bid: 0,
      reasoning: `Nil: no card above a 9 outside a short spade holding (${evaln.spadesLength} spades) and a suit to duck — a clean shot at zero tricks (+100).`,
    }
  }

  if (tier === 'beginner') {
    const bid = clampBid(rounded)
    return {
      bid,
      reasoning: `Counting sure tricks (~${sure.toFixed(1)}: aces/kings/queens plus long spades) → bid ${bid}.`,
    }
  }

  // Intermediate & Expert: shade strong hands down a trick (a set costs far more
  // than an extra bag) and never bid below the trick count you can defend.
  let bid = rounded
  if (sure >= 4) bid = rounded - 1
  bid = clampBid(bid)

  const behind =
    tier === 'expert' && ctx.score && ctx.team
      ? ctx.score[ctx.team] < ctx.score[ctx.team === 'NS' ? 'EW' : 'NS'] - 100
      : false
  if (behind) bid = clampBid(bid + 1)

  const shade = sure >= 4 ? ' (shaded down one — sets are costly)' : ''
  const push = behind ? ' (pushed up one to chase the deficit)' : ''
  return {
    bid,
    reasoning: `~${sure.toFixed(1)} expected tricks → bid ${bid}${shade}${push}.`,
  }
}
