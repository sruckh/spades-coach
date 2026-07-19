import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TutorShell } from '../src/ui/TutorShell'
import { useUiStore } from '../src/store/useUiStore'
import { CURRICULUM } from '../src/tutor/curriculum'
import { loadDrill } from '../src/tutor/drillRunner'

describe('TutorShell end-to-end', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ tutorProgress: [] })
  })

  it('runs the Basics lesson: explain → act → feedback → marked done', async () => {
    const user = userEvent.setup()
    render(<TutorShell />)

    // Lesson list → open the first (unlocked) lesson.
    await user.click(screen.getByRole('button', { name: /Basics/ }))

    // Explanation is shown.
    expect(screen.getByText(/follow the suit that was led/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start drill' }))

    // Drill: play a card the engine deems legal (same deterministic seed as the shell).
    const view = loadDrill(CURRICULUM[0].drill)
    const legalId = view.legal[0].id
    await user.click(screen.getByRole('button', { name: legalId }))

    // Feedback + completion.
    expect(screen.getByRole('status')).toHaveTextContent(/Correct/i)
    expect(screen.getByText(/Lesson complete/i)).toBeInTheDocument()
    expect(useUiStore.getState().tutorProgress).toContain('basics')
  })

  it('locks lessons until the previous one is complete', () => {
    useUiStore.setState({ tutorProgress: [] })
    render(<TutorShell />)
    // Advanced is last → locked at the start.
    const advanced = screen.getByRole('button', { name: /Advanced/ })
    expect(advanced).toBeDisabled()
  })
})
