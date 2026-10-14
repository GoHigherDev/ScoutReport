import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NAMES } from '../../../copy/names'
import AdminMatchesPage from './page'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  console: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: 'verified-session-cookie' }),
}))
vi.mock('../../../server/session', () => ({
  getVerifiedSession: mocks.session,
}))
vi.mock('../../../wallet/sign-in-button', () => ({
  SignInButton: () => <button>{NAMES.gas.signIn}</button>,
}))
vi.mock('../../../wallet/admin-matches', () => ({
  AdminMatches: (props: unknown) => {
    mocks.console(props)
    return <div>{NAMES.admin.newMatch}</div>
  },
}))
const actor = '0x0000000000000000000000000000000000000001'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ADMIN_ADDRESSES', actor)
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it('does not render the console without a verified session', async () => {
  mocks.session.mockResolvedValue(null)
  render(await AdminMatchesPage())
  expect(screen.getByRole('alert')).toHaveTextContent(
    NAMES.admin.accessRequired,
  )
  expect(mocks.console).not.toHaveBeenCalled()
  expect(mocks.session.mock.calls[0][0].headers.get('cookie')).toBe(
    'verified-session-cookie',
  )
})

it('fails closed for an empty allowlist', async () => {
  vi.stubEnv('ADMIN_ADDRESSES', '')
  mocks.session.mockResolvedValue({ address: actor })
  render(await AdminMatchesPage())
  expect(screen.getByRole('alert')).toHaveTextContent(NAMES.admin.forbidden)
  expect(mocks.console).not.toHaveBeenCalled()
})

it('renders the console only for an allowlisted verified session', async () => {
  mocks.session.mockResolvedValue({ address: actor })
  render(await AdminMatchesPage())
  expect(mocks.console).toHaveBeenCalledWith({ actorAddress: actor })
})
