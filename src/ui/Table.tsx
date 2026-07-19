// The compass table: the four seats laid out N/E/S/W (positioning is CSS via each
// Seat's `pos` class) with the trick zone floating in the centre. Structural only.

import type { ReactNode } from 'react'
import { Seat, type SeatProps } from './Seat'

export interface TableProps {
  /** The four seats, in any order — each carries its own compass `pos`. */
  seats: SeatProps[]
  /** The centre trick zone. */
  trick?: ReactNode
}

export function Table({ seats, trick }: TableProps) {
  return (
    <section className="table" aria-label="Card table">
      {seats.map((s) => (
        <Seat key={s.pos} {...s} />
      ))}
      {trick}
    </section>
  )
}
