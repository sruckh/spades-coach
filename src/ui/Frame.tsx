import type { ReactNode } from 'react'

export interface FrameProps {
  children: ReactNode
  label?: string
}

/** The 9:16 night-parlor frame — centered, ≤420px wide. Everything nests inside. */
export function Frame({ children, label = 'Spades Coach game table' }: FrameProps) {
  return (
    <main className="frame" role="application" aria-label={label}>
      {children}
    </main>
  )
}
