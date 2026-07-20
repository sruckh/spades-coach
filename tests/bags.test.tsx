// Bag display: (1) the end-of-hand summary always shows a bag line — even at 0
// bags taken — with the running total toward the 10-bag sandbag threshold, and
// (2) the StatusBar shows each side's running bags (💰 + count) under the score.

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerID } from '../src/types'
import { scoreHandBreakdown } from '../src/game/scoring'
import { HandSummary } from '../src/ui/HandSummary'
import { StatusBar } from '../src/ui/StatusBar'

describe('StatusBar — running bags row', () => {
  it('shows a 💰 bag line under each team with the running count', () => {
    const { container } = render(
      <StatusBar round="Hand 1" scoreUs={120} scoreThem={90} bagsUs={3} bagsThem={1} />,
    )
    // Two bag glyphs (one per team) ...
    expect(container.querySelectorAll('.bag-glyph')).toHaveLength(2)
    // ... each carrying the right running count.
    const lines = Array.from(container.querySelectorAll('.bagline')).map((el) => el.textContent)
    expect(lines.some((t) => t?.includes('3'))).toBe(true)
    expect(lines.some((t) => t?.includes('1'))).toBe(true)
  })

  it('exposes the bag counts in the score aria-label', () => {
    render(<StatusBar round="Hand 1" scoreUs={50} scoreThem={40} bagsUs={2} bagsThem={0} />)
    const score = document.querySelector('.score')
    expect(score?.getAttribute('aria-label')).toMatch(/Us 50 \(2 bags\).*Them 40 \(0 bags\)/)
  })
})

describe('HandSummary — bag line always shown', () => {
  // NS makes bid exactly (0 overtricks → 0 bags); EW takes one overtrick (1 bag).
  const bids: Record<PlayerID, number> = { '0': 3, '1': 3, '2': 2, '3': 2 }
  const tricksByPlayer: Record<PlayerID, number> = { '0': 3, '1': 4, '2': 2, '3': 2 }
  const nilKind: Record<PlayerID, null> = { '0': null, '1': null, '2': null, '3': null }
  const breakdown = scoreHandBreakdown({
    bids,
    tricksByPlayer,
    nilKind,
    bags: { NS: 0, EW: 0 },
  })

  it('shows "0 bags this hand" with the running total when none were taken', () => {
    render(
      <HandSummary
        handNumber={1}
        breakdown={breakdown}
        score={{ NS: 50, EW: 50 }}
        onContinue={vi.fn()}
      />,
    )
    expect(document.body.textContent).toMatch(/0 bags this hand \(now 0\/10\)/)
  })

  it('still shows the took-bags line with points + running total', () => {
    render(
      <HandSummary
        handNumber={1}
        breakdown={breakdown}
        score={{ NS: 50, EW: 50 }}
        onContinue={vi.fn()}
      />,
    )
    expect(document.body.textContent).toMatch(/1 bag.*\+1 \(now 1\/10\)/)
  })
})
