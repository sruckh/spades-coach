// The Coach surface: a slide-up dialog sheet (built on the T2 sheet visual
// language — scrim, grip, eyebrow, Fraunces headline, tip, brass "Got it"). Adds
// full dialog a11y: opens focused, traps Tab, closes on Esc / scrim, and restores
// focus to the opener on close. It only ever calls `onClose` — the Coach never
// dispatches a game move. Styling per `mem:design_system` §Coach.

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export interface CoachSheetProps {
  open: boolean
  onClose: () => void
  eyebrow?: ReactNode
  headline: ReactNode
  body?: ReactNode
  tip?: ReactNode
  /** Brass confirm button label. */
  actionLabel?: string
  titleId?: string
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function CoachSheet({
  open,
  onClose,
  eyebrow = 'Coach',
  headline,
  body,
  tip,
  actionLabel = 'Got it',
  titleId = 'coach-title',
}: CoachSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  // On open: remember the opener and pull focus into the sheet. On close/unmount:
  // hand focus back to wherever it was (the "Ask the Coach" button, typically).
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()
    return () => restoreRef.current?.focus?.()
  }, [open])

  // Esc closes; Tab is trapped within the dialog.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const nodes = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="scrim open" onClick={onClose} aria-hidden="true" data-testid="coach-scrim" />
      <div
        className="coach open"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="grip" aria-hidden="true" />
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 id={titleId} className="sheet-title">
          {headline}
        </h2>
        {body && <p>{body}</p>}
        {tip && <p className="tip">{tip}</p>}
        <button ref={confirmRef} type="button" className="gotit" onClick={onClose}>
          {actionLabel}
        </button>
      </div>
    </>
  )
}
