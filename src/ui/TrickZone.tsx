// The centre of gravity: cards played into the current trick, each parked toward
// the seat that played it (n/s/e/w), with a lead label in the middle. Cards
// animate in with the `cardPlayVariants` (fade+travel, or fade-only when reduced).
// Presentation only — the board decides what's on the table.

import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Rank, Suit } from '../types'
import { cardPlayVariants } from './motion'

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_NAME: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }

export interface TrickCard {
  /** Which seat played it → placement + key. */
  seat: 'n' | 's' | 'e' | 'w'
  rank: Rank
  suit: Suit
}

export interface TrickZoneProps {
  cards: TrickCard[]
  /** Centre label, e.g. "East led ♥". */
  leadLabel?: ReactNode
  /** When a finished trick is being revealed, the seat that won it (gets a brass ring). */
  winnerSeat?: TrickCard['seat']
  /** Collapse motion to a cross-fade. */
  reduced?: boolean
}

export function TrickZone({ cards, leadLabel, winnerSeat, reduced = false }: TrickZoneProps) {
  const variants = cardPlayVariants(reduced)
  return (
    <div className="trick" aria-label="Current trick">
      <AnimatePresence>
        {cards.map((c) => {
          const isRed = c.suit === 'H' || c.suit === 'D'
          const isSpade = c.suit === 'S'
          const won = winnerSeat === c.seat
          const cls = ['tcard', c.seat, isRed ? 'red' : 'blk', isSpade ? 'spade' : '', won ? 'won' : '']
            .filter(Boolean)
            .join(' ')
          return (
            <motion.div
              key={`${c.seat}-${c.rank}${c.suit}`}
              className={cls}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              aria-label={`${c.rank} of ${SUIT_NAME[c.suit]}`}
            >
              <span>{c.rank}</span>
              <span className="s">{SUIT_GLYPH[c.suit]}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
      {leadLabel && (
        <div className={winnerSeat ? 'lead won' : 'lead'} role={winnerSeat ? 'status' : undefined}>
          {leadLabel}
        </div>
      )}
    </div>
  )
}
