// Zustand UI-only store. Holds view state the game engine doesn't own — the Coach
// surface, its whisper, the currently selected (not yet played) card, Tutor
// progress, and player settings (tier, coach, target, speed, motion). It NEVER
// mirrors game state (hands, tricks, score all live in the boardgame.io `G`).
// Settings + Tutor progress persist to localStorage; Coach/whisper/selection are
// ephemeral session state. See `.goals/README.md` §Layer-C.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Card, Settings } from '../types'

/** Sensible first-run settings (target 200 per the fixed decisions). */
export const DEFAULT_SETTINGS: Settings = {
  tier: 'intermediate',
  coach: true,
  target: 200,
  speed: 'normal',
  motion: true,
}

export interface UiState {
  /** Is the Coach slide-up sheet showing? */
  coachOpen: boolean
  /** Master toggle: auto-suggest at decision points + allow whispers. */
  coachEnabled: boolean
  /** One-line contextual whisper shown above the hand (null = hidden). */
  whisperText: string | null
  /** The card the human has tapped but not yet confirmed to play. */
  selectedCard: Card | null
  /** Hand number whose end-of-hand score summary has been dismissed (null = none). */
  lastHandSeen: number | null
  /** Player settings (persisted). */
  settings: Settings
  /** Completed Tutor lesson ids (persisted). */
  tutorProgress: string[]

  openCoach: () => void
  closeCoach: () => void
  toggleCoach: () => void
  setCoachEnabled: (on: boolean) => void
  /** Show (or clear, with null) the contextual whisper. */
  setWhisper: (text: string | null) => void

  /** Select (or clear, with null) the card staged for play. */
  setSelectedCard: (card: Card | null) => void

  /** Dismiss the score summary for a given hand number. */
  dismissHandSummary: (handNumber: number) => void

  /** Patch one or more settings fields. */
  updateSettings: (patch: Partial<Settings>) => void

  /** Mark a lesson complete (idempotent). */
  markLessonDone: (id: string) => void
  isLessonDone: (id: string) => boolean
  /** Clear all Tutor progress. */
  resetTutor: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      coachOpen: false,
      coachEnabled: true,
      whisperText: null,
      selectedCard: null,
      lastHandSeen: null,
      settings: DEFAULT_SETTINGS,
      tutorProgress: [],

      openCoach: () => set({ coachOpen: true }),
      closeCoach: () => set({ coachOpen: false }),
      toggleCoach: () => set((s) => ({ coachOpen: !s.coachOpen })),
      setCoachEnabled: (on) => set({ coachEnabled: on }),
      setWhisper: (text) => set({ whisperText: text }),

      setSelectedCard: (card) => set({ selectedCard: card }),

      dismissHandSummary: (handNumber) => set({ lastHandSeen: handNumber }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      markLessonDone: (id) =>
        set((s) => (s.tutorProgress.includes(id) ? s : { tutorProgress: [...s.tutorProgress, id] })),
      isLessonDone: (id) => get().tutorProgress.includes(id),
      resetTutor: () => set({ tutorProgress: [] }),
    }),
    {
      name: 'spades-ui',
      // Durable: settings + Tutor progress. Coach/whisper/selection stay ephemeral.
      partialize: (s) => ({ settings: s.settings, tutorProgress: s.tutorProgress }),
    },
  ),
)
