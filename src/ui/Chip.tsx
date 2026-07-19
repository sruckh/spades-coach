import type { ReactNode } from 'react'

export interface ChipProps {
  children: ReactNode
  /** Awaiting input (e.g. "bidding…") — hollow instead of brass. */
  pending?: boolean
}

/** Small pill for seat bids / status tallies. */
export function Chip({ children, pending = false }: ChipProps) {
  return <span className={['chip', pending ? 'pending' : ''].filter(Boolean).join(' ')}>{children}</span>
}
