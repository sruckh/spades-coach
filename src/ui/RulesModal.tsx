// Official-rules overlay, opened from the Options screen. Scrollable centred
// dialog over a scrim; close via the ✕ button or Esc. The text mirrors the
// engine's actual config (Bicycle scoring — a set is 0, target 200, 4-seat
// partnership, spades trump, Blind Nil only behind 100+) so what players read is
// exactly what the game enforces. UI-only — it dispatches no moves.

import { useEffect, useRef } from 'react'
import { useUiStore } from '../store/useUiStore'

export function RulesModal() {
  const open = useUiStore((s) => s.rulesOpen)
  const close = useUiStore((s) => s.closeRules)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
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
      <div className="scrim open" onClick={close} aria-hidden="true" data-testid="rules-scrim" />
      <div
        className="rules"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        data-testid="rules"
      >
        <div className="rules-head">
          <div>
            <div className="eyebrow">How to play</div>
            <h2 id="rules-title" className="sheet-title">
              Spades — official rules
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rules-close"
            aria-label="Close rules"
            onClick={close}
            data-testid="rules-close"
          >
            ✕
          </button>
        </div>

        <div className="rules-body">
          <section>
            <h3>The game</h3>
            <p>
              Four players in two partnerships — you (South) and your AI partner (North) against
              two AI opponents (East/West). The first team to reach <strong>200</strong> points
              wins. Standard 52-card deck, no jokers. Spades are always trump.
            </p>
          </section>

          <section>
            <h3>Bidding</h3>
            <p>
              Each hand starts with one round of bidding. Every player bids the number of tricks
              they intend to win — from <strong>0 (Nil)</strong> to 13. There is no passing and no
              suit to name. A partnership's <strong>contract</strong> is the sum of both partners'
              bids: that's how many tricks the team must take.
            </p>
          </section>

          <section>
            <h3>Nil &amp; Blind Nil</h3>
            <p>
              <strong>Nil</strong> (bid 0): take zero tricks to earn <strong>+100</strong>; take
              any and pay <strong>−100</strong>. Tricks won by a failed Nil become bags for your
              side — they don't help your partner's contract.
            </p>
            <p>
              <strong>Blind Nil</strong> is a house-rule comeback bid: when your team is behind by{' '}
              <strong>100+</strong> you may bid 0 <em>before</em> looking at your hand. Make it for{' '}
              <strong>+200</strong>, fail for <strong>−200</strong>. You then pass 3 cards to your
              partner before play begins. (It can be turned off in Options.)
            </p>
          </section>

          <section>
            <h3>Play</h3>
            <p>
              The player left of the dealer leads the first trick. You must <strong>follow
              suit</strong> if you can; if not, play any card — including a spade (trump). The
              highest spade wins the trick; if no spade was played, the highest card of the suit
              led wins. The trick winner leads the next. Thirteen tricks make a hand.
            </p>
            <p>
              <strong>Breaking spades:</strong> spades cannot be led until they are
              “broken” — someone plays a spade on a non-spade lead (or a player holds only spades).
            </p>
          </section>

          <section>
            <h3>Scoring</h3>
            <p>
              <strong>Make your contract:</strong> +10 per trick bid, plus +1 per overtrick (a{' '}
              <em>bag</em>). <strong>Set (miss it):</strong> 0 points this hand. Nil and Blind Nil
              bonuses/penalties apply on top of the contract score.
            </p>
            <p>
              <strong>Sandbag rule:</strong> every 10 accumulated bags costs your team{' '}
              <strong>−100</strong> — so overtricks are a mixed blessing. Win by reaching 200; if
              both sides cross it on the same hand, the higher score wins, and an exact tie plays
              another hand.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
