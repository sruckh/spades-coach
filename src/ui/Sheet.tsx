import { useEffect } from 'react'
import type { ReactNode } from 'react'

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Small caps overline, e.g. "Coach · this trick". */
  eyebrow?: ReactNode
  /** Fraunces headline. */
  title?: ReactNode
  titleId?: string
  children?: ReactNode
}

/**
 * Bottom slide-up sheet (the Coach surface). Controlled: parent owns `open`.
 * Full focus-trap + whisper mode land in T8; T2 provides the primitive shell with
 * scrim, Escape-to-close, and dialog semantics.
 */
export function Sheet({
  open,
  onClose,
  eyebrow,
  title,
  titleId = 'sheet-title',
  children,
}: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={['scrim', open ? 'open' : ''].filter(Boolean).join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={['coach', open ? 'open' : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-hidden={!open}
      >
        <div className="grip" aria-hidden="true" />
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && (
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
        )}
        {children}
      </aside>
    </>
  )
}
