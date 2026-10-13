import type { Metadata } from 'next'
import { NAMES } from '../../copy/names'
import { OptimiserPortfolio } from '../../wallet/optimiser'

export const metadata: Metadata = { title: NAMES.optimiser }

export default function OptimiserPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">{NAMES.optimiser}</h1>
      <OptimiserPortfolio />
    </main>
  )
}
