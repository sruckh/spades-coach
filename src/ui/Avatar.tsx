export interface AvatarProps {
  /** Single letter for the seat (N/E/S/W). */
  initial: string
  label?: string
  /** Highlight when it's this seat's turn. */
  active?: boolean
}

export function Avatar({ initial, label, active = false }: AvatarProps) {
  return (
    <div className={['avatar', active ? 'active' : ''].filter(Boolean).join(' ')} aria-label={label}>
      {initial}
    </div>
  )
}
