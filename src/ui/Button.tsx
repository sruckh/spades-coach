import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  /** Leading brass status dot (used by "Ask the Coach"). */
  dot?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  dot = false,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={['btn', variant, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </button>
  )
}
