export interface StatusBarProps {
  /** e.g. "Hand 3 · Spades broken". */
  round: string
  bidLabel?: string
  /** e.g. "2 / 4". */
  bidTally?: string
  scoreUs: number
  scoreThem: number
  /** Running bags carried by each side toward the 10-bag sandbag penalty. */
  bagsUs: number
  bagsThem: number
  /** Open the game-options modal (difficulty, Blind Nil, …). */
  onOptions?: () => void
}

/** Top zone: round line · your bid/made · running score + bags, on the felt. */
export function StatusBar({
  round,
  bidLabel = 'Your bid',
  bidTally,
  scoreUs,
  scoreThem,
  bagsUs,
  bagsThem,
  onOptions,
}: StatusBarProps) {
  // Brass (gold) marks the side currently in the lead — an exact tie highlights
  // neither, keeping the accent rare and meaningful. A ▲ backs up the colour.
  const leader = scoreUs === scoreThem ? null : scoreUs > scoreThem ? 'us' : 'them'
  return (
    <header className="status">
      <div className="status-lead">
        {onOptions && (
          <button type="button" className="gear" onClick={onOptions} aria-label="Game options">
            <span aria-hidden="true">⚙</span>
          </button>
        )}
        <div className="round">{round}</div>
        {bidTally !== undefined && (
          <div className="bidbar">
            <span className="label">{bidLabel}</span>
            <span className="tally">{bidTally}</span>
          </div>
        )}
      </div>
      <div
        className="score"
        aria-label={`Score — Us ${scoreUs} (${bagsUs} bags), Them ${scoreThem} (${bagsThem} bags)`}
      >
        <div className={`score-col${leader === 'us' ? ' leading' : ''}`}>
          <span className="pts">{scoreUs}</span>
          <span className="who">
            {leader === 'us' && <span className="crown" aria-hidden="true">▲ </span>}Us
          </span>
          <span className="bagline">
            <span className="bag-glyph" aria-hidden="true">💰</span>
            {bagsUs}
          </span>
        </div>
        <div className={`score-col${leader === 'them' ? ' leading' : ''}`}>
          <span className="pts">{scoreThem}</span>
          <span className="who">
            {leader === 'them' && <span className="crown" aria-hidden="true">▲ </span>}Them
          </span>
          <span className="bagline">
            <span className="bag-glyph" aria-hidden="true">💰</span>
            {bagsThem}
          </span>
        </div>
      </div>
    </header>
  )
}
