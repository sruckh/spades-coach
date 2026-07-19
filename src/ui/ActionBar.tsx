// Thumb-zone actions: "Ask the Coach" (ghost, brass dot) + the contextual primary
// (place bid / play the selected card / waiting). The board owns the labels and
// handlers; this is layout + a11y only. Classes ported from `index.html` .actions.

import { Button } from './Button'

export interface ActionBarProps {
  onAskCoach: () => void
  /** Hide the Coach button entirely when coaching is disabled. */
  coachEnabled?: boolean
  primaryLabel: string
  onPrimary?: () => void
  primaryDisabled?: boolean
}

export function ActionBar({
  onAskCoach,
  coachEnabled = true,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
}: ActionBarProps) {
  return (
    <nav className="actions" aria-label="Game actions">
      {coachEnabled && (
        <Button variant="ghost" dot aria-haspopup="dialog" onClick={onAskCoach}>
          Ask the Coach
        </Button>
      )}
      <Button variant="primary" onClick={onPrimary} disabled={primaryDisabled}>
        {primaryLabel}
      </Button>
    </nav>
  )
}
