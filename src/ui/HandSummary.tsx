// End-of-hand score summary: an itemised, plain-language breakdown of how each
// side's points moved this hand — contract made/set, overtrick bags, Nil
// bonuses, the sandbag penalty, and the net swing. Presentation only: it reads
// the engine's `scoreHandBreakdown` result (via `G.lastHand`) and never
// re-derives scoring. Built on the Coach's slide-up sheet visual language.

import { useEffect, useRef } from 'react'
import type { TeamBreakdown } from '../game/scoring'
import type { Team } from '../types'

export interface HandSummaryProps {
  /** Hand number this summary belongs to. */
  handNumber: number
  /** Both teams' itemised results for the hand. */
  breakdown: Record<Team, TeamBreakdown>
  /** Running totals after this hand. */
  score: Record<Team, number>
  /** Dismiss and continue to the next hand (or the result). */
  onContinue: () => void
  /** True once a side has reached the target — this was the final hand. */
  gameover?: boolean
}

const TEAM_LABEL: Record<Team, string> = { NS: 'You & Nora', EW: 'East & West' }

const TEAMS: readonly Team[] = ['NS', 'EW']

/** Signed points, e.g. 50 → "+50", -100 → "-100". */
function pts(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

type Line = { text: string; tone?: 'good' | 'warn' }

/** The plain-language reasons a team's score moved this hand. */
function reasons(b: TeamBreakdown): Line[] {
  const out: Line[] = []

  if (b.bid > 0) {
    out.push(
      b.made
        ? { text: `Made bid ${b.bid} — took ${b.contractTricks}, ${pts(b.contractPoints)}`, tone: 'good' }
        : { text: `Set — bid ${b.bid}, took only ${b.contractTricks} → 0`, tone: 'warn' },
    )
  }

  for (const n of b.nils) {
    const kind = n.kind === 'blindnil' ? 'Blind Nil' : 'Nil'
    out.push(
      n.made
        ? { text: `${kind} made — ${pts(n.delta)}`, tone: 'good' }
        : {
            text: `${kind} failed (${n.tricks} trick${n.tricks === 1 ? '' : 's'}) — ${pts(n.delta)}`,
            tone: 'warn',
          },
    )
  }

  if (b.bagsThisHand > 0) {
    out.push({
      text: `${b.bagsThisHand} bag${b.bagsThisHand === 1 ? '' : 's'} — ${pts(b.bagsThisHand)} (now ${b.bagsAfter}/10)`,
      tone: 'warn',
    })
  }

  if (b.sandbagPenalty < 0) {
    out.push({ text: `Reached 10 bags — sandbag ${pts(b.sandbagPenalty)}`, tone: 'warn' })
  }

  if (out.length === 0) out.push({ text: 'No change this hand.' })
  return out
}

export function HandSummary({ handNumber, breakdown, score, onContinue, gameover }: HandSummaryProps) {
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    btnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.stopPropagation()
        onContinue()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onContinue])

  return (
    <>
      <div className="scrim open" aria-hidden="true" />
      <div
        className="coach summary open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-title"
      >
        <div className="grip" aria-hidden="true" />
        <div className="eyebrow">Hand {handNumber} · scored</div>
        <h2 id="summary-title" className="sheet-title">
          {gameover ? 'Final hand' : 'How the hand scored'}
        </h2>

        <div className="sum-teams">
          {TEAMS.map((team) => {
            const b = breakdown[team]
            return (
              <div className="sum-team" key={team}>
                <div className="sum-head">
                  <span className="sum-name">{TEAM_LABEL[team]}</span>
                  <span className={`sum-net ${b.points >= 0 ? 'good' : 'warn'}`}>{pts(b.points)}</span>
                </div>
                <ul className="sum-lines">
                  {reasons(b).map((r, i) => (
                    <li key={i} className={r.tone ?? ''}>
                      {r.text}
                    </li>
                  ))}
                </ul>
                <div className="sum-total">Total {score[team]}</div>
              </div>
            )
          })}
        </div>

        <button ref={btnRef} type="button" className="gotit" onClick={onContinue}>
          {gameover ? 'See result' : 'Continue'}
        </button>
      </div>
    </>
  )
}
