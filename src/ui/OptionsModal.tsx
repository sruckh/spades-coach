// Startup game-options modal: pick difficulty, table speed, whether Blind Nil is
// allowed, and whether the Coach button shows. Writes straight to the settings
// store (persisted); changing difficulty rebuilds the match at that tier. Shown
// once per session and reopenable from the status-bar ⚙. UI-only — it dispatches
// no game moves.

import { useEffect, useRef } from 'react'
import type { Settings, Tier } from '../types'
import { useUiStore } from '../store/useUiStore'

const TIERS: { value: Tier; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Gentle bots, straightforward play.' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Seat tactics and bag awareness.' },
  { value: 'expert', label: 'Expert', hint: 'Counts cards, sets, and sandbags.' },
]

const SPEEDS: Settings['speed'][] = ['slow', 'normal', 'fast']

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function OptionsModal() {
  const open = useUiStore((s) => s.optionsOpen)
  const close = useUiStore((s) => s.closeOptions)
  const settings = useUiStore((s) => s.settings)
  const update = useUiStore((s) => s.updateSettings)
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    startRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <>
      <div className="scrim open" onClick={close} aria-hidden="true" data-testid="options-scrim" />
      <div className="options" role="dialog" aria-modal="true" aria-labelledby="options-title">
        <div className="eyebrow">Game options</div>
        <h2 id="options-title" className="sheet-title">
          Set up your game
        </h2>

        <div className="opt-field">
          <div className="opt-label">Difficulty</div>
          <div className="segmented" role="group" aria-label="Difficulty">
            {TIERS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`seg${settings.tier === t.value ? ' on' : ''}`}
                aria-pressed={settings.tier === t.value}
                onClick={() => update({ tier: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="opt-hint">{TIERS.find((t) => t.value === settings.tier)?.hint}</div>
        </div>

        <div className="opt-field">
          <div className="opt-label">Table speed</div>
          <div className="segmented" role="group" aria-label="Table speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`seg${settings.speed === s ? ' on' : ''}`}
                aria-pressed={settings.speed === s}
                onClick={() => update({ speed: s })}
              >
                {cap(s)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={settings.allowBlindNil}
          className={`opt-switch${settings.allowBlindNil ? ' on' : ''}`}
          onClick={() => update({ allowBlindNil: !settings.allowBlindNil })}
        >
          <span className="opt-switch-text">
            <span className="opt-label">Allow Blind Nil</span>
            <span className="opt-hint">
              When behind 100+, bid blind sight-unseen for ±200, then pass 3 cards to your partner.
            </span>
          </span>
          <span className="opt-knob" aria-hidden="true" />
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={settings.coach}
          className={`opt-switch${settings.coach ? ' on' : ''}`}
          onClick={() => update({ coach: !settings.coach })}
        >
          <span className="opt-switch-text">
            <span className="opt-label">Coach</span>
            <span className="opt-hint">Show the “Ask the Coach” button during play.</span>
          </span>
          <span className="opt-knob" aria-hidden="true" />
        </button>

        <button ref={startRef} type="button" className="gotit" onClick={close}>
          Start playing
        </button>
      </div>
    </>
  )
}
