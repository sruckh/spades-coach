// Core domain types + pure seat/team helpers for Spades Coach.
//
// This module is framework-free (no React, no boardgame.io) — it is the shared
// vocabulary for the engine, AI, and Coach. See `.goals/README.md` §Types.

export type Suit = 'S' | 'H' | 'D' | 'C'

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'

export interface Card {
  suit: Suit
  rank: Rank
  id: string
}

export type Seat = 'N' | 'E' | 'S' | 'W'

/** boardgame.io player id. Seat mapping (per spec §Types): S=0, E=1, N=2, W=3. */
export type PlayerID = '0' | '1' | '2' | '3'

export type Team = 'NS' | 'EW'

/** A placed bid: 0 = Nil, 1..13 = tricks, `null` = not yet bid. */
export type Bid = number | null

export type NilKind = 'nil' | 'blindnil' | null

export type Tier = 'beginner' | 'intermediate' | 'expert'

export type GamePhase = 'bidding' | 'playing' | 'scoring' | 'gameover'

export interface Settings {
  tier: Tier
  coach: boolean
  target: number
  speed: 'slow' | 'normal' | 'fast'
  motion: boolean
}

// ---- seat ↔ playerID (S=0, E=1, N=2, W=3) ----

export const SEAT_BY_PLAYER: Record<PlayerID, Seat> = {
  '0': 'S',
  '1': 'E',
  '2': 'N',
  '3': 'W',
}

export const PLAYER_BY_SEAT: Record<Seat, PlayerID> = {
  S: '0',
  E: '1',
  N: '2',
  W: '3',
}

/** Clockwise seating order starting from South (turn order helper for T4+). */
export const CLOCKWISE_SEATS: readonly Seat[] = ['S', 'W', 'N', 'E']

export function seatOf(player: PlayerID): Seat {
  return SEAT_BY_PLAYER[player]
}

export function playerOfSeat(seat: Seat): PlayerID {
  return PLAYER_BY_SEAT[seat]
}

/** Partners sit across: 0↔2 (N/S) and 1↔3 (E/W). */
export function teamOf(player: PlayerID): Team {
  return player === '0' || player === '2' ? 'NS' : 'EW'
}

const PARTNER: Record<PlayerID, PlayerID> = {
  '0': '2',
  '2': '0',
  '1': '3',
  '3': '1',
}

export function partnerOf(player: PlayerID): PlayerID {
  return PARTNER[player]
}
