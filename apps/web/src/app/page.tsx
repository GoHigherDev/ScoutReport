import { NAMES } from '../copy/names'

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-sr-text">{NAMES.product}</h1>
    </main>
  )
}
