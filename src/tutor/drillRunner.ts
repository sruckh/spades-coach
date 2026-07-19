// Drill runner: turns a curriculum `Drill` into a playable board and grades the
// learner's action. Every ruling goes through the REAL engine/analysis — deal +
// legality from the engine (`setup`, `legalPlaysFor`), scoring from `scoreHand`,
// and "best move" advice from `suggestBid` / `suggestPlay`. No parallel rules.

import type { Card, PlayerID, Suit } from '../types'
import { makeRng, shuffle } from '../game/deck'
import { legalPlaysFor, newTrick, setup } from '../game/Spades'
import type { Trick } from '../game/Spades'
import { scoreHand } from '../game/scoring'
import { suggestBid } from '../analysis/suggestBid'
import { suggestPlay } from '../analysis/suggestPlay'
import type { Drill, PlayDrill } from './curriculum'

/** The learner always sits South. */
const HERO: PlayerID = '0'
const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const cardLabel = (c: Card): string => `${c.rank}${SUIT_SYMBOL[c.suit]}`

/** A deterministic `random` plugin stand-in so a seed always deals the same hand. */
function randomFor(seed: string) {
  return { Shuffle: <T>(deck: T[]): T[] => shuffle(deck, makeRng(seed)) }
}

/** Deal South's scripted hand for a drill's seed via the real engine `setup`. */
function dealHero(seed: string): Card[] {
  return setup({ random: randomFor(seed) }).hands[HERO]
}

/** South's longest suit (fixed tie order) — used by `led: 'longest'` follow drills. */
function longestSuit(hand: Card[]): Suit {
  const order: Suit[] = ['H', 'D', 'C', 'S']
  let best: Suit = order[0]
  let bestLen = -1
  for (const suit of order) {
    const len = hand.filter((c) => c.suit === suit).length
    if (len > bestLen) {
      bestLen = len
      best = suit
    }
  }
  return best
}

/** Build the scripted trick South is playing into (or leading). */
function buildTrick(drill: PlayDrill, hand: Card[]): { trick: Trick; ledSuit: Suit | null } {
  if (drill.led === null) {
    return { trick: newTrick(HERO), ledSuit: null }
  }
  const ledSuit = drill.led === 'longest' ? longestSuit(hand) : drill.led
  const trick = newTrick('3') // some opponent leads
  trick.suitLed = ledSuit

  // Place `onTable` synthetic low cards of the led suit on non-hero seats.
  const seats: PlayerID[] = ['3', '1', '2']
  const ranks: Card['rank'][] = ['4', '5', '6']
  const count = Math.min(drill.onTable ?? 1, seats.length)
  for (let i = 0; i < count; i++) {
    const rank = ranks[i]
    trick.cards[seats[i]] = { suit: ledSuit, rank, id: `${rank}${ledSuit}` }
  }
  return { trick, ledSuit }
}

export interface DrillView {
  drill: Drill
  scenario: string
  prompt: string
  /** South's hand (bid / play drills). */
  hand: Card[]
  /** The trick in progress (play drills only). */
  trick: Trick | null
  spadesBroken: boolean
  /** Engine-computed legal cards (play drills only). */
  legal: Card[]
}

/** Prepare a drill for the UI: deal the hand, script the trick, compute legal moves. */
export function loadDrill(drill: Drill): DrillView {
  const base = { drill, scenario: drill.scenario, prompt: drill.prompt }

  if (drill.kind === 'score') {
    return { ...base, hand: [], trick: null, spadesBroken: false, legal: [] }
  }

  const hand = dealHero(drill.seed)
  if (drill.kind === 'bid') {
    return { ...base, hand, trick: null, spadesBroken: false, legal: [] }
  }

  const { trick } = buildTrick(drill, hand)
  const spadesBroken = drill.spadesBroken ?? false
  const legal = legalPlaysFor(hand, trick, spadesBroken)
  return { ...base, hand, trick, spadesBroken, legal }
}

export type DrillAnswer = { bid: number } | { card: Card } | { points: number }

export interface DrillResult {
  pass: boolean
  explanation: string
  /** A short label for the model answer (shown after grading). */
  ideal?: string
}

/** Grade the learner's action with the real engine/analysis. */
export function evaluateDrill(drill: Drill, answer: DrillAnswer): DrillResult {
  if (drill.kind === 'bid') {
    const hand = dealHero(drill.seed)
    const book = suggestBid(hand, 'intermediate')
    const bid = 'bid' in answer ? answer.bid : NaN
    const pass = Math.abs(bid - book.bid) <= (drill.tolerance ?? 1)
    return {
      pass,
      ideal: `Bid ${book.bid}`,
      explanation: pass
        ? `Sound bid. ${book.reasoning}`
        : `That's off the book bid of ${book.bid}. ${book.reasoning}`,
    }
  }

  if (drill.kind === 'score') {
    const points = scoreHand({ ...drill.setup, nilKind: drill.setup.nilKind ?? emptyNil() })[
      drill.setup.team
    ].points
    const given = 'points' in answer ? answer.points : NaN
    const pass = given === points
    return {
      pass,
      ideal: `${points}`,
      explanation: pass
        ? `Correct — the engine scores this hand at ${points} for ${drill.setup.team}.`
        : `Not quite: the engine scores ${points} for ${drill.setup.team} (make + bags − sandbag).`,
    }
  }

  // ---- play ----
  const view = loadDrill(drill)
  const card = 'card' in answer ? answer.card : undefined
  if (!card) return { pass: false, explanation: 'No card chosen.' }

  const isLegal = view.legal.some((c) => c.id === card.id)
  if (!isLegal) {
    const led = view.trick?.suitLed
    const reason =
      led && view.hand.some((c) => c.suit === led)
        ? `you must follow the led suit (${SUIT_SYMBOL[led]})`
        : 'that card is not playable here (spades cannot be led until broken)'
    return { pass: false, explanation: `Illegal play — ${reason}.` }
  }

  if (drill.kind === 'play' && drill.mode === 'legal') {
    return { pass: true, explanation: `Good — the ${cardLabel(card)} follows suit and is legal.` }
  }

  // mode 'ideal': match the analysis engine's recommended card.
  const best = suggestPlay(
    {
      hand: view.hand,
      trick: view.trick as Trick,
      spadesBroken: view.spadesBroken,
      playerID: HERO,
      bids: (drill as PlayDrill).bids,
      tricksByPlayer: (drill as PlayDrill).tricksByPlayer,
    },
    'expert',
  )
  const pass = card.id === best.card.id
  return {
    pass,
    ideal: cardLabel(best.card),
    explanation: pass
      ? `Right idea — ${best.reasoning}`
      : `The stronger play is the ${cardLabel(best.card)}: ${best.reasoning}`,
  }
}

function emptyNil() {
  return { '0': null, '1': null, '2': null, '3': null } as const
}

export { cardLabel }
