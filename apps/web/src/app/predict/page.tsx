import type { Metadata } from 'next'
import { NAMES } from '../../copy/names'
import { Predictions } from '../../wallet/predictions'

export const metadata: Metadata = { title: NAMES.predict.heading }

export default function PredictPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">{NAMES.predict.heading}</h1>
      <p className="rounded-md border border-sr-border p-4" role="note">
        {NAMES.predict.freeToPlayBanner}
      </p>
      <Predictions />
    </main>
  )
}
