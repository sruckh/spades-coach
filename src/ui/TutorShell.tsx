// The Tutor screen: a progressive lesson list (locked / next / done), a lesson
// explanation, and an engine-driven drill with feedback. All grading flows through
// `drillRunner` (which reuses the real engine/analysis); this component only owns
// view state and records completion in the persisted UI store. Design per
// `mem:features` §Tutor. Reuses the T2 `Button`.

import { useMemo, useState } from 'react'
import type { Card } from '../types'
import { Button } from './Button'
import { CURRICULUM, lessonById } from '../tutor/curriculum'
import { cardLabel, evaluateDrill, loadDrill } from '../tutor/drillRunner'
import type { DrillResult, DrillView } from '../tutor/drillRunner'
import { useUiStore } from '../store/useUiStore'

type LessonStatus = 'done' | 'next' | 'locked'

/** First not-done lesson is `next`; earlier-completed unlock the following one. */
function computeStatuses(progress: string[]): Record<string, LessonStatus> {
  const out: Record<string, LessonStatus> = {}
  let unlocked = true
  for (const lesson of CURRICULUM) {
    if (progress.includes(lesson.id)) {
      out[lesson.id] = 'done'
      unlocked = true
      continue
    }
    out[lesson.id] = unlocked ? 'next' : 'locked'
    unlocked = false
  }
  return out
}

export function TutorShell() {
  const tutorProgress = useUiStore((s) => s.tutorProgress)
  const markLessonDone = useUiStore((s) => s.markLessonDone)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<DrillView | null>(null)
  const [result, setResult] = useState<DrillResult | null>(null)
  const [numberInput, setNumberInput] = useState('')

  const statuses = useMemo(() => computeStatuses(tutorProgress), [tutorProgress])
  const lesson = selectedId ? lessonById(selectedId) : undefined

  function openLesson(id: string) {
    if (statuses[id] === 'locked') return
    setSelectedId(id)
    setView(null)
    setResult(null)
    setNumberInput('')
  }

  function startDrill() {
    if (!lesson) return
    setView(loadDrill(lesson.drill))
    setResult(null)
    setNumberInput('')
  }

  function grade(answer: Parameters<typeof evaluateDrill>[1]) {
    if (!lesson) return
    const r = evaluateDrill(lesson.drill, answer)
    setResult(r)
    if (r.pass) markLessonDone(lesson.id)
  }

  // ---- lesson list ----
  if (!lesson) {
    return (
      <section className="tutor" aria-label="Tutor lessons">
        <h1 className="tutor-title">Learn Spades</h1>
        <ol className="lesson-list">
          {CURRICULUM.map((l) => {
            const status = statuses[l.id]
            return (
              <li key={l.id}>
                <button
                  type="button"
                  className={`lesson-item ${status}`}
                  onClick={() => openLesson(l.id)}
                  disabled={status === 'locked'}
                  aria-disabled={status === 'locked'}
                >
                  <span className="lesson-name">{l.title}</span>
                  <span className="lesson-status">{status}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    )
  }

  // ---- explanation ----
  if (!view) {
    return (
      <section className="tutor" aria-label={`${lesson.title} lesson`}>
        <h1 className="tutor-title">{lesson.title}</h1>
        <p className="lesson-body">{lesson.body}</p>
        <Button onClick={startDrill}>Start drill</Button>
        <Button variant="ghost" onClick={() => setSelectedId(null)}>
          Back to lessons
        </Button>
      </section>
    )
  }

  // ---- drill + feedback ----
  return (
    <section className="tutor" aria-label={`${lesson.title} drill`}>
      <h1 className="tutor-title">{lesson.title}</h1>
      <p className="drill-scenario">{view.scenario}</p>
      <p className="drill-prompt">{view.prompt}</p>

      {view.drill.kind === 'play' && (
        <div className="drill-hand" role="group" aria-label="Your hand">
          {view.hand.map((c: Card) => (
            <button
              key={c.id}
              type="button"
              className="drill-card"
              aria-label={c.id}
              onClick={() => grade({ card: c })}
            >
              {cardLabel(c)}
            </button>
          ))}
        </div>
      )}

      {(view.drill.kind === 'bid' || view.drill.kind === 'score') && (
        <div className="drill-number">
          <label>
            {view.drill.kind === 'bid' ? 'Your bid' : 'Your score'}
            <input
              type="number"
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
            />
          </label>
          <Button
            onClick={() =>
              grade(
                view.drill.kind === 'bid'
                  ? { bid: Number(numberInput) }
                  : { points: Number(numberInput) },
              )
            }
          >
            Check
          </Button>
        </div>
      )}

      {result && (
        <div className={`drill-feedback ${result.pass ? 'pass' : 'fail'}`} role="status">
          <strong>{result.pass ? 'Correct!' : 'Not yet'}</strong>
          <p>{result.explanation}</p>
          {!result.pass && result.ideal && <p className="drill-ideal">Try: {result.ideal}</p>}
          {result.pass && <p className="lesson-complete">Lesson complete ✓</p>}
        </div>
      )}

      <Button variant="ghost" onClick={() => setSelectedId(null)}>
        Back to lessons
      </Button>
    </section>
  )
}
