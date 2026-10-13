import type { ReactNode } from 'react'
import { OptimiserRpCaveat } from '../../wallet/optimiser'

export default function OptimiserLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <OptimiserRpCaveat />
      </div>
      {children}
    </>
  )
}
