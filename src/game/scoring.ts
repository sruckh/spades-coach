// Bicycle-rules hand scoring (pure, framework-free). Consumed by the engine's
// game loop and — later — by the Coach. No React / boardgame.io imports: the UI
// asks the engine, it never re-derives scoring. See `mem:spades_rules` §Scoring.
//
// Rules: make = +10 × contract; each overtrick ("bag") = +1 and accumulates;
// a set scores 0 (NOT -10 × bid); Nil ±100, Blind Nil ±200; every 10 cumulative
// bags = -100 (the sandbag penalty) with the remainder carried forward. A failed
// Nil's tricks become bags and never count toward the partner's contract.

import type { Bid, NilKind, PlayerID, Team } from '../types'

/** The two seats forming each partnership (N/S = 0,2 · E/W = 1,3). */
const TEAM_PLAYERS: Record<Team, readonly [PlayerID, PlayerID]> = {
  NS: ['0', '2'],
  EW: ['1', '3'],
}

const TEAMS: readonly Team[] = ['NS', 'EW']

/** Winning score / bag threshold triggering the sandbag penalty. */
export const SANDBAG_THRESHOLD = 10

/** The slice of game state hand-scoring needs (structurally satisfied by `G`). */
export interface HandForScoring {
  bids: Record<PlayerID, Bid>
  nilKind: Record<PlayerID, NilKind>
  tricksByPlayer: Record<PlayerID, number>
  /** Cumulative bags per team *before* this hand. */
  bags: Record<Team, number>
}

/** Per-team result of scoring one hand. */
export interface TeamScore {
  /** Points to add to the team's running total (may be negative). */
  points: number
  /** New cumulative bag count after applying the sandbag carry. */
  bags: number
}

/** Score a single completed hand; returns each team's point delta + new bag total. */
/** One Nil / Blind Nil outcome, kept so the summary can explain the swing. */
export interface NilResult {
  player: PlayerID
  kind: 'nil' | 'blindnil'
  tricks: number
  made: boolean
  /** Point swing this Nil caused (+100 / -100 / +200 / -200). */
  delta: number
}

/** A fully itemised per-team hand score — everything the summary UI needs to
 *  explain *how and why* the hand scored. `scoreHand` is derived from this. */
export interface TeamBreakdown {
  team: Team
  /** Combined contract for the side (Nil bids excluded). */
  bid: number
  /** Tricks the partnership took. */
  tricks: number
  /** Tricks counting toward the contract (excludes a failed Nil's tricks). */
  contractTricks: number
  /** Did the side make its contract? */
  made: boolean
  /** Points from the made contract (10 × bid, else 0). */
  contractPoints: number
  /** Overtricks kept as bags this hand. */
  overtrickBags: number
  /** Nil / Blind Nil outcomes for the side's bidders. */
  nils: NilResult[]
  /** Net Nil point swing. */
  nilPoints: number
  /** Bags gained this hand (overtricks + failed-Nil tricks). */
  bagsThisHand: number
  /** Cumulative bags before this hand, and after (post-carry). */
  bagsBefore: number
  bagsAfter: number
  /** Sandbag penalty applied this hand (≤ 0). */
  sandbagPenalty: number
  /** Net points added to the running total this hand (matches `TeamScore.points`). */
  points: number
}

/** Both teams' itemised results for one hand. */
export type HandBreakdown = Record<Team, TeamBreakdown>

/** Score one completed hand into a fully itemised, explainable breakdown. */
export function scoreHandBreakdown(G: HandForScoring): HandBreakdown {
  const result = {} as HandBreakdown

  for (const team of TEAMS) {
    const players = TEAM_PLAYERS[team]

    let contractBid = 0
    let nilPoints = 0
    let nilTricks = 0
    let teamTricks = 0
    const nils: NilResult[] = []

    for (const p of players) {
      const bid = G.bids[p] ?? 0
      const won = G.tricksByPlayer[p]
      teamTricks += won

      if (bid === 0) {
        // Nil / Blind Nil: a standalone bonus, independent of the contract.
        const kind = G.nilKind[p] === 'blindnil' ? 'blindnil' : 'nil'
        const stake = kind === 'blindnil' ? 200 : 100
        const made = won === 0
        const delta = made ? stake : -stake
        nilPoints += delta
        if (!made) nilTricks += won // failed-nil tricks fall through to the team's bags
        nils.push({ player: p, kind, tricks: won, made, delta })
      } else {
        contractBid += bid
      }
    }

    // Tricks that count toward the partnership contract exclude a nil bidder's.
    const contractTricks = teamTricks - nilTricks
    const made = contractBid > 0 && contractTricks >= contractBid
    const contractPoints = made ? 10 * contractBid : 0
    const overtrickBags = made ? contractTricks - contractBid : 0
    const bagsThisHand = overtrickBags + nilTricks

    // Sandbag: -100 per completed 10 bags; the remainder carries into next hand.
    const bagsBefore = G.bags[team]
    const totalBags = bagsBefore + bagsThisHand
    const sandbags = Math.floor(totalBags / SANDBAG_THRESHOLD)
    const sandbagPenalty = sandbags > 0 ? -sandbags * 100 : 0 // avoid -0
    const bagsAfter = totalBags % SANDBAG_THRESHOLD

    const points = contractPoints + bagsThisHand + nilPoints + sandbagPenalty

    result[team] = {
      team,
      bid: contractBid,
      tricks: teamTricks,
      contractTricks,
      made,
      contractPoints,
      overtrickBags,
      nils,
      nilPoints,
      bagsThisHand,
      bagsBefore,
      bagsAfter,
      sandbagPenalty,
      points,
    }
  }

  return result
}

/** Score a single completed hand; returns each team's point delta + new bag
 *  total. Thin wrapper over `scoreHandBreakdown` — no duplicated rule logic. */
export function scoreHand(G: HandForScoring): Record<Team, TeamScore> {
  const b = scoreHandBreakdown(G)
  return {
    NS: { points: b.NS.points, bags: b.NS.bagsAfter },
    EW: { points: b.EW.points, bags: b.EW.bagsAfter },
  }
}

/** Default score a partnership must reach to win (short game). */
export const WIN_TARGET = 200

/**
 * Decide the game winner from cumulative scores. A team must reach `target`;
 * if both cross, the higher score wins; an exact tie is no winner (keep playing).
 */
export function gameWinner(
  score: Record<Team, number>,
  target: number = WIN_TARGET,
): Team | null {
  const ns = score.NS
  const ew = score.EW
  if (ns < target && ew < target) return null
  if (ns === ew) return null // both crossed on the same hand, dead level → play on
  return ns > ew ? 'NS' : 'EW'
}
