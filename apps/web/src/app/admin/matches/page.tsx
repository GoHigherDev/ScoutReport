import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { NAMES } from '../../../copy/names'
import { requireAdmin } from '../../../server/admin'
import { HttpError } from '../../../server/http'
import { getVerifiedSession } from '../../../server/session'
import { SignInButton } from '../../../wallet/sign-in-button'
import { AdminMatches } from '../../../wallet/admin-matches'

export const metadata: Metadata = { title: NAMES.admin.heading }
export const dynamic = 'force-dynamic'

export default async function AdminMatchesPage() {
  const requestHeaders = await headers()
  const session = await getVerifiedSession(
    new Request('http://localhost/admin/matches', {
      headers: { cookie: requestHeaders.get('cookie') ?? '' },
    }),
  )
  try {
    requireAdmin(session)
  } catch (error) {
    if (!(error instanceof HttpError)) throw error
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <h1 className="text-3xl font-bold">{NAMES.admin.heading}</h1>
        <p role="alert">
          {session ? NAMES.admin.forbidden : NAMES.admin.accessRequired}
        </p>
        <SignInButton />
        <a className="block underline" href="/admin/matches">
          {NAMES.admin.reopen}
        </a>
      </main>
    )
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">{NAMES.admin.heading}</h1>
      <AdminMatches />
    </main>
  )
}
