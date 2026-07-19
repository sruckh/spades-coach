// Card highlight-state derivation for the hand — the single rule here is that a
// card's on-screen state comes ONLY from the engine's `legalPlays` output, never
// from re-derived rules in the UI. `locked` = not in legalPlays; a legal spade is
// `spade` (trump ring), any other legal card is `playable`. See
// `mem:design_system` §The card and `.goals/README.md` §Layer-C.

import type { Card, Suit } from '../types'
import type { CardState } from './Card'
import type { HandCard } from './Hand'
import { legalPlays, type TrickLike } from '../analysis/legalPlays'
import { rankValue } from '../game/deck'

/** Suit order for a fanned hand: alternating colours (♠♥♣♦) so neighbouring suits
 *  never share a colour, easing at-a-glance reading. */
const HAND_SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 }

/**
 * Sort a hand for display: suits in alternating-colour order, high→low within a
 * suit. Presentation only — the engine's own hand order is never touched, and the
 * returned array is what the board also indexes into for card selection.
 */
export function sortHand(hand: readonly Card[]): Card[] {
  return [...hand].sort(
    (a, b) => HAND_SUIT_ORDER[a.suit] - HAND_SUIT_ORDER[b.suit] || rankValue(b.rank) - rankValue(a.rank),
  )
}

/** Is `card` among the engine's legal plays? Identity by stable card id. */
export function isLegalPlay(card: Card, legal: readonly Card[]): boolean {
  return legal.some((c) => c.id === card.id)
}

/** The render state for one card, decided solely by `legal` (from `legalPlays`). */
export function cardStateFor(card: Card, legal: readonly Card[]): CardState {
  if (!isLegalPlay(card, legal)) return 'locked'
  return card.suit === 'S' ? 'spade' : 'playable'
}

/**
 * Map a hand to render-ready `HandCard`s during the play phase, deriving each
 * card's state from `legalPlays(hand, trick, spadesBroken)`. The UI does not know
 * the rules — it asks the engine which cards are legal and paints the rest locked.
 */
export function deriveHandCards(
  hand: readonly Card[],
  trick: TrickLike,
  spadesBroken: boolean,
): HandCard[] {
  const legal = legalPlays(hand, trick, spadesBroken)
  return hand.map((c) => ({ rank: c.rank, suit: c.suit, id: c.id, state: cardStateFor(c, legal) }))
}

/** Idle (neutral) hand cards for the bidding phase — no play states yet. */
export function idleHandCards(hand: readonly Card[]): HandCard[] {
  return hand.map((c) => ({ rank: c.rank, suit: c.suit, id: c.id, state: 'idle' as const }))
}
