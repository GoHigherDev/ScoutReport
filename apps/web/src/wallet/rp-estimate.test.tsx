import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normaliseStake, FAN_TOKENS } from '@scoutreport/chain'
import type { Address } from 'viem'
import { NAMES } from '../copy/names'
import type { PortfolioRow } from './hooks'
import type { RpCalibration } from './rp-model'
import {
  readRpEstimates,
  RpEstimatePanel,
  useSociosDeclaration,
} from './rp-estimate'
import {
  OptimiserDashboard,
  OptimiserPortfolio,
  stakingCoverage,
} from './optimiser'
import OptimiserPage from '../app/optimiser/page'
import OptimiserLayout from '../app/optimiser/layout'

const mocks = vi.hoisted(() => ({
  connection: {
    address: '0x0000000000000000000000000000000000000001' as
      Address | undefined,
    isConnected: true,
  },
  calibrations: [] as RpCalibration[],
  read: vi.fn(),
  rows: [] as PortfolioRow[],
  walletKind: 'eoa',
}))
vi.mock('wagmi', () => ({ useConnection: () => mocks.connection }))
vi.mock('./hooks', () => ({
  useWalletKind: () => ({ kind: mocks.walletKind }),
  useOptimiserPortfolio: () => ({
    data: mocks.rows,
    isPending: false,
    isError: false,
  }),
}))
vi.mock('./rp-snapshot', () => ({
  getRpSnapshotReader: () => ({ read: mocks.read }),
}))
vi.mock('./rp-model', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./rp-model')>()),
  RP_CALIBRATIONS: mocks.calibrations,
}))

const copy = NAMES.optimiserCopy.rpEstimate
const key = FAN_TOKENS[0].key
let queryClient: QueryClient
const storageKey = (address: string) =>
  `scoutreport:rp-declaration:${address.toLowerCase()}`
function row(
  tokenKey = key,
  held = 3_000_000n,
  staked = 2_000_000n,
): PortfolioRow {
  return {
    key: tokenKey,
    symbol: tokenKey,
    status: 'success',
    blockNumber: 10n,
    meta: { symbol: tokenKey, name: tokenKey, decimals: 6 },
    ...normaliseStake(held, staked, 6),
  }
}
function calibration(): RpCalibration {
  const calibratedAt = Date.now() - 3600_000
  return {
    tokenKey: key,
    theta: 1234,
    distinctWallets: 5,
    reportDays: 7,
    reports: 10,
    holdoutError: 0.2,
    windowStart: new Date(calibratedAt - 14 * 86400_000).toISOString(),
    windowEnd: new Date(calibratedAt).toISOString(),
    calibratedAt: new Date(calibratedAt).toISOString(),
    blockNumber: 1n,
    poolStake: 100_000_000n,
    maxPoolDrift: 0.1,
    residuals: [-0.2, -0.1, -0.08, -0.05, -0.01, 0.01, 0.05, 0.08, 0.1, 0.2],
  }
}
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.clearAllMocks()
  localStorage.clear()
  mocks.connection.address = '0x0000000000000000000000000000000000000001'
  mocks.connection.isConnected = true
  mocks.rows = [row()]
  mocks.calibrations.splice(0)
  mocks.walletKind = 'eoa'
  mocks.read.mockImplementation(async (_owner, _token, _calibration, now) => ({
    stake: 2_000_000n,
    poolStake: 100_000_000n,
    decimals: 6,
    blockNumber: 4n,
    blockHash: 'synthetic',
    boundary: Math.floor(Date.now() / 86400_000) * 86400_000,
    readAt: now,
    upgraded: false,
  }))
  vi.stubEnv('FEATURE_RP_ESTIMATE', 'false')
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('RP_ESTIMATE_LEGAL_SIGNOFF', undefined)
})
afterEach(() => {
  cleanup()
  queryClient.clear()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('connected-owner RP panel', () => {
  it.each(['disconnected', 'missing-address'] as const)(
    'hides the enabled panel for %s while retaining all persistent caveats',
    (state) => {
      mocks.connection.isConnected = state !== 'disconnected'
      if (state === 'missing-address') mocks.connection.address = undefined
      render(
        <OptimiserLayout>
          <OptimiserPortfolio rpEstimateEnabled />
        </OptimiserLayout>,
        { wrapper },
      )
      expect(
        screen.queryByRole('region', { name: copy.title }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      for (const caveat of NAMES.optimiserCopy.caveats)
        expect(screen.getByText(caveat)).toBeInTheDocument()
      expect(mocks.read).not.toHaveBeenCalled()
    },
  )
  it.each([false, true])(
    'gates the optimiser route on the server flag %s',
    (enabled) => {
      vi.stubEnv('FEATURE_RP_ESTIMATE', String(enabled))
      render(<OptimiserPage />, { wrapper })
      expect(screen.queryByRole('region', { name: copy.title }) !== null).toBe(
        enabled,
      )
      expect(mocks.read).not.toHaveBeenCalled()
    },
  )
  it.each([
    ['production', 'test'],
    ['production', 'production'],
    [undefined, 'production'],
    ['unknown', 'production'],
  ])(
    'gates the production route on legal sign-off (VERCEL_ENV=%s, NODE_ENV=%s)',
    (vercel, node) => {
      vi.stubEnv('FEATURE_RP_ESTIMATE', 'true')
      vi.stubEnv('VERCEL_ENV', vercel)
      vi.stubEnv('NODE_ENV', node)
      const { unmount } = render(<OptimiserPage />, { wrapper })
      expect(
        screen.queryByRole('region', { name: copy.title }),
      ).not.toBeInTheDocument()
      expect(mocks.read).not.toHaveBeenCalled()
      unmount()
      vi.stubEnv('RP_ESTIMATE_LEGAL_SIGNOFF', 'true')
      render(<OptimiserPage />, { wrapper })
      expect(
        screen.getByRole('region', { name: copy.title }),
      ).toBeInTheDocument()
      expect(mocks.read).not.toHaveBeenCalled()
    },
  )
  it('renders exact approved copy and all four caveats with no financial or write controls', () => {
    render(<RpEstimatePanel rows={mocks.rows} />, { wrapper })
    expect(
      screen.getByRole('heading', { name: 'RP Estimate' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Estimated Reward Points for the tokens you already hold in this wallet.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Estimate. This figure is ScoutReport's estimate, not data from Socios. It is calibrated from Reward Points that ScoutReport users reported, and assumes this address is a Socios Wallet. Your actual Reward Points may differ or be zero. Not financial advice.",
      ),
    ).toBeInTheDocument()
    for (const caveat of NAMES.optimiserCopy.caveats)
      expect(screen.getByText(caveat)).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: 'This address is my Socios Wallet',
      }),
    ).not.toBeChecked()
    const content = screen.getByRole('region', {
      name: copy.title,
    }).textContent!
    expect(content).not.toMatch(
      /\b(?:buy|cheapest|cost per point|best value|earn up to|yield|APY|guaranteed|return|cost|price|purchase|purchasing|rank|ranking|extra.token)\b/i,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /buy|purchas|stake/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('shows safe empty calibration after declaration and does no new RPC work', () => {
    render(<RpEstimatePanel rows={mocks.rows} />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText(copy.empty)).toBeInTheDocument()
    expect(screen.queryByText(/Estimate: .*RP/)).not.toBeInTheDocument()
    expect(mocks.read).not.toHaveBeenCalled()
    expect(localStorage.getItem(storageKey(mocks.connection.address!))).toBe(
      'true',
    )
  })
  it('never reads or exposes estimates when undeclared, disconnected or portfolio reads failed', () => {
    mocks.calibrations.push(calibration())
    const { rerender } = render(<RpEstimatePanel rows={mocks.rows} />, {
      wrapper,
    })
    expect(mocks.read).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox'))
    rerender(<RpEstimatePanel rows={mocks.rows} unavailable />)
    expect(screen.getByText(copy.unavailable)).toBeInTheDocument()
    expect(screen.queryByText(/Estimate: .*RP/)).not.toBeInTheDocument()
    mocks.connection.isConnected = false
    rerender(<RpEstimatePanel rows={mocks.rows} />)
    expect(
      screen.queryByRole('region', { name: copy.title }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Estimate: .*RP/)).not.toBeInTheDocument()
  })
  it('models an explicitly declared owner, including EOA context, without treating account code as Socios proof', async () => {
    mocks.calibrations.push(calibration())
    render(<OptimiserPortfolio rpEstimateEnabled />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    const panel = screen.getByRole('region', { name: copy.title })
    await waitFor(() =>
      expect(
        within(panel).getByText(
          `${copy.perToken}: Estimate: 4.4–5.6 RP (central 4.9)`,
        ),
      ).toBeInTheDocument(),
    )
    expect(within(panel).getAllByText(/Estimate: .*RP/)).toHaveLength(1)
    expect(panel).not.toHaveTextContent(/total|cost|price|buy|purchas|rank/i)
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: /buy|purchas|stake/i }),
    ).not.toBeInTheDocument()
    expect(
      within(panel).getByText(/^Based on 10 user reports, calibrated .*.$/),
    ).toBeInTheDocument()
    expect(mocks.read).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(within(panel).queryByText(/Estimate: .*RP/)).not.toBeInTheDocument()
  })
  it('preserves missing current holdings and failures rather than substituting zero', async () => {
    mocks.calibrations.push(calibration())
    const rows = [
      row(),
      row('uncalibrated'),
      {
        key: 'failed',
        symbol: 'failed',
        status: 'failure',
        blockNumber: 10n,
      } as const,
    ]
    const results = await readRpEstimates(
      mocks.connection.address!,
      rows,
      mocks.calibrations,
      Date.now(),
    )
    expect(results.map((result) => result.state)).toEqual([
      'estimate',
      'empty',
      'unavailable',
    ])
    expect(mocks.read).toHaveBeenCalledOnce()
  })
  it('keeps configured token order and stable unknown fallbacks regardless of RP results', async () => {
    const secondKey = FAN_TOKENS[1].key
    mocks.calibrations.push(calibration(), {
      ...calibration(),
      tokenKey: secondKey,
      theta: 12340,
    })
    const rows = [row('unknown-z'), row(secondKey), row('unknown-a'), row()]
    const { rerender } = render(<RpEstimatePanel rows={rows} />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    const panel = screen.getByRole('region', { name: copy.title })
    const expected = [key, secondKey, 'unknown-a', 'unknown-z']
    const headings = () =>
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    expect(headings()).toEqual(expected)
    await waitFor(() =>
      expect(within(panel).getAllByText(/Estimate: .*RP/)).toHaveLength(2),
    )
    expect(headings()).toEqual(expected)
    const items = within(panel)
      .getByRole('heading', { name: key })
      .closest('li')!
    expect(items).toHaveTextContent(
      'Estimated points per token you hold: Estimate: 4.4–5.6 RP (central 4.9)',
    )
    const secondItem = within(panel)
      .getByRole('heading', { name: secondKey })
      .closest('li')!
    expect(secondItem).toHaveTextContent(
      'Estimated points per token you hold: Estimate: 44–56 RP (central 49)',
    )
    expect(panel).not.toHaveTextContent(/total|cost|price|buy|purchas|rank/i)
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: /buy|purchas|stake/i }),
    ).not.toBeInTheDocument()
    rerender(<RpEstimatePanel rows={[...rows].reverse()} />)
    expect(headings()).toEqual(expected)
    await waitFor(() =>
      expect(within(panel).getAllByText(/Estimate: .*RP/)).toHaveLength(2),
    )
    expect(headings()).toEqual(expected)
    mocks.calibrations[0] = { ...mocks.calibrations[0], theta: 123400 }
    fireEvent.click(screen.getByRole('button', { name: copy.refresh }))
    await waitFor(() =>
      expect(items).toHaveTextContent(
        'Estimated points per token you hold: Estimate: 440–560 RP (central 490)',
      ),
    )
    expect(mocks.read).toHaveBeenCalledTimes(6)
    expect(headings()).toEqual(expected)
  })
  it('hides already-loaded figures immediately when switching addresses and restores only that address’s declaration', async () => {
    mocks.calibrations.push(calibration())
    const owner = mocks.connection.address
    const { rerender } = render(<RpEstimatePanel rows={mocks.rows} />, {
      wrapper,
    })
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() =>
      expect(
        screen.getByText(
          `${copy.perToken}: Estimate: 4.4–5.6 RP (central 4.9)`,
        ),
      ).toBeInTheDocument(),
    )
    mocks.connection.address = '0x0000000000000000000000000000000000000002'
    rerender(<RpEstimatePanel rows={mocks.rows} />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.queryByText(/Estimate: .*RP/)).not.toBeInTheDocument()
    mocks.connection.address = owner
    rerender(<RpEstimatePanel rows={mocks.rows} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    await waitFor(() =>
      expect(
        screen.getByText(
          `${copy.perToken}: Estimate: 4.4–5.6 RP (central 4.9)`,
        ),
      ).toBeInTheDocument(),
    )
  })
  it('hides the previous midnight snapshot without polling and refreshes only on request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T23:59:59Z'))
    mocks.calibrations.push(calibration())
    render(<RpEstimatePanel rows={mocks.rows} />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(
      screen.getByText(`${copy.perToken}: Estimate: 4.4–5.6 RP (central 4.9)`),
    ).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.queryByText(/Estimate: .*RP/)).not.toBeInTheDocument()
    expect(mocks.read).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: copy.refresh }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(
      screen.getByText(`${copy.perToken}: Estimate: 4.4–5.6 RP (central 4.9)`),
    ).toBeInTheDocument()
    expect(mocks.read).toHaveBeenCalledTimes(2)
  })
  it('widens a loaded range at the 24-hour stale boundary without new reads', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T09:59:59Z'))
    const data = calibration()
    const calibratedAt = Date.now() - 86400_000 + 1000
    mocks.calibrations.push({
      ...data,
      calibratedAt: new Date(calibratedAt).toISOString(),
      windowEnd: new Date(calibratedAt).toISOString(),
      windowStart: new Date(calibratedAt - 14 * 86400_000).toISOString(),
    })
    render(<RpEstimatePanel rows={mocks.rows} />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(
      screen.getByText(`${copy.perToken}: Estimate: 4.4–5.6 RP (central 4.9)`),
    ).toBeInTheDocument()
    expect(screen.queryByText(copy.widened)).not.toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByText(copy.widened)).toBeInTheDocument()
    expect(screen.getByText(copy.widened)).toHaveTextContent('recalibrating')
    expect(
      screen.getByText(`${copy.perToken}: Estimate: 4.2–5.8 RP (central 4.9)`),
    ).toBeInTheDocument()
    expect(mocks.read).toHaveBeenCalledOnce()
  })
  it('marks an explicit open drift alert as recalibrating with the P5/P95 range', async () => {
    mocks.calibrations.push({ ...calibration(), driftAlert: true })
    render(<RpEstimatePanel rows={mocks.rows} />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() =>
      expect(
        screen.getByText(
          `${copy.perToken}: Estimate: 4.2–5.8 RP (central 4.9)`,
        ),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText(copy.widened)).toHaveTextContent('recalibrating')
  })
  it.each(['failure', 'upgrade'])('hides %s snapshots', async (reason) => {
    mocks.calibrations.push(calibration())
    if (reason === 'failure')
      mocks.read.mockRejectedValueOnce(new Error('read failed'))
    else mocks.read.mockResolvedValueOnce({ upgraded: true })
    const results = await readRpEstimates(
      mocks.connection.address!,
      [row()],
      mocks.calibrations,
      Date.now(),
    )
    expect(results).toEqual([{ state: 'unavailable' }])
  })
  it('handles disconnected, no holdings and sub-one-token empty states without snapshot work', () => {
    const { rerender } = render(<RpEstimatePanel rows={[]} />, { wrapper })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText(NAMES.wallet.empty)).toBeInTheDocument()
    rerender(<RpEstimatePanel rows={[row(key, 999_999n, 0n)]} />)
    expect(screen.getByText(copy.ineligible)).toBeInTheDocument()
    expect(mocks.read).not.toHaveBeenCalled()
  })
})

describe('client-only declaration', () => {
  it('defaults off, persists per address, and cannot leak across switching or disconnect', () => {
    const a = mocks.connection.address!
    const b: Address = '0x0000000000000000000000000000000000000002'
    const { result, rerender } = renderHook(
      ({ address }: { address?: Address }) => useSociosDeclaration(address),
      { initialProps: { address: a } as { address?: Address } },
    )
    expect(result.current.declared).toBe(false)
    act(() => result.current.setDeclared(true))
    expect(result.current.declared).toBe(true)
    rerender({ address: b })
    expect(result.current.declared).toBe(false)
    expect(localStorage.getItem(storageKey(b))).toBeNull()
    rerender({ address: undefined })
    expect(result.current.declared).toBe(false)
    rerender({ address: a })
    expect(result.current.declared).toBe(true)
    act(() => result.current.setDeclared(false))
    expect(localStorage.getItem(storageKey(a))).toBe('false')
    expect(mocks.read).not.toHaveBeenCalled()
  })
})

describe('coverage and available checklist actions', () => {
  it('counts held plus staked ownership, excludes pending-only, and uses on-chain six-decimal whole-token thresholds', () => {
    expect(
      stakingCoverage([
        row('fraction', 0n, 999_999n),
        row('whole', 0n, 1_000_000n),
        row('liquid', 1n, 0n),
        row('whole-liquid', 1_000_000n, 0n),
        row('mixed-whole', 500_000n, 500_000n),
        row('pending-only', 0n, 0n),
      ]),
    ).toEqual({ n: 1, m: 3 })
    expect(
      stakingCoverage([
        { key: 'failed', symbol: 'failed', status: 'failure', blockNumber: 1n },
      ]),
    ).toBeUndefined()
  })
  it('shows coverage, held-but-unstaked followed by watch fallback, and a real checklist anchor without write CTAs', () => {
    mocks.rows = [
      row('liquid', 1_000_000n, 0n),
      row('staked', 0n, 1_000_000n),
      row('dust', 1n, 0n),
    ]
    render(<OptimiserPortfolio />)
    const section = screen.getByRole('region', {
      name: NAMES.optimiserCopy.dashboard.heading,
    })
    expect(
      within(section).getByText('Staked on 1 of 2 Fan Tokens you hold'),
    ).toBeInTheDocument()
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'liquid: held but not staked',
      'Poll watchlists are not available yet.',
    ])
    expect(
      within(section).getByText('No polls watched.').closest('ol'),
    ).toBeNull()
    expect(screen.getAllByText(NAMES.optimiserCopy.notStaked)).toHaveLength(1)
    expect(
      screen.getByRole('rowheader', { name: /dust/ }).closest('tr'),
    ).not.toHaveTextContent(NAMES.optimiserCopy.notStaked)
    expect(section.textContent).not.toMatch(/buy|stake in/i)
    expect(within(section).getByRole('link')).toHaveAttribute(
      'href',
      '#fan-token-checklist',
    )
    expect(document.getElementById('fan-token-checklist')).toBeInTheDocument()
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
  })
  it.each([
    ['2026-07-13T12:00:00Z', '01:00'],
    ['2026-12-13T12:00:00Z', '00:00'],
    ['2026-03-28T12:00:00Z', '00:00'],
    ['2026-03-29T12:00:00Z', '01:00'],
  ])(
    'uses midnight UTC with the DST-aware UK equivalent on %s',
    (date, time) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(date))
      render(<OptimiserDashboard rows={[row()]} />)
      expect(
        screen.getByText(
          `Socios credits staking RP daily at midnight UTC (${time} UK time).`,
        ),
      ).toBeInTheDocument()
      expect(
        screen.getByText(NAMES.optimiserCopy.dashboard.allStaked),
      ).toBeInTheDocument()
      expect(
        screen.getByText(NAMES.optimiserCopy.dashboard.noPolls),
      ).toBeInTheDocument()
    },
  )
})
