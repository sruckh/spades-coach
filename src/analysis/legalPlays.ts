// Pure legal-move rules — the single source of truth shared by UI highlighting
// and the AI bots. Framework-free (type-only imports). This mirrors the play
// rules the engine enforces in its `playCard` reducer; a test cross-checks the
// two so they never drift. See `mem:spades_rules` §Play.

import type { Card, PlayerID, Suit } from '../types'

/** The public shape of the trick a play decision needs (leader is irrelevant here). */
export interface TrickLike {
  suitLed: Suit | null
  cards: Record<PlayerID, Card | null>
}

const SEATS: readonly PlayerID[] = ['0', '1', '2', '3']

/** How many seats have already played into the trick (0 = this seat leads). */
export function seatsPlayed(trick: TrickLike): number {
  return SEATS.reduce((n, p) => n + (trick.cards[p] ? 1 : 0), 0)
}

/**
 * The cards a hand may legally play into `trick`.
 * - Leading: any card, except a spade before spades are broken — unless the hand
 *   is all spades (then a spade lead is forced and allowed).
 * - Following: must follow the led suit when holding it; otherwise any card.
 */
export function legalPlays(
  hand: readonly Card[],
  trick: TrickLike,
  spadesBroken: boolean,
): Card[] {
  const leading = seatsPlayed(trick) === 0

  if (leading) {
    if (spadesBroken || hand.every((c) => c.suit === 'S')) return [...hand]
    const nonSpades = hand.filter((c) => c.suit !== 'S')
    return nonSpades.length > 0 ? nonSpades : [...hand]
  }

  const inSuit = hand.filter((c) => c.suit === trick.suitLed)
  return inSuit.length > 0 ? inSuit : [...hand]
}
