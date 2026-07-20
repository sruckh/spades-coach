import type { CSSProperties } from 'react'
import type { Rank, Suit } from '../types'

/**
 * Card highlight states — these ARE the Coach signal (see `mem:design_system`):
 * `playable` = legal + brass lift · `spade` = trump ring · `locked` = illegal (dim,
 * no lift) · `played` = resting in the trick · `idle` = neutral.
 */
export type CardState = 'idle' | 'playable' | 'locked' | 'spade' | 'played' | 'selected'

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_NAME: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }

export interface CardProps {
  rank: Rank
  suit: Suit
  state?: CardState
  onClick?: () => void
  /** Positioning transform vars injected by <Hand> (--rot / --arc / left). */
  style?: CSSProperties
  /** Override the computed a11y label. */
  ariaLabel?: string
  /** Render a face-down back instead of the face (rank/suit ignored). */
  back?: boolean
}

export function Card({ rank, suit, state = 'idle', onClick, style, ariaLabel, back }: CardProps) {
  if (back) {
    // Non-interactive card back (e.g. your hidden hand during a Blind-Nil decision).
    return (
      <div className="pc back" style={style} aria-hidden="true">
        <span className="backmark">♠</span>
      </div>
    )
  }

  const isRed = suit === 'H' || suit === 'D'
  const isSpade = suit === 'S'
  const locked = state === 'locked'

  const classes = [
    'pc',
    isRed ? 'red' : 'blk',
    isSpade ? 'spade' : '',
    state,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={onClick}
      disabled={locked}
      aria-label={ariaLabel ?? `${rank} of ${SUIT_NAME[suit]}`}
    >
      <span className="rank">{rank}</span>
      <span className="suit">{SUIT_GLYPH[suit]}</span>
    </button>
  )
}
