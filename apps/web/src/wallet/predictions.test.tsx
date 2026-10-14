import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PredictPage from '../app/predict/page'
import { NAMES } from '../copy/names'
import type { PredictEligibility, PredictMatch } from '../lib/predict'

const mocks = vi.hoisted(() => ({
  wallet: '0x00000000000000000000000000000000000000ab' as string | undefined,
  fetch: vi.fn(),
  sign: vi.fn(),
  signIn: vi.fn(),
}))
vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.wallet, isConnected: !!mocks.wallet }),
}))
vi.mock('@wagmi/core', () => ({
  getAccount: () => ({ address: mocks.wallet }),
  signTypedData: mocks.sign,
}))
vi.mock('./config', () => ({ getWalletConfig: () => ({}) }))
vi.mock('./sign-in', () => ({ signIn: mocks.signIn }))

const address = '0x00000000000000000000000000000000000000ab'
let eligibility: PredictEligibility | null
let match: PredictMatch
let loading: Promise<Response> | undefined
let pickFailure: Response | undefined

beforeEach(() => {
  vi.clearAllMocks()
  mocks.wallet = address
  eligibility = {
    address,
    chainId: 88882,
    ageConfirmed: true,
    termsAccepted: true,
    termsVersion: '0.3',
    countryAllowed: true,
  }
  match = {
    id: 'd9e4d9e1-8ce3-45a7-b245-1ea7b54f55b4',
    sport: 'football',
    homeLabel: 'First club',
    awayLabel: 'Second club',
    kickoff: '2035-06-01T14:00:00.000Z',
    lockTime: '2035-06-01T13:00:00.000Z',
    outcomes: ['HOME', 'AWAY'],
    pointsForCorrect: 5,
    status: 'upcoming',
    result: null,
    voidReason: null,
    outcome: null,
  }
  loading = undefined
  pickFailure = undefined
  mocks.sign.mockResolvedValue('0x1234')
  mocks.signIn.mockImplementation(async () => {
    eligibility = { ...eligibility!, address }
  })
  mocks.fetch.mockImplementation(
    async (path: string, options?: RequestInit) => {
      if (path.includes('/eligibility')) {
        if (loading) return loading
        return eligibility
          ? Response.json(eligibility)
          : Response.json({}, { status: 401 })
      }
      if (path.includes('/age-confirmation')) {
        eligibility!.ageConfirmed = true
        return Response.json({ ok: true })
      }
      if (path.includes('/terms-acceptance')) {
        eligibility!.termsAccepted = true
        return Response.json({ ok: true })
      }
      if (path.includes('/nonce'))
        return Response.json({ nonce: 'a'.repeat(64) })
      if (path.includes('/picks')) {
        if (pickFailure) return pickFailure
        match.outcome = JSON.parse(options!.body as string).outcome
        return Response.json({ ok: true })
      }
      if (path.includes('/mine'))
        return Response.json({
          matches: [
            {
              ...match,
              outcome: 'HOME',
              points: match.status === 'settled' ? 5 : 0,
            },
          ],
          totalPoints: match.status === 'settled' ? 5 : 0,
          nextCursor: null,
        })
      return Response.json({ matches: [match], nextCursor: null })
    },
  )
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const element = (
    <QueryClientProvider client={client}>
      <PredictPage />
    </QueryClientProvider>
  )
  const result = render(element)
  return () => result.rerender(element)
}

async function sign(outcome = 'HOME') {
  fireEvent.click(
    await screen.findByRole('button', {
      name: `${NAMES.predict.signPick}: ${outcome}`,
    }),
  )
}

it('always shows the free-to-play banner, even disconnected, with no unsolicited API or wallet calls', () => {
  mocks.wallet = undefined
  setup()
  expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toBeInTheDocument()
  expect(screen.getByText(NAMES.predict.connect)).toBeInTheDocument()
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.sign).not.toHaveBeenCalled()
})

it('keeps the banner visible while loading and on read errors', async () => {
  mocks.fetch.mockRejectedValue(new Error('unavailable'))
  setup()
  expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toBeInTheDocument()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.predict.error,
  )
  expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toBeInTheDocument()
})

it('reloads eligibility and matches after existing SIWE sign-in', async () => {
  eligibility = null
  mocks.signIn.mockImplementation(async () => {
    eligibility = {
      address,
      chainId: 88882,
      ageConfirmed: true,
      termsAccepted: true,
      countryAllowed: true,
      termsVersion: '0.3',
    }
  })
  setup()
  fireEvent.click(
    await screen.findByRole('button', { name: NAMES.predict.signIn }),
  )
  expect(
    await screen.findByText('First club / Second club'),
  ).toBeInTheDocument()
  expect(mocks.signIn).toHaveBeenCalledOnce()
  expect(screen.queryByText(NAMES.predict.saved)).not.toBeInTheDocument()
  expect(
    mocks.fetch.mock.calls.filter(([path]) => path.includes('/eligibility'))
      .length,
  ).toBe(2)
})

it('requires both explicit age and current terms before allowing a signature', async () => {
  eligibility!.ageConfirmed = false
  eligibility!.termsAccepted = false
  setup()
  const confirm = await screen.findByRole('button', {
    name: NAMES.predict.continue,
  })
  expect(confirm).toBeDisabled()
  expect(
    await screen.findByRole('button', {
      name: `${NAMES.predict.signPick}: HOME`,
    }),
  ).toBeDisabled()
  fireEvent.click(screen.getByLabelText(NAMES.predict.confirmAge))
  expect(confirm).toBeDisabled()
  fireEvent.click(screen.getByLabelText(NAMES.predict.acceptTerms))
  fireEvent.click(confirm)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: `${NAMES.predict.signPick}: HOME` }),
    ).toBeEnabled(),
  )
  const writes = mocks.fetch.mock.calls.filter(
    ([, options]) => options?.method === 'POST',
  )
  expect(writes.map(([path]) => path)).toEqual([
    '/api/predict/age-confirmation',
    '/api/predict/terms-acceptance',
  ])
  expect(JSON.parse(writes[1][1].body)).toEqual({ version: '0.3' })
  expect(mocks.sign).not.toHaveBeenCalled()
  expect(screen.queryByText(NAMES.predict.saved)).not.toBeInTheDocument()
})

it('blocks signing when trusted eligibility says the country is unavailable', async () => {
  eligibility!.countryAllowed = false
  setup()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.predict.countryUnavailable,
  )
  expect(
    await screen.findByRole('button', {
      name: `${NAMES.predict.signPick}: HOME`,
    }),
  ).toBeDisabled()
  expect(mocks.sign).not.toHaveBeenCalled()
})

it('signs EIP-712 without sending a transaction and saves changes with fresh challenges', async () => {
  setup()
  await sign()
  expect(await screen.findByText(NAMES.predict.saved)).toBeInTheDocument()
  expect(mocks.sign).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      account: address,
      primaryType: 'Pick',
      domain: expect.objectContaining({ chainId: 88882 }),
      message: { matchId: match.id, outcome: 'HOME', nonce: 'a'.repeat(64) },
    }),
  )
  fireEvent.click(
    await screen.findByRole('button', {
      name: `${NAMES.predict.changePick}: AWAY`,
    }),
  )
  await waitFor(() =>
    expect(
      screen.getByText(`${NAMES.predict.yourPick}: AWAY`),
    ).toBeInTheDocument(),
  )
  expect(
    mocks.fetch.mock.calls.filter(([path]) => path === '/api/predict/nonce'),
  ).toHaveLength(2)
})

it('shows signing and saving states and prevents duplicate wallet prompts', async () => {
  let resolve!: (signature: string) => void
  mocks.sign.mockImplementation(
    () =>
      new Promise<string>((done) => {
        resolve = done
      }),
  )
  setup()
  await sign()
  await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce())
  expect(screen.getByText(NAMES.predict.signing)).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `${NAMES.predict.signPick}: AWAY` }),
  ).toBeDisabled()
  resolve('0x1234')
  expect(await screen.findByText(NAMES.predict.saved)).toBeInTheDocument()
})

it('handles signature rejection without posting a pick and keeps the banner', async () => {
  mocks.sign.mockRejectedValue({ code: 4001 })
  setup()
  await sign()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.predict.rejected,
  )
  expect(
    mocks.fetch.mock.calls.some(([path]) => path === '/api/predict/picks'),
  ).toBe(false)
  expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toBeInTheDocument()
})

it('does not prompt for a signature or post a pick if the challenge request fails', async () => {
  const api = mocks.fetch.getMockImplementation()!
  mocks.fetch.mockImplementation((path, options) =>
    path === '/api/predict/nonce'
      ? Promise.resolve(
          Response.json({ message: NAMES.predict.error }, { status: 503 }),
        )
      : api(path, options),
  )
  setup()
  await sign()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.predict.error,
  )
  expect(mocks.sign).not.toHaveBeenCalled()
  expect(
    mocks.fetch.mock.calls.some(([path]) => path === '/api/predict/picks'),
  ).toBe(false)
  expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toBeInTheDocument()
})

it('shows server rejection without falsely showing a saved pick', async () => {
  pickFailure = Response.json(
    { message: NAMES.predict.matchUnavailable },
    { status: 409 },
  )
  setup()
  await sign()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.predict.matchUnavailable,
  )
  expect(screen.queryByText(NAMES.predict.saved)).not.toBeInTheDocument()
})

it('does not fetch private matches for a wallet/session mismatch', async () => {
  eligibility!.address = '0x00000000000000000000000000000000000000cd'
  setup()
  expect(
    await screen.findByText(NAMES.predict.walletMismatch),
  ).toBeInTheDocument()
  expect(
    mocks.fetch.mock.calls.every(
      ([path]) => path === '/api/predict/eligibility',
    ),
  ).toBe(true)
})

it.each(['switch', 'disconnect'])(
  'does not submit a pending signature after wallet %s',
  async (action) => {
    let resolve!: (signature: string) => void
    mocks.sign.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done
        }),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    const element = () => (
      <QueryClientProvider client={client}>
        <PredictPage />
      </QueryClientProvider>
    )
    const result = render(element())
    await sign()
    await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce())
    mocks.wallet =
      action === 'switch'
        ? '0x00000000000000000000000000000000000000cd'
        : undefined
    result.rerender(element())
    resolve('0x1234')
    await waitFor(() =>
      expect(screen.queryByText(NAMES.predict.signing)).not.toBeInTheDocument(),
    )
    expect(
      mocks.fetch.mock.calls.some(([path]) => path === '/api/predict/picks'),
    ).toBe(false)
  },
)

it.each(['locked', 'settled', 'voided'] as const)(
  'disables signing for %s matches and displays London times',
  async (status) => {
    match.status = status
    setup()
    expect(
      await screen.findByText('First club / Second club'),
    ).toBeInTheDocument()
    expect(screen.getByText(NAMES.predict[status])).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Sign pick/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(`${NAMES.predict.kickoff}: 1 Jun 2035, 15:00`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${NAMES.predict.lockTime}: 1 Jun 2035, 14:00`),
    ).toBeInTheDocument()
  },
)

it('updates an upcoming match locally at the lock boundary without polling paid APIs', async () => {
  vi.useFakeTimers()
  const now = new Date('2030-01-01T00:00:00.000Z')
  vi.setSystemTime(now)
  match.lockTime = new Date(now.getTime() + 10_000).toISOString()
  setup()
  for (let flush = 0; flush < 8; flush++)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
  expect(
    screen.getByRole('button', {
      name: `${NAMES.predict.signPick}: HOME`,
    }),
  ).toBeEnabled()
  const calls = mocks.fetch.mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(
      Date.parse(match.lockTime) - Date.now() - 1,
    )
  })
  expect(screen.queryByText(NAMES.predict.locked)).not.toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(screen.getByText(NAMES.predict.locked)).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `${NAMES.predict.signPick}: HOME` }),
  ).not.toBeInTheDocument()
  expect(mocks.fetch).toHaveBeenCalledTimes(calls)
})

it('does not leak selected eligibility checkboxes to a switched wallet', async () => {
  eligibility!.ageConfirmed = false
  eligibility!.termsAccepted = false
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const element = () => (
    <QueryClientProvider client={client}>
      <PredictPage />
    </QueryClientProvider>
  )
  const result = render(element())
  fireEvent.click(await screen.findByLabelText(NAMES.predict.confirmAge))
  fireEvent.click(screen.getByLabelText(NAMES.predict.acceptTerms))
  expect(
    screen.getByRole('button', { name: NAMES.predict.continue }),
  ).toBeEnabled()
  mocks.wallet = '0x00000000000000000000000000000000000000cd'
  eligibility!.address = mocks.wallet
  result.rerender(element())
  expect(
    await screen.findByLabelText(NAMES.predict.confirmAge),
  ).not.toBeChecked()
  expect(screen.getByLabelText(NAMES.predict.acceptTerms)).not.toBeChecked()
  expect(
    screen.getByRole('button', { name: NAMES.predict.continue }),
  ).toBeDisabled()
})

it('does not leak a pending signing state to a new wallet', async () => {
  let resolve!: (signature: string) => void
  mocks.sign.mockImplementation(
    () =>
      new Promise<string>((done) => {
        resolve = done
      }),
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const element = () => (
    <QueryClientProvider client={client}>
      <PredictPage />
    </QueryClientProvider>
  )
  const result = render(element())
  await sign()
  await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce())
  mocks.wallet = '0x00000000000000000000000000000000000000cd'
  eligibility!.address = mocks.wallet
  result.rerender(element())
  expect(
    await screen.findByRole('button', {
      name: `${NAMES.predict.signPick}: HOME`,
    }),
  ).toBeEnabled()
  expect(screen.queryByText(NAMES.predict.signing)).not.toBeInTheDocument()
  resolve('0x1234')
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: `${NAMES.predict.signPick}: HOME` }),
    ).toBeEnabled(),
  )
  expect(
    mocks.fetch.mock.calls.some(([path]) => path === '/api/predict/picks'),
  ).toBe(false)
})

it('shows centralised retry guidance and Retry-After for rate-limited requests', async () => {
  pickFailure = Response.json(
    { message: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': '30' },
    },
  )
  setup()
  await sign()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    `${NAMES.predict.rateLimited} ${NAMES.predict.retryAfter}: 30.`,
  )
})

it('rejects a pending signature even if the wallet switches away and back', async () => {
  let resolve!: (signature: string) => void
  mocks.sign.mockImplementation(
    () =>
      new Promise<string>((done) => {
        resolve = done
      }),
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const element = () => (
    <QueryClientProvider client={client}>
      <PredictPage />
    </QueryClientProvider>
  )
  const result = render(element())
  await sign()
  await waitFor(() => expect(mocks.sign).toHaveBeenCalledOnce())
  mocks.wallet = undefined
  result.rerender(element())
  mocks.wallet = address
  result.rerender(element())
  resolve('0x1234')
  await waitFor(() =>
    expect(screen.queryByText(NAMES.predict.signing)).not.toBeInTheDocument(),
  )
  expect(
    mocks.fetch.mock.calls.some(([path]) => path === '/api/predict/picks'),
  ).toBe(false)
})

it.each(['settled', 'voided'] as const)(
  'shows own outcome, result, points and totals for %s',
  async (status) => {
    match.status = status
    match.result = status === 'settled' ? 'HOME' : null
    match.voidReason = status === 'voided' ? 'Fixture abandoned' : null
    setup()
    fireEvent.click(
      await screen.findByRole('button', { name: NAMES.predict.predictionsTab }),
    )
    expect(
      await screen.findByText(`${NAMES.predict.yourPick}: HOME`),
    ).toBeInTheDocument()
    const points = status === 'settled' ? 5 : 0
    expect(
      screen.getByText(`${NAMES.predict.points}: ${points}`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${NAMES.predict.totalPoints}: ${points}`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        status === 'settled'
          ? `${NAMES.predict.result}: HOME`
          : `${NAMES.predict.voidReason}: Fixture abandoned`,
      ),
    ).toBeInTheDocument()
    if (status === 'voided')
      expect(
        screen.getByText(`${NAMES.predict.result}: ${NAMES.predict.voided}`),
      ).toBeInTheDocument()
  },
)

it.each(['upcoming', 'locked'] as const)(
  'shows outcome, pending result and zero credited points on My tab for %s',
  async (status) => {
    match.status = status
    setup()
    fireEvent.click(
      await screen.findByRole('button', { name: 'My predictions' }),
    )
    expect(
      await screen.findByText(`${NAMES.predict.yourPick}: HOME`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `${NAMES.predict.result}: ${NAMES.predict.resultPending}`,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(`${NAMES.predict.points}: 0`)).toBeInTheDocument()
    expect(screen.getByText(NAMES.predict.freeToPlayBanner)).toBeInTheDocument()
  },
)
