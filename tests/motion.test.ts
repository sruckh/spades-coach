// Motion variants must be defined and gated behind reduced motion: with the flag
// set they collapse to opacity-only cross-fades (no travel/scale), and with it
// clear they carry the real transforms. Durations match the design contract.

import { describe, expect, it } from 'vitest'
import {
  MOTION_MS,
  bidPulseVariants,
  cardPlayVariants,
  liftTransition,
  sheetVariants,
} from '../src/ui/motion'

describe('motion durations', () => {
  it('matches the design contract (ms)', () => {
    expect(MOTION_MS).toEqual({
      card: 320,
      trickCollect: 420,
      bidPulse: 500,
      sheet: 300,
      lift: 180,
      gameOver: 700,
      burst: 900,
    })
  })
})

describe('cardPlayVariants', () => {
  it('travels + scales when motion is allowed', () => {
    const v = cardPlayVariants(false)
    const initial = v.initial as Record<string, unknown>
    const animate = v.animate as Record<string, unknown>
    expect(initial.y).toBe(-22)
    expect(initial.scale).toBe(0.9)
    expect(animate.y).toBe(0)
  })

  it('cross-fades only when reduced', () => {
    const v = cardPlayVariants(true)
    const initial = v.initial as Record<string, unknown>
    const animate = v.animate as Record<string, unknown>
    // No transform props — opacity only.
    expect(initial.y).toBeUndefined()
    expect(initial.scale).toBeUndefined()
    expect(animate.y).toBeUndefined()
    expect(initial.opacity).toBe(0)
    expect(animate.opacity).toBe(1)
  })
})

describe('bidPulseVariants', () => {
  it('pulses (scale keyframes) when allowed, but not when reduced', () => {
    const full = bidPulseVariants(false).animate as Record<string, unknown>
    expect(Array.isArray(full.scale)).toBe(true)

    const reduced = bidPulseVariants(true).animate as Record<string, unknown>
    expect(reduced.scale).toBeUndefined()
    expect(reduced.opacity).toBe(1)
  })
})

describe('sheetVariants + liftTransition', () => {
  it('rises when allowed, fades when reduced', () => {
    expect((sheetVariants(false).initial as Record<string, unknown>).y).toBe('105%')
    expect((sheetVariants(true).initial as Record<string, unknown>).y).toBeUndefined()
  })

  it('lift is quicker under reduced motion', () => {
    expect((liftTransition(false) as Record<string, unknown>).duration).toBeCloseTo(0.18)
    expect((liftTransition(true) as Record<string, unknown>).duration).toBeCloseTo(0.15)
  })
})
