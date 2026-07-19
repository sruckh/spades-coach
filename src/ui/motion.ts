// Motion variants for the play UI, mapped to `mem:design_system` §Motion. Every
// factory takes a `reduced` flag: when the viewer prefers reduced motion (or the
// in-app motion setting is off) the variant collapses to a plain opacity
// cross-fade — no seat→zone travel, no brass pulse, no lift. Consumed by the
// board's `motion.*` elements. Framework glue only; no rules here.

import type { Transition, Variants } from 'motion/react'

/** Canonical durations in milliseconds (design contract). */
export const MOTION_MS = {
  /** Card played: seat → trick zone. */
  card: 320,
  /** Trick collected: sweep to the winner's seat. */
  trickCollect: 420,
  /** Bid made: brass pulse. */
  bidPulse: 500,
  /** Coach sheet rise. */
  sheet: 300,
  /** Playable-card lift. */
  lift: 180,
} as const

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const

/** Seconds helper for framer-motion (which wants seconds, not ms). */
const secs = (ms: number) => ms / 1000

/** A card landing in the trick zone. Reduced → fade only (no travel/scale). */
export function cardPlayVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: secs(MOTION_MS.sheet) } },
      exit: { opacity: 0, transition: { duration: secs(MOTION_MS.sheet) } },
    }
  }
  return {
    initial: { opacity: 0, y: -22, scale: 0.9 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: secs(MOTION_MS.card), ease: EASE_OUT },
    },
    exit: {
      opacity: 0,
      scale: 0.94,
      transition: { duration: secs(MOTION_MS.trickCollect), ease: EASE_OUT },
    },
  }
}

/** Brass pulse when a bid is made. Reduced → fade only (no scale pulse). */
export function bidPulseVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: secs(MOTION_MS.sheet) } },
    }
  }
  return {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: 1,
      scale: [0.8, 1.12, 1],
      transition: { duration: secs(MOTION_MS.bidPulse), ease: EASE_OUT },
    },
  }
}

/** Coach slide-up sheet. Reduced → fade only (no rise). */
export function sheetVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: secs(MOTION_MS.sheet) } },
      exit: { opacity: 0, transition: { duration: secs(MOTION_MS.sheet) } },
    }
  }
  return {
    initial: { opacity: 0, y: '105%' },
    animate: { opacity: 1, y: 0, transition: { duration: secs(MOTION_MS.sheet), ease: EASE_OUT } },
    exit: { opacity: 0, y: '105%', transition: { duration: secs(MOTION_MS.sheet), ease: EASE_OUT } },
  }
}

/** Playable-card lift on hover/select. Reduced → no transform, quick fade only. */
export function liftTransition(reduced: boolean): Transition {
  return reduced
    ? { duration: 0.15, ease: 'easeOut' }
    : { duration: secs(MOTION_MS.lift), ease: EASE_OUT }
}
