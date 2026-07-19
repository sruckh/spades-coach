import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Rank, Suit } from '../src/types'
import { Card } from '../src/ui/Card'
import { Hand, type HandCard } from '../src/ui/Hand'

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUITS: Suit[] = ['S', 'H', 'D', 'C']

const fullHand: HandCard[] = RANKS.map((rank, i) => ({
  rank,
  suit: SUITS[i % SUITS.length],
  id: `${rank}-${i}`,
}))

describe('Hand', () => {
  it('renders exactly 13 Card elements for a full hand', () => {
    const { container } = render(<Hand cards={fullHand} />)
    expect(container.querySelectorAll('.pc')).toHaveLength(13)
  })
})

describe('Card state classes', () => {
  it('applies the locked class for state="locked"', () => {
    const { container } = render(<Card rank="A" suit="S" state="locked" />)
    const card = container.querySelector('.pc')
    expect(card).not.toBeNull()
    expect(card?.classList.contains('locked')).toBe(true)
  })

  it('applies the playable class for state="playable"', () => {
    const { container } = render(<Card rank="A" suit="H" state="playable" />)
    const card = container.querySelector('.pc')
    expect(card).not.toBeNull()
    expect(card?.classList.contains('playable')).toBe(true)
  })
})
