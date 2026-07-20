// Game-over overlay: a win/lose animation, then a Play Again / Exit menu. Mounts
// once the final hand's score summary is dismissed (see SpadesBoard). The win
// path fires a spade-glyph burst; both paths reveal the result menu when the
// headline lands. Reduced motion collapses everything to a fade and shows the
// menu immediately. UI-only — it dispatches no moves; "Play Again" / "Exit"
// flip store state and App remounts a fresh client.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useUiStore } from '../store/useUiStore'
import { burstVariants, gameOverVariants, type BurstParticle } from './motion'

interface GameOverProps {
  /** Did the human's team (N–S) win? */
  win: boolean
  /** Honour reduced-motion / the in-app motion setting. */
  reduced: boolean
}

// Deterministic burst geometry so the celebration is identical every win (no RNG
// in render). Fourteen spades radiate out from centre with staggered delays.
const SPARKS: BurstParticle[] = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12),
  dist: 96 + (i % 5) * 24,
  delay: (i % 7) * 0.05,
}))

export function GameOver({ win, reduced }: GameOverProps) {
  const newGame = useUiStore((s) => s.newGame)
  const setExited = useUiStore((s) => s.setExited)
  // animating → menu once the headline lands (instant path for reduced motion).
  const [showMenu, setShowMenu] = useState(false)
  const playAgainRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showMenu) return
    playAgainRef.current?.focus()
  }, [showMenu])

  // Safety net: onAnimationComplete usually reveals the menu, but if a browser
  // ever interrupts the animation (or a test runner doesn't tick it) the player
  // must never be stranded without a choice. Guarantee the menu by 1.2s.
  useEffect(() => {
    if (showMenu) return
    const t = window.setTimeout(() => setShowMenu(true), 1200)
    return () => window.clearTimeout(t)
  }, [showMenu])

  function onPlayAgain() {
    newGame()
  }

  function onExit() {
    // Reset the match first so the board behind is fresh, then attempt a real
    // close. Installed PWAs (standalone) honour window.close(); a user-opened
    // tab usually won't — so if we're still alive shortly after, swap to the
    // "safe to close" goodbye screen.
    newGame()
    try {
      window.close()
    } catch {
      /* no-op: some browsers throw on window.close() */
    }
    window.setTimeout(() => setExited(true), 450)
  }

  return (
    <div
      className={`gameover ${win ? 'win' : 'lose'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="go-title"
    >
      <div className="go-stage">
        {win && !reduced && (
          <div className="go-burst" aria-hidden="true">
            {SPARKS.map((spark, i) => (
              <motion.span
                key={i}
                className="go-spark"
                custom={spark}
                variants={burstVariants(reduced)}
                initial="initial"
                animate="animate"
              >
                ♠
              </motion.span>
            ))}
          </div>
        )}

        <motion.div
          className="go-headline"
          variants={gameOverVariants(reduced, win)}
          initial="initial"
          animate="animate"
          onAnimationComplete={() => setShowMenu(true)}
        >
          <div className="go-eyebrow">{win ? 'Partnership victory' : 'Defeat'}</div>
          <h1 id="go-title" className="go-title">
            {win ? 'You win!' : 'You lost'}
          </h1>
          <p className="go-sub">
            {win
              ? 'Your partnership reached 200 first. Well played.'
              : 'Your opponents reached 200 first. A rematch awaits.'}
          </p>
        </motion.div>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              className="result-menu"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              key="menu"
            >
              <button
                ref={playAgainRef}
                type="button"
                className="btn primary"
                onClick={onPlayAgain}
                data-testid="play-again"
              >
                Play Again
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={onExit}
                data-testid="exit-game"
              >
                Exit
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
