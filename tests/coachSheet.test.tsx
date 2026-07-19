import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CoachSheet } from '../src/ui/CoachSheet'

/** An opener button + the sheet, mirroring the real "Ask the Coach" flow. */
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ask the Coach
      </button>
      <CoachSheet
        open={open}
        onClose={() => setOpen(false)}
        headline="Bid 3"
        body="Two aces and a long club suit."
        tip="Bid what you can defend."
      />
    </>
  )
}

describe('CoachSheet dialog a11y', () => {
  it('opens as a focused modal dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Ask the Coach' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // Focus lands inside the sheet, on the brass confirm button.
    expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus()
  })

  it('closes on Escape and restores focus to the opener', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Ask the Coach' })
    await user.click(opener)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes when the scrim is clicked', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Ask the Coach' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('coach-scrim'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on the "Got it" button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Ask the Coach' })
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
