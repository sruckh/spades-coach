// Spades engine (boardgame.io Game). T4 scope: deterministic deal + the full
// bidding phase — regular bids, Nil (bid 0), and house-rule Blind Nil with a
// 3-card partner exchange. T5 adds the play phase: follow-suit / breaking-spades
// enforcement, trick resolution, and winner-leads-next turn order.
//
// Rules per `mem:spades_rules` / `.goals/README.md` §Layer-A. Seat↔playerID and
// turn order come from `src/types.ts`; clockwise order is S→W→N→E, i.e. player
// ids 0→3→2→1, NOT numeric `(pid+1)%4` — see CLOCKWISE_SEATS.

import type { Game, Move } from 'boardgame.io'
import { INVALID_MOVE } from 'boardgame.io/core'
import type { Bid, Card, NilKind, PlayerID, Suit, Team } from '../types'
import { CLOCKWISE_SEATS, partnerOf, playerOfSeat, teamOf } from '../types'
import { compareForTrick, createDeck, deal, rankValue } from './deck'
import { gameWinner, scoreHandBreakdown } from './scoring'
import type { HandBreakdown } from './scoring'

/** All player ids in numeric order. */
const PLAYER_IDS: readonly PlayerID[] = ['0', '1', '2', '3']

/** Bidding/play seating, clockwise from South: player ids 0→3→2→1. */
const CLOCKWISE_PLAYERS: readonly PlayerID[] = CLOCKWISE_SEATS.map(playerOfSeat)

export interface SpadesState {
  /** Each player's 13 cards. Redacted for opponents by `playerView`. */
  hands: Record<PlayerID, Card[]>
  /** Placed bids; `null` = not yet bid (0 = Nil, 1..13 = tricks). */
  bids: Record<PlayerID, Bid>
  /** Nil flavour per player once bid (`'nil'` | `'blindnil'` | `null`). */
  nilKind: Record<PlayerID, NilKind>
  /** Cards a blind-nil bidder passed to their partner (audit / undo trail). */
  blindPass: Record<PlayerID, Card[]>
  /** The blind-nil bidder still owing a 3-card exchange, else `null`. */
  awaitingExchange: PlayerID | null
  /** House rule: may players declare Blind Nil? */
  allowBlindNil: boolean
  /** The trick in progress; `cards[p]` is `null` until seat `p` has played. */
  currentTrick: Trick
  /** Every card played so far this hand (in play order) — powers card counting. */
  played: Card[]
  /** The just-finished trick, held for the winner reveal; cleared on the next lead. */
  lastTrick: CompletedTrick | null
  /** The most recently scored hand's itemised breakdown (for the summary), or null. */
  lastHand: LastHand | null
  /** Tricks won this hand, per partnership. */
  tricks: Record<Team, number>
  /** Tricks won this hand, per player (for Nil tracking + scoring). */
  tricksByPlayer: Record<PlayerID, number>
  /** True once a spade has been played (spades may then be led). */
  spadesBroken: boolean
  /** Cumulative running score per partnership. */
  score: Record<Team, number>
  /** Cumulative bags per partnership (0..9; every 10 triggers the sandbag penalty). */
  bags: Record<Team, number>
  /** Dealer seat; the player to their left bids/plays first. */
  dealer: PlayerID
  /** 1-based hand counter within the game. */
  handNumber: number
}

/** One trick: who leads, the suit that must be followed, and each seat's play. */
export interface Trick {
  leader: PlayerID
  suitLed: Suit | null
  cards: Record<PlayerID, Card | null>
}

/** A finished trick, snapshotted for the UI's winner reveal. All four cards are
 *  present. Public info (everyone saw the cards), so it survives `stripSecrets`. */
export interface CompletedTrick {
  leader: PlayerID
  suitLed: Suit
  cards: Record<PlayerID, Card>
  winner: PlayerID
}

/** The last hand's itemised score, tagged with the hand it belongs to so the UI
 *  can show the summary once and know when it has been dismissed. */
export type LastHand = HandBreakdown & { handNumber: number }

interface SetupData {
  allowBlindNil?: boolean
}

function emptyByPlayer<T>(value: () => T): Record<PlayerID, T> {
  return { '0': value(), '1': value(), '2': value(), '3': value() }
}

/** The seat to the dealer's left in clockwise order — first to bid and to lead. */
function leftOf(player: PlayerID): PlayerID {
  return CLOCKWISE_PLAYERS[(CLOCKWISE_PLAYERS.indexOf(player) + 1) % CLOCKWISE_PLAYERS.length]
}

/** A fresh, empty trick led by `leader`. */
function newTrick(leader: PlayerID): Trick {
  return { leader, suitLed: null, cards: emptyByPlayer<Card | null>(() => null) }
}

type Random = { Shuffle<T>(deck: T[]): T[] }

/** Deal a fresh hand into `G`: new cards, cleared bids/tricks, trick led left of dealer. */
function dealHand(G: SpadesState, random: Random): void {
  G.hands = deal(random.Shuffle(createDeck()))
  G.bids = emptyByPlayer<Bid>(() => null)
  G.nilKind = emptyByPlayer<NilKind>(() => null)
  G.blindPass = emptyByPlayer<Card[]>(() => [])
  G.awaitingExchange = null
  G.currentTrick = newTrick(leftOf(G.dealer))
  G.played = []
  G.lastTrick = null
  G.tricks = { NS: 0, EW: 0 }
  G.tricksByPlayer = emptyByPlayer<number>(() => 0)
  G.spadesBroken = false
}

/** Deal the opening hand; deterministic given the game seed. */
function setup({ random }: { random: Random }, setupData?: SetupData): SpadesState {
  const G: SpadesState = {
    hands: emptyByPlayer<Card[]>(() => []),
    bids: emptyByPlayer<Bid>(() => null),
    nilKind: emptyByPlayer<NilKind>(() => null),
    blindPass: emptyByPlayer<Card[]>(() => []),
    awaitingExchange: null,
    allowBlindNil: setupData?.allowBlindNil ?? true,
    currentTrick: newTrick('3'),
    played: [],
    lastTrick: null,
    lastHand: null,
    tricks: { NS: 0, EW: 0 },
    tricksByPlayer: emptyByPlayer<number>(() => 0),
    spadesBroken: false,
    score: { NS: 0, EW: 0 },
    bags: { NS: 0, EW: 0 },
    dealer: '0',
    handNumber: 1,
  }
  dealHand(G, random)
  return G
}

/** True once every seat has a bid recorded. */
function everyBidPlaced(G: SpadesState): boolean {
  return PLAYER_IDS.every((p) => G.bids[p] !== null)
}

// ---- moves ----

/** Place a regular bid (0..13). 0 records a Nil. */
function placeBid(
  { G, playerID, events }: { G: SpadesState; playerID: PlayerID; events: { endTurn(): void } },
  n: number,
) {
  if (G.bids[playerID] !== null) return INVALID_MOVE
  if (!Number.isInteger(n) || n < 0 || n > 13) return INVALID_MOVE

  G.bids[playerID] = n
  G.nilKind[playerID] = n === 0 ? 'nil' : null

  // Advance to the next bidder; on the final bid let the phase's endIf close it.
  if (!everyBidPlaced(G)) events.endTurn()
}

/** Declare Blind Nil (house-rule gated); the exchange follows before the turn ends. */
function blindNil({ G, playerID }: { G: SpadesState; playerID: PlayerID }) {
  if (!G.allowBlindNil) return INVALID_MOVE
  if (G.bids[playerID] !== null) return INVALID_MOVE

  G.bids[playerID] = 0
  G.nilKind[playerID] = 'blindnil'
  G.awaitingExchange = playerID
  // No endTurn: the same player must now call exchangeBlind.
}

/** The blind-nil bidder passes 3 cards to their partner and takes 3 back. */
function exchangeBlind(
  {
    G,
    playerID,
    events,
  }: { G: SpadesState; playerID: PlayerID; events: { endTurn(): void } },
  cardIds: string[],
) {
  if (G.awaitingExchange !== playerID) return INVALID_MOVE
  if (!Array.isArray(cardIds) || cardIds.length !== 3) return INVALID_MOVE

  const partner = partnerOf(playerID)
  const hand = G.hands[playerID]
  const given = cardIds.map((id) => hand.find((c) => c.id === id))
  if (given.some((c) => c === undefined)) return INVALID_MOVE
  const passed = given as Card[]

  // Partner returns their three weakest cards, keeping both hands at 13.
  const partnerHand = G.hands[partner]
  const returned = [...partnerHand].sort((a, b) => rankValue(a.rank) - rankValue(b.rank)).slice(0, 3)

  const passedIds = new Set(passed.map((c) => c.id))
  const returnedIds = new Set(returned.map((c) => c.id))

  G.hands[playerID] = [...hand.filter((c) => !passedIds.has(c.id)), ...returned]
  G.hands[partner] = [...partnerHand.filter((c) => !returnedIds.has(c.id)), ...passed]
  G.blindPass[playerID] = passed

  G.awaitingExchange = null
  if (!everyBidPlaced(G)) events.endTurn()
}

// ---- play phase ----

/** How many seats have played into `trick` so far (0..4). */
function cardsPlayed(trick: Trick): number {
  return PLAYER_IDS.reduce((n, p) => n + (trick.cards[p] ? 1 : 0), 0)
}

/**
 * The cards `hand` may legally play into `trick`. Leading: any card, except a
 * spade before spades are broken unless the hand is all spades. Following: must
 * follow the led suit when able, otherwise any card.
 */
export function legalPlaysFor(hand: Card[], trick: Trick, spadesBroken: boolean): Card[] {
  const leading = cardsPlayed(trick) === 0
  if (leading) {
    if (spadesBroken || hand.every((c) => c.suit === 'S')) return hand
    const nonSpades = hand.filter((c) => c.suit !== 'S')
    return nonSpades.length > 0 ? nonSpades : hand
  }
  const led = trick.suitLed
  const inSuit = hand.filter((c) => c.suit === led)
  return inSuit.length > 0 ? inSuit : hand
}

/** Winner of a completed 4-card trick: highest spade, else highest of the led suit. */
function resolveTrick(trick: Trick): PlayerID {
  const led = trick.suitLed as Suit
  let winner: PlayerID = trick.leader
  let best = trick.cards[trick.leader] as Card
  for (const p of PLAYER_IDS) {
    const card = trick.cards[p]
    if (card && compareForTrick(led, card, best) > 0) {
      winner = p
      best = card
    }
  }
  return winner
}

/** Play a card into the current trick; resolve the trick when the 4th card lands. */
function playCard(
  { G, playerID }: { G: SpadesState; playerID: PlayerID },
  card: Card,
) {
  const hand = G.hands[playerID]
  const held = card && hand.find((c) => c.id === card.id)
  if (!held) return INVALID_MOVE

  const trick = G.currentTrick
  if (!legalPlaysFor(hand, trick, G.spadesBroken).some((c) => c.id === held.id)) {
    return INVALID_MOVE
  }

  // The lead card of a new trick ends the previous trick's winner reveal.
  if (cardsPlayed(trick) === 0) G.lastTrick = null

  // Commit the card: remove from hand, record on the trick + running played pile,
  // set the led suit.
  G.hands[playerID] = hand.filter((c) => c.id !== held.id)
  G.played.push(held)
  if (cardsPlayed(trick) === 0) trick.suitLed = held.suit
  trick.cards[playerID] = held
  if (held.suit === 'S') G.spadesBroken = true

  // On the 4th card, resolve the trick, snapshot it for the reveal, and hand the
  // lead to its winner.
  if (cardsPlayed(trick) === 4) {
    const winner = resolveTrick(trick)
    G.tricks[teamOf(winner)] += 1
    G.tricksByPlayer[winner] += 1
    G.lastTrick = {
      leader: trick.leader,
      suitLed: trick.suitLed as Suit,
      cards: { ...trick.cards } as Record<PlayerID, Card>,
      winner,
    }
    G.currentTrick = newTrick(winner)
  }
}

/** True once all 13 tricks of the hand have been played. */
function handComplete(G: SpadesState): boolean {
  return G.tricks.NS + G.tricks.EW === 13
}

/**
 * Settle a completed hand: bank the per-team score + bags, and — unless the game
 * is now won — rotate the dealer clockwise and deal the next hand. Called from
 * the play phase's `onEnd`; the game-level `endIf` reads the updated score.
 */
function settleHand(G: SpadesState, random: Random): void {
  const breakdown = scoreHandBreakdown(G)
  // Stash the itemised result (tagged with its hand) for the summary UI.
  G.lastHand = { handNumber: G.handNumber, ...breakdown }

  for (const team of ['NS', 'EW'] as const) {
    G.score[team] += breakdown[team].points
    G.bags[team] = breakdown[team].bagsAfter
  }

  if (gameWinner(G.score) === null) {
    G.dealer = leftOf(G.dealer)
    G.handNumber += 1
    dealHand(G, random)
  }
}

// ---- view redaction ----

export interface SpadesView extends Omit<SpadesState, 'hands' | 'blindPass'> {
  hands: Record<PlayerID, Card[]>
  blindPass: Record<PlayerID, Card[]>
  /** Card count per seat, so opponents render backs without seeing faces. */
  handCounts: Record<PlayerID, number>
}

/** Strip every hand but the viewer's; expose only counts for the rest. */
export function stripSecrets(G: SpadesState, viewer: PlayerID | null): SpadesView {
  const hands = emptyByPlayer<Card[]>(() => [])
  const blindPass = emptyByPlayer<Card[]>(() => [])
  const handCounts = emptyByPlayer<number>(() => 0)

  for (const p of PLAYER_IDS) {
    handCounts[p] = G.hands[p].length
    if (p === viewer) {
      hands[p] = G.hands[p]
      blindPass[p] = G.blindPass[p]
    }
  }

  return { ...G, hands, blindPass, handCounts }
}

// ---- game ----

export const SpadesGame: Game<SpadesState> = {
  name: 'spades',
  minPlayers: 4,
  maxPlayers: 4,

  setup,

  playerView: ({ G, playerID }) => stripSecrets(G, playerID as PlayerID | null),

  // Game over once a partnership reaches the target (200); higher score breaks a
  // both-crossed hand, an exact tie keeps play going. Checked after each update.
  endIf: ({ G }) => {
    const winner = gameWinner(G.score)
    return winner ? { winner } : undefined
  },

  phases: {
    bidding: {
      start: true,
      // The reducers use narrow, test-friendly contexts; bridge to the engine's
      // broad Move type (boardgame.io's PlayerID is `string`) at this boundary.
      moves: {
        placeBid: placeBid as unknown as Move<SpadesState>,
        blindNil: blindNil as unknown as Move<SpadesState>,
        exchangeBlind: exchangeBlind as unknown as Move<SpadesState>,
      },
      endIf: ({ G }) => everyBidPlaced(G),
      next: 'playing',
      turn: {
        order: {
          playOrder: () => [...CLOCKWISE_PLAYERS],
          // First bidder = seat to the dealer's left (next clockwise).
          first: ({ G, ctx }) => (ctx.playOrder.indexOf(G.dealer) + 1) % ctx.numPlayers,
          next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.numPlayers,
        },
      },
    },

    playing: {
      moves: {
        // Card moves are redacted in the log so opponents can't read the hand
        // a card came from. Bridge the narrow reducer to the engine Move type.
        playCard: { move: playCard, redact: true } as unknown as Move<SpadesState>,
      },
      // Trick 1 leads from the dealer's left; align the trick's leader to match.
      onBegin: ({ G }) => {
        G.currentTrick = newTrick(leftOf(G.dealer))
      },
      // Hand over once all 13 tricks are in.
      endIf: ({ G }) => handComplete(G),
      // Score the hand, then deal the next one (dealer rotates) and bid again.
      onEnd: ({ G, random }) => settleHand(G, random),
      next: 'bidding',
      turn: {
        maxMoves: 1,
        order: {
          playOrder: () => [...CLOCKWISE_PLAYERS],
          first: ({ G, ctx }) => (ctx.playOrder.indexOf(G.dealer) + 1) % ctx.numPlayers,
          // Between tricks the recorded leader (the last winner) plays next;
          // mid-trick, play proceeds clockwise. `undefined` ends the phase.
          next: ({ G, ctx }) => {
            if (handComplete(G)) return undefined
            const trick = G.currentTrick
            const anyPlayed = PLAYER_IDS.some((p) => trick.cards[p] !== null)
            if (!anyPlayed) return ctx.playOrder.indexOf(trick.leader)
            return (ctx.playOrderPos + 1) % ctx.numPlayers
          },
        },
      },
    },
  },
}

/** Re-exported helpers + move/setup reducers for tests and higher layers. */
export { CLOCKWISE_PLAYERS, PLAYER_IDS, everyBidPlaced, leftOf, newTrick, resolveTrick }
export { setup, placeBid, blindNil, exchangeBlind, playCard }
