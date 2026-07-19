export interface StatusBarProps {
  /** e.g. "Hand 3 · Spades broken". */
  round: string
  bidLabel?: string
  /** e.g. "2 / 4". */
  bidTally?: string
  scoreUs: number
  scoreThem: number
}

/** Top zone: round line · your bid/made · running score, on the felt. */
export function StatusBar({
  round,
  bidLabel = 'Your bid',
  bidTally,
  scoreUs,
  scoreThem,
}: StatusBarProps) {
  // Brass (gold) marks the side currently in the lead — an exact tie highlights
  // neither, keeping the accent rare and meaningful. A ▲ backs up the colour.
  const leader = scoreUs === scoreThem ? null : scoreUs > scoreThem ? 'us' : 'them'
  return (
    <header className="status">
      <div>
        <div className="round">{round}</div>
        {bidTally !== undefined && (
          <div className="bidbar">
            <span className="label">{bidLabel}</span>
            <span className="tally">{bidTally}</span>
          </div>
        )}
      </div>
      <div className="score" aria-label={`Score — Us ${scoreUs}, Them ${scoreThem}`}>
        <div className={`score-col${leader === 'us' ? ' leading' : ''}`}>
          <span className="pts">{scoreUs}</span>
          <span className="who">
            {leader === 'us' && <span className="crown" aria-hidden="true">▲ </span>}Us
          </span>
        </div>
        <div className={`score-col${leader === 'them' ? ' leading' : ''}`}>
          <span className="pts">{scoreThem}</span>
          <span className="who">
            {leader === 'them' && <span className="crown" aria-hidden="true">▲ </span>}Them
          </span>
        </div>
      </div>
    </header>
  )
}
