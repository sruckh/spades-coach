// The Tutor curriculum: five progressive lessons, each a short explanation plus a
// scripted, engine-driven drill. Pure data — the runner (`drillRunner.ts`) turns a
// drill into a playable board and grades it with the REAL engine/analysis (no
// duplicated rules). Content from `mem:spades_rules` + `mem:spades_strategy`.

import type { Bid, NilKind, PlayerID, Suit, Team } from '../types'

/** Bid drill: enter a number; graded against `suggestBid` within `tolerance`. */
export interface BidDrill {
  kind: 'bid'
  seed: string
  scenario: string
  prompt: string
  /** Allowed distance from the book bid (default 1). */
  tolerance?: number
}

/** Play drill: pick a card from the dealt South hand into a scripted trick. */
export interface PlayDrill {
  kind: 'play'
  seed: string
  scenario: string
  prompt: string
  /** Led suit: a suit, `'longest'` (South's longest — guarantees a follow), or null (South leads). */
  led: Suit | 'longest' | null
  /** How many cards are already on the table when South acts (0..3). */
  onTable?: number
  spadesBroken?: boolean
  /** `'legal'` = any legal card passes; `'ideal'` = must match `suggestPlay`. */
  mode: 'legal' | 'ideal'
  /** Optional scripted contract context so bag-awareness (`suggestPlay`) engages. */
  bids?: Record<PlayerID, Bid>
  tricksByPlayer?: Record<PlayerID, number>
}

/** Score drill: enter this team's hand score; graded against `scoreHand`. */
export interface ScoreDrill {
  kind: 'score'
  seed: string
  scenario: string
  prompt: string
  setup: {
    bids: Record<PlayerID, Bid>
    nilKind?: Record<PlayerID, NilKind>
    tricksByPlayer: Record<PlayerID, number>
    bags: Record<Team, number>
    /** Which partnership the learner is scoring. */
    team: Team
  }
}

export type Drill = BidDrill | PlayDrill | ScoreDrill

export interface Lesson {
  id: string
  title: string
  body: string
  drill: Drill
}

const noNil: Record<PlayerID, NilKind> = { '0': null, '1': null, '2': null, '3': null }

export const CURRICULUM: Lesson[] = [
  {
    id: 'basics',
    title: 'Basics',
    body: 'Spades has four suits; spades are always trump. You must follow the suit that was led if you can — only when you are void may you trump or discard. Thirteen tricks make a hand.',
    drill: {
      kind: 'play',
      seed: 'tutor-basics',
      scenario: 'An opponent leads your longest side suit.',
      prompt: 'Follow suit: play a legal card.',
      led: 'longest',
      onTable: 1,
      spadesBroken: false,
      mode: 'legal',
    },
  },
  {
    id: 'bidding',
    title: 'Bidding',
    body: 'Count your sure tricks: aces ≈ 1, kings ≈ ¾, queens ≈ ½, plus about one extra per spade beyond the fourth. Bid the floor you can defend — a set costs far more than a bag. Bid 0 for Nil on a hand with no likely winners.',
    drill: {
      kind: 'bid',
      seed: 'tutor-bidding',
      scenario: 'You are dealt a fresh hand.',
      prompt: 'How many tricks do you bid? (0 = Nil)',
      tolerance: 1,
    },
  },
  {
    id: 'scoring',
    title: 'Scoring',
    body: 'Make your contract for +10 per bid trick; every overtrick is a +1 bag, and each 10 cumulative bags costs −100. A set scores 0. Nil is ±100, Blind Nil ±200.',
    drill: {
      kind: 'score',
      seed: 'tutor-scoring',
      scenario: 'Your side (N/S) bid 4 and took 6 tricks, sitting on 8 bags already.',
      prompt: 'What does this hand score for N/S?',
      setup: {
        bids: { '0': 2, '1': 3, '2': 2, '3': 3 },
        nilKind: noNil,
        tricksByPlayer: { '0': 3, '1': 3, '2': 3, '3': 4 },
        bags: { NS: 8, EW: 0 },
        team: 'NS',
      },
    },
  },
  {
    id: 'tactics',
    title: 'Play tactics',
    body: 'Second hand plays low — make the opponents spend a winner before your partner has to. Third hand plays high; fourth hand wins as cheaply as it can. Do not lead spades until they are broken.',
    drill: {
      kind: 'play',
      seed: 'tutor-tactics',
      scenario: 'The trick is led into you in second seat.',
      prompt: 'Second seat — pick the smart card.',
      led: 'longest',
      onTable: 1,
      spadesBroken: true,
      mode: 'ideal',
    },
  },
  {
    id: 'advanced',
    title: 'Advanced',
    body: 'Once your side has its contract in hand, stop taking tricks — extra tricks are bags that creep toward a −100 penalty. Dump low and hand the leftovers to the opponents. Set overbidders by hoarding your winners.',
    drill: {
      kind: 'play',
      seed: 'tutor-advanced',
      scenario: 'Your side has already made its bid; a trick comes to you.',
      prompt: 'Protect your bag count — what do you play?',
      led: 'longest',
      onTable: 2,
      spadesBroken: true,
      mode: 'ideal',
      bids: { '0': 1, '1': 3, '2': 1, '3': 3 },
      tricksByPlayer: { '0': 1, '1': 2, '2': 2, '3': 2 },
    },
  },
]

/** Lookup a lesson by id. */
export function lessonById(id: string): Lesson | undefined {
  return CURRICULUM.find((l) => l.id === id)
}
