// Bidding control: a 0..13 grid (0 = Nil) shown while it's the human's turn to
// bid. Dispatches the chosen number up to the board (→ moves.placeBid). The
// Coach's suggested bid is marked so the player can see the recommendation. Built
// on token primitives; laid out with inline grid styles to avoid touching the
// shared stylesheet.

import type { CSSProperties } from 'react'

export interface BidPickerProps {
  onBid: (n: number) => void
  /** Coach's suggested bid, highlighted (optional). */
  suggestion?: number
}

const BIDS = Array.from({ length: 14 }, (_, n) => n) // 0..13

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '8px',
  padding: '10px 16px calc(16px + env(safe-area-inset-bottom))',
}

const cellStyle: CSSProperties = {
  minHeight: '44px',
  borderRadius: '10px',
}

export function BidPicker({ onBid, suggestion }: BidPickerProps) {
  return (
    <div role="group" aria-label="Place your bid" style={gridStyle}>
      {BIDS.map((n) => {
        const suggested = n === suggestion
        return (
          <button
            key={n}
            type="button"
            className={['btn', suggested ? 'primary' : 'ghost'].join(' ')}
            style={cellStyle}
            aria-label={n === 0 ? 'Bid Nil' : `Bid ${n}`}
            aria-pressed={suggested}
            onClick={() => onBid(n)}
          >
            {n === 0 ? 'Nil' : n}
          </button>
        )
      })}
    </div>
  )
}
