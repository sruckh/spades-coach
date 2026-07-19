// Play advice — shared by the AI bots and (in T8) the Coach. Pure: given the
// player's hand and the trick in progress, pick a legal card, explain why, and
// list the runner-up legal cards. Seat tactics per `mem:spades_strategy` §Play.

import type { Bid, Card, PlayerID, Suit, Tier } from '../types'
import { partnerOf } from '../types'
import { compareForTrick, rankValue, RANKS } from '../game/deck'
import { legalPlays, seatsPlayed } from './legalPlays'
import type { TrickLike } from './legalPlays'

export interface PlayTrick extends TrickLike {
  leader: PlayerID
}

/** Everything a play decision needs; richer fields sharpen the higher tiers. */
export interface PlayContext {
  hand: Card[]
  trick: PlayTrick
  spadesBroken: boolean
  playerID: PlayerID
  /** Bids this hand (for bag awareness — has the team already made its contract?). */
  bids?: Record<PlayerID, Bid>
  /** Tricks won so far per player (for bag awareness). */
  tricksByPlayer?: Record<PlayerID, number>
  /** Every card played this hand so far (for counting sure winners / "boss" cards). */
  played?: Card[]
}

export interface PlaySuggestion {
  card: Card
  reasoning: string
  /** Other legal cards, ranked low→high, for the Coach to show as options. */
  alternatives: Card[]
}

const SUIT_ORDER: readonly Suit[] = ['H', 'D', 'C', 'S']

/** Total order for tie-free "lowest / highest": by rank, then by id. */
function byRank(a: Card, b: Card): number {
  return rankValue(a.rank) - rankValue(b.rank) || (a.id < b.id ? -1 : 1)
}

function lowest(cards: Card[]): Card {
  return [...cards].sort(byRank)[0]
}

/** The currently-winning card in a trick that has at least one card played. */
function winningCard(trick: PlayTrick): { pid: PlayerID; card: Card } {
  const led = trick.suitLed
  let best: { pid: PlayerID; card: Card } | null = null
  for (const pid of ['0', '1', '2', '3'] as PlayerID[]) {
    const c = trick.cards[pid]
    if (!c) continue
    if (!best || compareForTrick(led as Suit, c, best.card) > 0) best = { pid, card: c }
  }
  return best as { pid: PlayerID; card: Card }
}

/** Among cards that beat `beatCard`, the cheapest (or dearest) by trick power. */
function pickWinner(winners: Card[], led: Suit, dearest: boolean): Card {
  return winners.reduce((best, c) => {
    const cmp = compareForTrick(led, c, best)
    if (dearest ? cmp > 0 : cmp < 0) return c
    // Deterministic tie-break (same power ⇒ same suit/rank is impossible, but ids differ).
    if (cmp === 0 && c.id < best.id) return c
    return best
  })
}

/** Lead low from the longest non-spade suit; fall back to the lowest legal card. */
const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_WORD: Record<Suit, string> = { S: 'spade', H: 'heart', D: 'diamond', C: 'club' }

/** Cards accounted for = everything already played plus everything still in hand. */
function seenRanks(hand: Card[], played: Card[]): Set<string> {
  const seen = new Set<string>()
  for (const c of hand) seen.add(`${c.rank}${c.suit}`)
  for (const c of played) seen.add(`${c.rank}${c.suit}`)
  return seen
}

/**
 * Is `card` the highest card of its suit still outstanding — every higher rank
 * already accounted for (played, or in my own hand)? Such a card is a "boss": led
 * in-suit it can only lose to a trump (a spade on a non-spade lead). A boss spade
 * is an outright sure trick.
 */
function isBoss(card: Card, seen: Set<string>): boolean {
  const cv = rankValue(card.rank)
  for (const r of RANKS) {
    if (rankValue(r) > cv && !seen.has(`${r}${card.suit}`)) return false
  }
  return true
}

function chooseLead(legal: Card[], hand: Card[], played: Card[]): { card: Card; reasoning: string } {
  const seen = seenRanks(hand, played)
  const bosses = legal.filter((c) => isBoss(c, seen))

  if (bosses.length > 0) {
    // Cash a sure winner: take the trick AND keep the lead. Prefer running a long
    // suit; among equal lengths, lead the top card.
    const card = bosses.reduce((best, c) => {
      const lenC = legal.filter((x) => x.suit === c.suit).length
      const lenB = legal.filter((x) => x.suit === best.suit).length
      if (lenC !== lenB) return lenC > lenB ? c : best
      return rankValue(c.rank) > rankValue(best.rank) ? c : best
    })
    const moreInSuit = bosses.some((c) => c.suit === card.suit && c.id !== card.id)
    const tail = moreInSuit ? ' You hold more winners to run after it.' : ''
    return {
      card,
      reasoning: `Cash the ${card.rank}${SUIT_GLYPH[card.suit]} — it's the best ${SUIT_WORD[card.suit]} still out, so you win this trick and keep the lead.${tail}`,
    }
  }

  // No sure winner: probe low from your longest side suit, saving winners.
  const nonSpades = legal.filter((c) => c.suit !== 'S')
  const pool = nonSpades.length > 0 ? nonSpades : legal
  let bestSuit: Suit | null = null
  let bestLen = -1
  for (const suit of SUIT_ORDER) {
    const len = pool.filter((c) => c.suit === suit).length
    if (len > bestLen) {
      bestLen = len
      bestSuit = suit
    }
  }
  return {
    card: lowest(pool.filter((c) => c.suit === bestSuit)),
    reasoning: 'Probe with a low card from your longest side suit, saving your winners for later.',
  }
}

/** Has the player's partnership already reached its contract (so extra tricks = bags)? */
function teamMadeBid(ctx: PlayContext): boolean {
  if (!ctx.bids || !ctx.tricksByPlayer) return false
  const seats = [ctx.playerID, partnerOf(ctx.playerID)]
  const bid = seats.reduce((s, p) => s + Math.max(0, ctx.bids?.[p] ?? 0), 0)
  const won = seats.reduce((s, p) => s + (ctx.tricksByPlayer?.[p] ?? 0), 0)
  return bid > 0 && won >= bid
}

/** Suggest a legal card to play, with reasoning and ranked alternatives. */
export function suggestPlay(ctx: PlayContext, tier: Tier): PlaySuggestion {
  const legal = legalPlays(ctx.hand, ctx.trick, ctx.spadesBroken)
  const withResult = (card: Card, reasoning: string): PlaySuggestion => ({
    card,
    reasoning,
    alternatives: legal.filter((c) => c.id !== card.id).sort(byRank),
  })

  if (legal.length === 1) {
    return withResult(legal[0], 'Only one legal card — no choice.')
  }

  const pos = seatsPlayed(ctx.trick)
  // A Nil bidder wants to LOSE every trick, so never cash winners for them.
  const goingNil = (ctx.bids?.[ctx.playerID] ?? -1) === 0

  if (pos === 0) {
    if (goingNil) {
      return withResult(lowest(legal), 'Nil: lead your lowest card to duck the trick.')
    }
    if (tier !== 'beginner' && teamMadeBid(ctx)) {
      // Contract's in — extra tricks are just bags, so shed a low card, don't cash.
      return withResult(
        lowest(legal),
        'Contract already made — lead low to shed a card without piling up bags.',
      )
    }
    const lead = chooseLead(legal, ctx.hand, ctx.played ?? [])
    return withResult(lead.card, lead.reasoning)
  }

  if (pos === 1 && !goingNil) {
    return withResult(
      lowest(legal),
      '2nd seat: duck low and let your partner contest the trick.',
    )
  }

  const led = ctx.trick.suitLed as Suit
  const winner = winningCard(ctx.trick)
  const partnerWinning = winner.pid === partnerOf(ctx.playerID)
  const winners = legal.filter((c) => compareForTrick(led, c, winner.card) > 0)

  if (goingNil) {
    // Follow suit as low as you can; the aim is never to win.
    return withResult(lowest(legal), 'Nil: play your lowest legal card to stay under the trick.')
  }

  if (partnerWinning) {
    return withResult(lowest(legal), 'Partner is winning the trick — throw your lowest card.')
  }

  if (tier !== 'beginner' && teamMadeBid(ctx)) {
    return withResult(
      lowest(legal),
      'Contract already made — dump low to avoid picking up bags.',
    )
  }

  if (winners.length > 0) {
    // 3rd seat plays high (int/expert) to force the issue; otherwise win cheaply.
    const dearest = pos === 2 && tier !== 'beginner'
    const card = pickWinner(winners, led, dearest)
    const how = dearest ? 'play high to secure the trick' : 'win as cheaply as you can'
    return withResult(card, `Opponent is winning — ${how}.`)
  }

  return withResult(lowest(legal), 'Can’t beat the trick — discard your lowest card.')
}
