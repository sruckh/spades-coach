// The board: the single React view over the boardgame.io client. It reads the
// (redacted) game view `G`, `ctx`, and the framework `moves`, and renders the
// design-system layout: Frame → StatusBar → Table (compass Seats) + TrickZone →
// Hand → (BidPicker while bidding) → ActionBar → CoachSheet. It dispatches exactly
// two moves — `playCard` and `placeBid` — and it never re-derives rules: card
// states come from `legalPlays` (via `deriveHandCards`) and advice comes from the
// Coach (`coachAdvice`), which only returns data. Motion is gated behind the
// reduced-motion preference and the in-app motion setting. See `.goals/README.md`
// §Layer-C and `mem:design_system`.

import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Ctx } from 'boardgame.io'
import type { Bid, Card, PlayerID, Suit } from '../types'
import { teamOf } from '../types'
import type { SpadesView } from '../game/Spades'
import { legalPlays } from '../analysis/legalPlays'
import { coachAdvice, type CoachAdvice } from '../analysis/coach'
import { useUiStore } from '../store/useUiStore'
import { Frame } from './Frame'
import { StatusBar } from './StatusBar'
import { Table } from './Table'
import type { SeatProps } from './Seat'
import { TrickZone, type TrickCard } from './TrickZone'
import { Hand } from './Hand'
import { ActionBar } from './ActionBar'
import { BidPicker } from './BidPicker'
import { CoachSheet } from './CoachSheet'
import { HandSummary } from './HandSummary'
import { deriveHandCards, idleHandCards, isLegalPlay, sortHand } from './play'

/** The human always sits South. */
const HUMAN: PlayerID = '0'

/** The narrow move surface the board dispatches into. */
export interface SpadesMoves {
  playCard: (card: Card) => void
  placeBid: (n: number) => void
}

export interface SpadesBoardProps {
  G: SpadesView
  ctx: Ctx
  moves: SpadesMoves
  playerID?: string | null
}

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

/** Static seat metadata, keyed by playerID. */
const SEATS: Record<
  PlayerID,
  { pos: SeatProps['pos']; initial: string; name: string; letter: TrickCard['seat']; isYou?: boolean; isPartner?: boolean }
> = {
  '0': { pos: 'south', initial: 'S', name: 'You', letter: 's', isYou: true },
  '1': { pos: 'east', initial: 'E', name: 'East', letter: 'e' },
  '2': { pos: 'north', initial: 'N', name: 'Nora', letter: 'n', isPartner: true },
  '3': { pos: 'west', initial: 'W', name: 'West', letter: 'w' },
}

const PIDS: readonly PlayerID[] = ['0', '1', '2', '3']

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_GLYPH[card.suit]}`
}

/** Chip text for a seat's bid: "Nil" / "bid 3" / "bidding…" / "to bid". */
function bidChip(bid: Bid, isActiveBidder: boolean): { text: string; pending: boolean } {
  if (bid === null) return { text: isActiveBidder ? 'bidding…' : 'to bid', pending: true }
  return { text: bid === 0 ? 'Nil' : `bid ${bid}`, pending: false }
}

export function SpadesBoard({ G, ctx, moves }: SpadesBoardProps) {
  const prefersReduced = useReducedMotion()
  const coachOpen = useUiStore((s) => s.coachOpen)
  const openCoach = useUiStore((s) => s.openCoach)
  const closeCoach = useUiStore((s) => s.closeCoach)
  const whisperText = useUiStore((s) => s.whisperText)
  const setWhisper = useUiStore((s) => s.setWhisper)
  const selectedCard = useUiStore((s) => s.selectedCard)
  const setSelectedCard = useUiStore((s) => s.setSelectedCard)
  const lastHandSeen = useUiStore((s) => s.lastHandSeen)
  const dismissHandSummary = useUiStore((s) => s.dismissHandSummary)
  const settings = useUiStore((s) => s.settings)

  const [advice, setAdvice] = useState<CoachAdvice | null>(null)

  const reduced = Boolean(prefersReduced) || !settings.motion
  const phase = ctx.phase === 'bidding' ? 'bidding' : 'playing'
  const gameover = Boolean(ctx.gameover)
  const isMyTurn = !gameover && ctx.currentPlayer === HUMAN
  // Sorted for display (alternating colours, high→low). This same order is what
  // `onSelect(index)` indexes into, so selection stays consistent with the fan.
  const myHand = sortHand(G.hands[HUMAN] ?? [])

  // ---- seats ----
  const seats: SeatProps[] = PIDS.map((pid) => {
    const meta = SEATS[pid]
    const chip = bidChip(G.bids[pid], phase === 'bidding' && ctx.currentPlayer === pid)
    return {
      pos: meta.pos,
      initial: meta.initial,
      name: meta.name,
      bidLabel: chip.text,
      pending: chip.pending,
      active: !gameover && ctx.currentPlayer === pid,
      isYou: meta.isYou,
      isPartner: meta.isPartner,
    }
  })

  // ---- trick zone ----
  const trickCards: TrickCard[] = PIDS.flatMap((pid) => {
    const card = G.currentTrick.cards[pid]
    if (!card) return []
    return [{ seat: SEATS[pid].letter, rank: card.rank, suit: card.suit }]
  })
  const led = G.currentTrick.suitLed
  let leadLabel =
    led && trickCards.length > 0
      ? `${SEATS[G.currentTrick.leader].name} led ${SUIT_GLYPH[led]}`
      : trickCards.length === 0 && phase === 'playing'
        ? `${SEATS[G.currentTrick.leader].name} to lead`
        : undefined

  // Winner reveal: a finished trick lingers (its four cards + the winning card
  // ringed) until the next lead lands. During this window `currentTrick` is empty
  // and `lastTrick` holds the snapshot the engine kept for exactly this purpose.
  let displayCards = trickCards
  let winnerSeat: TrickCard['seat'] | undefined
  if (phase === 'playing' && G.lastTrick && trickCards.length === 0) {
    const lt = G.lastTrick
    displayCards = PIDS.map((pid) => ({
      seat: SEATS[pid].letter,
      rank: lt.cards[pid].rank,
      suit: lt.cards[pid].suit,
    }))
    winnerSeat = SEATS[lt.winner].letter
    const wc = lt.cards[lt.winner]
    leadLabel = `${SEATS[lt.winner].name} won with ${wc.rank}${SUIT_GLYPH[wc.suit]}`
  }

  // ---- status bar ----
  const round = `Hand ${G.handNumber}${G.spadesBroken ? ' · Spades broken' : ''}`
  const nsBid = (G.bids['0'] ?? 0) + (G.bids['2'] ?? 0)
  let bidLabel = 'Your bid'
  let bidTally: string | undefined
  if (phase === 'bidding') {
    if (G.bids[HUMAN] !== null) bidTally = G.bids[HUMAN] === 0 ? 'Nil' : String(G.bids[HUMAN])
  } else {
    bidLabel = 'Made / bid'
    bidTally = `${G.tricks.NS} / ${nsBid}`
  }

  // ---- hand ----
  const handCards =
    phase === 'playing' && isMyTurn
      ? deriveHandCards(myHand, G.currentTrick, G.spadesBroken)
      : idleHandCards(myHand)

  const legalNow =
    phase === 'playing' && isMyTurn ? legalPlays(myHand, G.currentTrick, G.spadesBroken) : []

  // Tapping a card in the hand → stage it for play. Illegal taps are blocked with
  // a whisper (never a throw); locked cards are also disabled at the Card level.
  function onSelect(index: number) {
    const card = myHand[index]
    if (!card || phase !== 'playing' || !isMyTurn) return
    if (!isLegalPlay(card, legalNow)) {
      setWhisper(
        led
          ? `You can't play the ${cardLabel(card)} — follow ${SUIT_GLYPH[led]} if you can.`
          : `You can't play the ${cardLabel(card)} right now.`,
      )
      return
    }
    setWhisper(null)
    setSelectedCard(card)
  }

  function askCoach() {
    setAdvice(
      coachAdvice({
        tier: settings.tier,
        playerID: HUMAN,
        hand: myHand,
        phase,
        score: G.score,
        trick: G.currentTrick,
        spadesBroken: G.spadesBroken,
        bids: G.bids,
        tricksByPlayer: G.tricksByPlayer,
        bags: G.bags,
        played: G.played,
      }),
    )
    openCoach()
  }

  function placeBid(n: number) {
    setWhisper(null)
    moves.placeBid(n)
  }

  function playSelected() {
    if (!selectedCard) return
    moves.playCard(selectedCard)
    setSelectedCard(null)
  }

  // ---- primary action ----
  let primaryLabel = 'Waiting…'
  let primaryDisabled = true
  let onPrimary: (() => void) | undefined

  if (gameover) {
    const winner = (ctx.gameover as { winner?: string } | undefined)?.winner
    primaryLabel = winner === undefined ? 'Game over' : teamOf(HUMAN) === winner ? 'You win!' : 'You lost'
  } else if (phase === 'bidding') {
    primaryLabel = isMyTurn && G.bids[HUMAN] === null ? 'Pick a bid' : 'Waiting…'
  } else if (isMyTurn) {
    if (selectedCard) {
      primaryLabel = `Play ${cardLabel(selectedCard)}`
      primaryDisabled = false
      onPrimary = playSelected
    } else {
      primaryLabel = 'Tap a card'
    }
  }

  const showBidPicker = !gameover && phase === 'bidding' && isMyTurn && G.bids[HUMAN] === null
  const bidSuggestion = advice?.suggestedAction?.kind === 'bid' ? advice.suggestedAction.bid : undefined

  return (
    <Frame>
      <StatusBar
        round={round}
        bidLabel={bidLabel}
        bidTally={bidTally}
        scoreUs={G.score.NS}
        scoreThem={G.score.EW}
      />

      <Table
        seats={seats}
        trick={
          <TrickZone
            cards={displayCards}
            leadLabel={leadLabel}
            winnerSeat={winnerSeat}
            reduced={reduced}
          />
        }
      />

      {whisperText && (
        <div
          className="whisper"
          role="status"
          style={{
            textAlign: 'center',
            padding: '0 16px 4px',
            font: '500 13px/1.4 var(--f-body)',
            color: 'var(--spade-glow)',
          }}
        >
          {whisperText}
        </div>
      )}

      <Hand
        cards={handCards}
        onPlay={phase === 'playing' && isMyTurn ? onSelect : undefined}
        label={led ? `Your hand — following ${SUIT_GLYPH[led]}` : 'Your hand'}
      />

      {showBidPicker && <BidPicker onBid={placeBid} suggestion={bidSuggestion} />}

      <ActionBar
        onAskCoach={askCoach}
        coachEnabled={settings.coach}
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        primaryDisabled={primaryDisabled}
      />

      <CoachSheet
        open={coachOpen}
        onClose={closeCoach}
        eyebrow={phase === 'bidding' ? 'Coach · bidding' : 'Coach · this trick'}
        headline={advice?.headline ?? 'Ask me anything'}
        body={advice?.body}
        tip={advice?.tip}
      />

      {G.lastHand && lastHandSeen !== G.lastHand.handNumber && (
        <HandSummary
          handNumber={G.lastHand.handNumber}
          breakdown={G.lastHand}
          score={G.score}
          gameover={gameover}
          onContinue={() => dismissHandSummary(G.lastHand!.handNumber)}
        />
      )}
    </Frame>
  )
}
