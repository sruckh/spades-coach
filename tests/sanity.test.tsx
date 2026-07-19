import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'

describe('scaffold sanity', () => {
  it('mounts the boardgame.io client and renders the game frame', () => {
    render(<App />)
    // The board renders inside the 9:16 application frame with the human's hand.
    expect(screen.getByRole('application')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /your hand/i })).toBeInTheDocument()
  })
})
