import type { ButtonHTMLAttributes } from 'react'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`rounded px-4 py-2 font-medium ${className}`.trim()}
      {...props}
    />
  )
}
