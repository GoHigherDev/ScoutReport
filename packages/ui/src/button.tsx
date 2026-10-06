import type { ButtonHTMLAttributes } from 'react'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const variants = {
  primary:
    'bg-sr-accent text-sr-bg hover:brightness-110 focus-visible:outline-sr-accent',
  secondary:
    'border border-sr-secondary text-sr-text hover:bg-sr-secondary focus-visible:outline-sr-accent',
  ghost: 'text-sr-text hover:bg-sr-surface focus-visible:outline-sr-accent',
}

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-md px-4 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
