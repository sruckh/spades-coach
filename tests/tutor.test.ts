import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CURRICULUM } from '../src/tutor/curriculum'
import { evaluateDrill, loadDrill } from '../src/tutor/drillRunner'
import * as engine from '../src/game/Spades'
import * as scoringModule from '../src/game/scoring'
import { suggestBid } from '../src/analysis/suggestBid'
import { useUiStore } from '../src/store/useUiStore'

const byId = (id: string) => {
  const l = CURRICULUM.find((x) => x.id === id)
  if (!l) throw new Error(`no lesson ${id}`)
  return l
}

describe('curriculum', () => {
  it('defines the five progressive lessons, each with a drill', () => {
    expect(CURRICULUM.length).toBeGreaterThanOrEqual(5)
    for (const id of ['basics', 'bidding', 'scoring', 'tactics', 'advanced']) {
      const lesson = byId(id)
      expect(lesson.title.length).toBeGreaterThan(0)
      expect(lesson.body.length).toBeGreaterThan(0)
      expect(lesson.drill).toBeTruthy()
      expect(['bid', 'play', 'score']).toContain(lesson.drill.kind)
    }
  })
})

describe('drillRunner grades with the real engine/analysis', () => {
  it('scoring drill reuses the engine scoreHand', () => {
    const drill = byId('scoring').drill
    if (drill.kind !== 'score') throw new Error('expected score drill')

    // Independently compute the engine answer, then confirm the drill agrees.
    const expected = scoringModule.scoreHand({
      ...drill.setup,
      nilKind: drill.setup.nilKind ?? { '0': null, '1': null, '2': null, '3': null },
    })[drill.setup.team].points

    const spy = vi.spyOn(scoringModule, 'scoreHand')
    const good = evaluateDrill(drill, { points: expected })
    expect(spy).toHaveBeenCalled()
    expect(good.pass).toBe(true)
    expect(evaluateDrill(drill, { points: expected + 5 }).pass).toBe(false)
    spy.mockRestore()
  })

  it('play drill reuses the engine legalPlaysFor for legality', () => {
    const drill = byId('basics').drill
    if (drill.kind !== 'play') throw new Error('expected play drill')

    const view = loadDrill(drill)
    const spy = vi.spyOn(engine, 'legalPlaysFor')

    // A legal follow passes.
    const legalCard = view.legal[0]
    expect(evaluateDrill(drill, { card: legalCard }).pass).toBe(true)

    // An off-suit card while holding the led suit is rejected as illegal.
    const led = view.trick?.suitLed
    const offSuit = view.hand.find((c) => c.suit !== led)
    if (offSuit && view.hand.some((c) => c.suit === led)) {
      const r = evaluateDrill(drill, { card: offSuit })
      expect(r.pass).toBe(false)
      expect(r.explanation).toMatch(/follow/i)
    }

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('bidding drill accepts the book bid and explains', () => {
    const drill = byId('bidding').drill
    if (drill.kind !== 'bid') throw new Error('expected bid drill')
    const hand = loadDrill(drill).hand
    const bookBid = suggestBid(hand, 'intermediate').bid

    const bidResult = evaluateDrill(drill, { bid: bookBid })
    expect(bidResult.pass).toBe(true)
    expect(bidResult.explanation.length).toBeGreaterThan(0)
    // A bid far off the book fails (tolerance is 1).
    expect(evaluateDrill(drill, { bid: bookBid + 5 }).pass).toBe(false)
  })
})

describe('tutor progress persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({ tutorProgress: [] })
  })

  it('marks lessons done idempotently', () => {
    useUiStore.getState().markLessonDone('basics')
    useUiStore.getState().markLessonDone('basics')
    expect(useUiStore.getState().tutorProgress).toEqual(['basics'])
    expect(useUiStore.getState().isLessonDone('basics')).toBe(true)
  })

  it('survives a store reload (rehydrate from localStorage)', async () => {
    useUiStore.getState().markLessonDone('basics')
    const snapshot = localStorage.getItem('spades-ui')
    expect(snapshot).toContain('basics')

    // Simulate a page reload: clear memory but keep the stored snapshot, then rehydrate.
    useUiStore.setState({ tutorProgress: [] })
    localStorage.setItem('spades-ui', snapshot as string)
    await useUiStore.persist.rehydrate()

    expect(useUiStore.getState().tutorProgress).toContain('basics')
  })
})
