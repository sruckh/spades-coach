import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Rank, Suit } from '../types'
import { Card, type CardState } from './Card'

export interface HandCard {
  rank: Rank
  suit: Suit
  state?: CardState
  /** Stable key; falls back to rank+suit+index. */
  id?: string
}

export interface HandProps {
  cards: HandCard[]
  onPlay?: (index: number) => void
  label?: string
  /** Render the whole hand face-down (Blind-Nil decision — you can't peek). */
  faceDown?: boolean
}

// Fanned-arc geometry — spread + card size ported from `index.html`. The card
// OVERLAP is computed responsively from the container width so the whole fan
// always fits (no clipped cards) at any frame width, up to the design's 30px.
const SPREAD = 34 // total degrees of fan
const CARD_W = 52
const MAX_OVERLAP = 30 // design default (used when there's room)
const MIN_OVERLAP = 14 // tightest before ranks become unreadable

/** Overlap that fits `n` cards into `width` px, clamped to the readable range. */
function fitOverlap(width: number, n: number): number {
  if (n <= 1 || width <= 0) return MAX_OVERLAP
  // width must hold the last card in full (CARD_W) + (n-1) overlaps, minus a hair of padding.
  const fit = (width - CARD_W - 4) / (n - 1)
  return Math.max(MIN_OVERLAP, Math.min(MAX_OVERLAP, fit))
}

/** Layout style for card `i` of `n` along the fan, given the current overlap. */
function fanStyle(i: number, n: number, overlap: number): CSSProperties {
  const step = n > 1 ? SPREAD / (n - 1) : 0
  const rot = -SPREAD / 2 + i * step
  const x = i * overlap
  const totalW = CARD_W + (n - 1) * overlap
  const lift = -Math.cos((rot * Math.PI) / 180) * 6 // arc lift

  const style: CSSProperties = {
    left: `calc(50% - ${totalW / 2}px + ${x}px)`,
  }
  const vars = style as Record<string, string>
  vars['--rot'] = `rotate(${rot}deg)`
  vars['--arc'] = `translateY(${lift}px)`
  return style
}

export function Hand({ cards, onPlay, label = 'Your hand', faceDown = false }: HandProps) {
  const n = cards.length
  const handRef = useRef<HTMLDivElement>(null)
  const [overlap, setOverlap] = useState(MAX_OVERLAP)

  useEffect(() => {
    const el = handRef.current
    if (!el) return
    const measure = () => setOverlap(fitOverlap(el.clientWidth, n))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])

  return (
    <div className="handwrap">
      <div className="hand" ref={handRef} role="group" aria-label={label}>
        {cards.map((card, i) => (
          <Card
            key={card.id ?? `${card.rank}${card.suit}-${i}`}
            rank={card.rank}
            suit={card.suit}
            state={card.state}
            back={faceDown}
            style={fanStyle(i, n, overlap)}
            onClick={faceDown || !onPlay ? undefined : () => onPlay(i)}
          />
        ))}
      </div>
    </div>
  )
}
