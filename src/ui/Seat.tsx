// One compass seat: avatar + name + bid chip, positioned by `pos`. The human
// (South) renders bottom-up (chip, name, avatar) so the chip never overlaps the
// hand; partners get a "Partner" tag. Active seat glows brass. Pure presentation
// — all data comes from the board. Classes ported from `index.html` .seat.

import { Avatar } from './Avatar'
import { Chip } from './Chip'

export type SeatPos = 'north' | 'south' | 'east' | 'west'

export interface SeatProps {
  pos: SeatPos
  /** Single-letter avatar glyph (N/E/S/W). */
  initial: string
  name: string
  /** e.g. "bid 3", "Nil", "bidding…". */
  bidLabel: string
  /** Hollow chip while awaiting the bid. */
  pending?: boolean
  active?: boolean
  isYou?: boolean
  isPartner?: boolean
}

export function Seat({
  pos,
  initial,
  name,
  bidLabel,
  pending = false,
  active = false,
  isYou = false,
  isPartner = false,
}: SeatProps) {
  const cls = ['seat', pos, isYou ? 'you' : '', active ? 'active' : '']
    .filter(Boolean)
    .join(' ')

  const avatar = (
    <Avatar initial={initial} active={active} label={isYou ? 'Your seat' : `${name} seat`} />
  )
  const nameEl = <span className="name">{name}</span>
  const chip = <Chip pending={pending}>{bidLabel}</Chip>

  return (
    <div className={cls}>
      {isPartner && <span className="partner-tag">Partner</span>}
      {isYou ? (
        <>
          {chip}
          {nameEl}
          {avatar}
        </>
      ) : (
        <>
          {avatar}
          {nameEl}
          {chip}
        </>
      )}
    </div>
  )
}
