import type { HTMLAttributes, ReactNode } from 'react'

export type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Card({ className = '', ...props }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-sr-border bg-sr-surface p-5 text-sr-text ${className}`.trim()}
      {...props}
    />
  )
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  variant?:
    'default' | 'accent' | 'secondary' | 'success' | 'warning' | 'danger'
}

const badgeVariants = {
  default: 'bg-sr-surface text-sr-text',
  accent: 'bg-sr-accent text-sr-bg',
  secondary: 'bg-sr-secondary text-sr-text',
  success: 'bg-sr-success text-sr-bg',
  warning: 'bg-sr-warning text-sr-bg',
  danger: 'bg-sr-danger text-sr-bg',
}

export function Badge({
  children,
  className = '',
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${badgeVariants[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  )
}

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`w-full border-collapse text-left text-sr-text ${className}`.trim()}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export type BannerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  variant?: 'info' | 'warning' | 'danger'
}

const bannerVariants = {
  info: 'border-sr-secondary bg-sr-surface text-sr-text',
  warning: 'border-sr-warning bg-sr-surface text-sr-warning',
  danger: 'border-sr-danger bg-sr-surface text-sr-danger',
}

export function Banner({
  children,
  className = '',
  variant = 'info',
  ...props
}: BannerProps) {
  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${bannerVariants[variant]} ${className}`.trim()}
      role="status"
      {...props}
    >
      {children}
    </div>
  )
}

export type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-sr-secondary ${className}`.trim()}
      {...props}
    />
  )
}

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string
  description?: string
  children?: ReactNode
}

export function EmptyState({
  title,
  description,
  children,
  className = '',
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-sr-border bg-sr-surface p-8 text-center text-sr-text ${className}`.trim()}
      {...props}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-2 text-sr-muted">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
