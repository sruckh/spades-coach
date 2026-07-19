// The Coach: turns the shared analysis helpers into warm, reasoned, one-decision
// advice. It CONSUMES `suggestBid` / `suggestPlay` (no duplicated rule logic) and
// only ever RETURNS advice — it never dispatches a move. Content per
// `mem:features` §Coach and `mem:design_system` §Coach.

import type { Bid, Card, PlayerID, Suit, Team, Tier } from '../types'
import { partnerOf, teamOf } from '../types'
import { seatsPlayed } from './legalPlays'
import { suggestBid } from './suggestBid'
import { suggestPlay } from './suggestPlay'
import type { PlayTrick } from './suggestPlay'

/** The decision point the Coach is asked about. */
export interface CoachState {
  tier: Tier
  playerID: PlayerID
  hand: Card[]
  phase: 'bidding' | 'playing'
  score?: Record<Team, number>
  /** Present while `phase === 'playing'`. */
  trick?: PlayTrick
  spadesBroken?: boolean
  bids?: Record<PlayerID, Bid>
  tricksByPlayer?: Record<PlayerID, number>
  bags?: Record<Team, number>
  /** Cards played so far this hand (lets the Coach spot sure winners). */
  played?: Card[]
}

/** A single piece of coaching. `suggestedAction` is advisory data — never executed here. */
export interface CoachAdvice {
  headline: string
  body: string
  tip: string
  suggestedAction?: { kind: 'bid'; bid: number } | { kind: 'play'; cardId: string }
}

const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

/** Human label for a card, e.g. "K♠". */
function label(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`
}

/** Has the player's side already reached its combined contract (so extra tricks = bags)? */
function hasMadeContract(state: CoachState): boolean {
  if (!state.bids || !state.tricksByPlayer) return false
  const seats = [state.playerID, partnerOf(state.playerID)]
  const bid = seats.reduce((s, p) => s + Math.max(0, state.bids?.[p] ?? 0), 0)
  const won = seats.reduce((s, p) => s + (state.tricksByPlayer?.[p] ?? 0), 0)
  return bid > 0 && won >= bid
}

const SEAT_NAME = ['leading', '2nd seat', '3rd seat', '4th seat'] as const

/** Give live, reasoned advice for the current decision. Read-only: never plays. */
export function coachAdvice(state: CoachState): CoachAdvice {
  if (state.phase === 'bidding') {
    const team = teamOf(state.playerID)
    const { bid, reasoning } = suggestBid(state.hand, state.tier, { score: state.score, team })
    return {
      headline: bid === 0 ? 'Go for Nil' : `Bid ${bid}`,
      body: reasoning,
      tip:
        bid === 0
          ? 'Keep your low cards to slide under every lead — one trick busts the Nil.'
          : 'Bid what you can defend: a set costs far more than an extra bag.',
      suggestedAction: { kind: 'bid', bid },
    }
  }

  // ---- playing ----
  const trick = state.trick as PlayTrick
  const spadesBroken = state.spadesBroken ?? false
  const pos = seatsPlayed(trick)
  const team = teamOf(state.playerID)
  const madeContract = hasMadeContract(state)
  const nearSandbag = (state.bags?.[team] ?? 0) >= 8

  const play = suggestPlay(
    {
      hand: state.hand,
      trick,
      spadesBroken,
      playerID: state.playerID,
      bids: state.bids,
      tricksByPlayer: state.tricksByPlayer,
      played: state.played,
    },
    // Once the contract is in, coach the bag-dodging duck regardless of the
    // player's own tier setting.
    madeContract ? 'intermediate' : state.tier,
  )
  const action = { kind: 'play', cardId: play.card.id } as const

  if (madeContract) {
    const sandbagNote = nearSandbag
      ? ' You’re also near 10 bags — another one risks a −100 penalty.'
      : ''
    return {
      headline: 'Careful — bag risk',
      body: `Your side has already made its bid, so every extra trick is just a bag.${sandbagNote} ${play.reasoning}`,
      tip: `Throw the ${label(play.card)} low and let the opponents scoop the leftovers.`,
      suggestedAction: action,
    }
  }

  if (pos === 0) {
    return {
      headline: `Lead the ${label(play.card)}`,
      body: play.reasoning,
      tip: 'Probe your long suits early; hold your winners for tricks you must take.',
      suggestedAction: action,
    }
  }

  return {
    headline: `Play the ${label(play.card)}`,
    body: `${SEAT_NAME[pos]}: ${play.reasoning}`,
    tip:
      pos === 1
        ? 'Second hand low — make the other side spend a high card first.'
        : 'Take it as cheaply as you can, or duck if your partner already has it.',
    suggestedAction: action,
  }
}
