import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normaliseStake } from '@scoutreport/chain'
import OptimiserPage from '../app/optimiser/page'
import OptimiserLayout from '../app/optimiser/layout'
import { NAMES, OPTIMISER_EARN_ROUTES } from '../copy/names'
import type { PortfolioRow } from './hooks'
import { OptimiserEarnRoutes, OptimiserRpCaveat } from './optimiser'
import pendingFixture from '../../../../packages/chain/src/fixtures/pending-unstakes.json'

const mocks = vi.hoisted(() => ({
  connection: {
    isConnected: true,
    address: '0x0000000000000000000000000000000000000001',
    chainId: 88882,
  },
  portfolio: {
    isPending: false,
    isError: false,
    data: [] as PortfolioRow[],
    refetch: vi.fn(),
  },
  usePortfolio: vi.fn(),
  useWalletKind: vi.fn(),
}))
vi.mock('wagmi', () => ({ useConnection: () => mocks.connection }))
vi.mock('./hooks', () => ({
  useOptimiserPortfolio: mocks.usePortfolio,
  useWalletKind: mocks.useWalletKind,
}))

function row(key: string, held: bigint, staked: bigint): PortfolioRow {
  return {
    key,
    symbol: key,
    blockNumber: 123n,
    status: 'success',
    meta: { symbol: key, name: key, decimals: 6 },
    ...normaliseStake(held, staked, 6),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.connection.isConnected = true
  mocks.portfolio.isPending = false
  mocks.portfolio.isError = false
  mocks.portfolio.data = []
  mocks.usePortfolio.mockReturnValue(mocks.portfolio)
  mocks.useWalletKind.mockReturnValue({ kind: undefined })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-13T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('optimiser RP caveat', () => {
  it.each(['eoa', 'contract', undefined] as const)(
    'renders exact context for known kind %s or banner only for undefined',
    (kind) => {
      mocks.useWalletKind.mockReturnValue({ kind })
      const { asFragment } = render(<OptimiserRpCaveat />)
      expect(asFragment()).toMatchSnapshot()
      const copy = NAMES.optimiserCopy.rpCaveat
      expect(screen.queryByText(copy.eoa) !== null).toBe(kind === 'eoa')
      expect(screen.queryByText(copy.contract) !== null).toBe(
        kind === 'contract',
      )
      expect(screen.getByText(copy.sociosWalletLine)).toBeInTheDocument()
      expect(mocks.useWalletKind).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it.each([
    { kind: undefined, isPending: true, isError: false },
    { kind: undefined, isPending: false, isError: true },
  ])(
    'shows only the banner when the code read is $isPending/$isError',
    (state) => {
      mocks.useWalletKind.mockReturnValue(state)
      const { asFragment } = render(<OptimiserRpCaveat />)
      expect(asFragment()).toMatchSnapshot()
      expect(
        screen.queryByText(NAMES.optimiserCopy.rpCaveat.eoa),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText(NAMES.optimiserCopy.rpCaveat.contract),
      ).not.toBeInTheDocument()
    },
  )

  it('hides cached account context if the code read later fails', () => {
    mocks.useWalletKind.mockReturnValue({
      kind: 'eoa',
      isPending: false,
      isError: false,
    })
    const { rerender } = render(<OptimiserRpCaveat />)
    expect(
      screen.getByText(NAMES.optimiserCopy.rpCaveat.eoa),
    ).toBeInTheDocument()
    mocks.useWalletKind.mockReturnValue({
      kind: 'eoa',
      isPending: false,
      isError: true,
    })
    rerender(<OptimiserRpCaveat />)
    expect(
      screen.queryByText(NAMES.optimiserCopy.rpCaveat.eoa),
    ).not.toBeInTheDocument()
    expect(screen.getByText(NAMES.optimiserCopy.caveats[1])).toBeInTheDocument()
  })

  it.each([true, false])(
    'keeps the banner on the optimiser page when connected=%s',
    (isConnected) => {
      mocks.connection.isConnected = isConnected
      const { asFragment } = render(
        <OptimiserLayout>
          <OptimiserPage />
        </OptimiserLayout>,
      )
      expect(asFragment()).toMatchSnapshot()
      for (const caveat of NAMES.optimiserCopy.caveats) {
        expect(screen.getAllByText(caveat)).toHaveLength(1)
      }
      expect(
        screen.getByText(NAMES.optimiserCopy.rpCaveat.sociosWalletLine),
      ).toBeInTheDocument()
    },
  )

  it('keeps one banner around nested optimiser content', () => {
    const { rerender } = render(
      <OptimiserLayout>
        <OptimiserPage />
      </OptimiserLayout>,
    )
    const banner = screen.getByText(
      NAMES.optimiserCopy.caveats[1],
    ).parentElement
    rerender(
      <OptimiserLayout>
        <div />
      </OptimiserLayout>,
    )
    expect(screen.getByText(NAMES.optimiserCopy.caveats[1]).parentElement).toBe(
      banner,
    )
    expect(screen.getAllByText(NAMES.optimiserCopy.caveats[1])).toHaveLength(1)
  })

  it('links to the exact brief sources in new tabs', () => {
    render(<OptimiserRpCaveat />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://connect.socios.com/interact-with-chiliz-chain/working-with-staking',
      'https://helpcenter.socios.com/en/articles/472518-how-do-i-earn-reward-points',
      'https://helpcenter.socios.com/en/articles/472529-do-i-need-fan-tokens-to-vote',
    ])
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})

describe('optimiser RP routes', () => {
  it('renders the source-confirmed Socios-app staking route with a safe source link and how-to', () => {
    render(<OptimiserEarnRoutes />)
    expect(
      OPTIMISER_EARN_ROUTES.filter((route) => route.status === 'confirmed').map(
        (route) => route.id,
      ),
    ).toEqual(['staking'])
    for (const route of OPTIMISER_EARN_ROUTES) {
      const item = screen
        .getByRole('heading', { name: route.name })
        .closest('li')!
      const link = within(item).getByRole('link', { name: route.source.label })
      expect(link).toHaveAttribute('href', route.source.href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      if (route.status === 'confirmed') {
        expect(within(item).getByText('Source-confirmed')).toBeInTheDocument()
        expect(within(item).getByText(route.howTo)).toBeInTheDocument()
        expect(link).toHaveAttribute(
          'href',
          'https://connect.socios.com/interact-with-chiliz-chain/working-with-staking',
        )
        expect(item).toHaveTextContent('Socios.com app (Socios Wallet)')
      }
    }
  })

  it.each(['Fan Zone tasks', 'Polls', 'Quizzes', 'Check-ins'])(
    'marks %s Unconfirmed with research evidence but no earning instructions',
    (name) => {
      render(<OptimiserEarnRoutes />)
      const item = screen.getByRole('heading', { name }).closest('li')!
      expect(within(item).getByText('Unconfirmed')).toBeInTheDocument()
      expect(
        within(item).queryByText('Source-confirmed'),
      ).not.toBeInTheDocument()
      expect(item.querySelector('p')).toBeNull()
      expect(within(item).getByRole('link')).toHaveAttribute(
        'href',
        expect.stringContaining('/docs/research/optimiser-data-access.md'),
      )
    },
  )

  it('contains no RP numbers, financial comparisons, guessed routes or write actions and makes no reads', () => {
    const { container } = render(<OptimiserEarnRoutes />)
    expect(container.textContent).not.toMatch(
      /\d+\s*(RP|Reward Points)|(RP|Reward Points)\s*[:=]?\s*\d+|[£€$]|APY|cheapest|cost.per.point|Token Hunt|CHZ|games/i,
    )
    expect(container.textContent).not.toMatch(/you (will|can) (earn|receive)/i)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mocks.usePortfolio).not.toHaveBeenCalled()
    expect(mocks.useWalletKind).not.toHaveBeenCalled()
    expect(mocks.portfolio.refetch).not.toHaveBeenCalled()
  })

  it.each(['disconnected', 'loading', 'error', 'empty'] as const)(
    'keeps all routes visible when portfolio is %s',
    (state) => {
      mocks.connection.isConnected = state !== 'disconnected'
      mocks.portfolio.isPending = state === 'loading'
      mocks.portfolio.isError = state === 'error'
      render(
        <OptimiserLayout>
          <OptimiserPage />
        </OptimiserLayout>,
      )
      const section = screen.getByRole('region', {
        name: NAMES.optimiserCopy.earnRoutes.heading,
      })
      expect(within(section).getAllByRole('listitem')).toHaveLength(5)
      expect(within(section).getAllByText('Unconfirmed')).toHaveLength(4)
      for (const caveat of NAMES.optimiserCopy.caveats) {
        expect(screen.getAllByText(caveat)).toHaveLength(1)
      }
    },
  )
})

describe('optimiser checklist', () => {
  it('changes to Ready to claim at the release boundary without RPC or write actions', () => {
    const releaseAt = BigInt(pendingFixture.samples[0].claimableAt)
    vi.setSystemTime(new Date(Number(releaseAt) * 1000 - 1000))
    mocks.portfolio.data = [
      {
        ...row('AFC', 0n, 0n),
        ...normaliseStake(0n, 0n, 18, 600n * 10n ** 18n),
        releaseAt,
        pendingOperationCount: 1,
      },
    ]
    render(<OptimiserPage />)
    expect(screen.getByText(/Cooling down: 600 AFC/)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText(/Ready to claim: 600 AFC/)).toBeInTheDocument()
    expect(screen.queryByText(/Cooling down:/)).not.toBeInTheDocument()
    expect(mocks.portfolio.refetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders an already-passed release as ready, retaining the UK release date and count', () => {
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
    mocks.portfolio.data = [
      {
        ...row('AFC', 0n, 0n),
        ...normaliseStake(0n, 0n, 18, 600n * 10n ** 18n),
        releaseAt: BigInt(pendingFixture.samples[0].claimableAt),
        pendingOperationCount: 2,
      },
    ]
    render(<OptimiserPage />)
    expect(screen.getByText(/Ready to claim: 600 AFC/)).toHaveTextContent(
      'available from 19 Oct 2026, 14:52:12 (UK time) · 2 pending unstakes; earliest release shown',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    [pendingFixture.samples[0].claimableAt, '19 Oct 2026, 14:52:12', '600'],
    [pendingFixture.samples[1].claimableAt, '18 Oct 2026, 06:05:17', '300'],
    // Synthetic winter release verifies GMT rather than a fixed BST offset.
    ['1795003200', '18 Nov 2026, 12:00:00', '600'],
  ])(
    'shows pending %s in Europe/London without adding it to balances',
    (releaseAt, expectedDate, amount) => {
      mocks.portfolio.data = [
        {
          ...row('AFC', 0n, 0n),
          ...normaliseStake(
            0n,
            0n,
            pendingFixture.decimals,
            BigInt(amount) * 10n ** BigInt(pendingFixture.decimals),
          ),
          releaseAt: BigInt(releaseAt),
          unstakePeriodSeconds: 604800n,
          pendingOperationCount: 1,
        },
      ]
      render(<OptimiserPage />)
      const chip = screen.getByText(
        `Cooling down: ${amount} AFC · available from ${expectedDate} (UK time)`,
      )
      expect(chip).toHaveClass(
        'bg-sr-secondary',
        'border-sr-secondary',
        'text-sr-text',
      )
      expect(chip).not.toHaveClass('text-sr-secondary')
      expect(
        screen.getByText(/Contract-wide default cooldown \(seconds\): 604800/),
      ).toHaveTextContent('Per-token override unknown')
      expect(
        within(screen.getAllByRole('row')[1])
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual(['0', '0', '0', '0', '—'])
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    },
  )

  it('shows unavailable release, multiple-operation count and no chip for zero pending', () => {
    const pending = {
      ...row('PENDING', 0n, 0n),
      ...normaliseStake(0n, 0n, 6, 1000000n),
      releaseAt: null,
      unstakePeriodSeconds: null,
      pendingOperationCount: 0,
    }
    mocks.portfolio.data = [
      row('ZERO', 1n, 0n),
      pending,
      {
        ...pending,
        key: 'MULTIPLE',
        symbol: 'MULTIPLE',
        releaseAt: 1792417932n,
        pendingOperationCount: 2,
      },
    ]
    render(<OptimiserPage />)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).not.toHaveTextContent('Cooling down')
    expect(rows[2]).toHaveTextContent(
      'Cooling down: 1 PENDING · Release time unavailable',
    )
    expect(rows[2]).not.toHaveTextContent('available from')
    expect(rows[3]).toHaveTextContent(
      '2 pending unstakes; earliest release shown',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('uses the approved name, Mainnet badge and exact approved caveats', () => {
    render(
      <OptimiserLayout>
        <OptimiserPage />
      </OptimiserLayout>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      NAMES.optimiser,
    )
    expect(screen.getByText('Reading Chiliz Mainnet data')).toBeInTheDocument()
    for (const caveat of [
      'ScoutReport is not affiliated with Socios. Rewards Optimizer shows available on-chain data; it cannot verify your Socios Reward Points or forecast RP yields.',
      'Staking from an external wallet does not earn Socios Reward Points. We cannot reliably verify whether this address is a Socios Wallet or qualifies for RP.',
      "To vote, you must own and stake at least one Fan Token of that team. Some polls require more or have additional conditions. Check the poll's requirements in Socios; an on-chain balance does not guarantee eligibility.",
      'Poll coverage may be incomplete. Times and balances reflect the stated capture block and may change. Pending unstake is not a liquid wallet balance.',
    ]) {
      expect(screen.getByText(caveat)).toBeInTheDocument()
    }
  })

  it('formats six-decimal rows, flags only liquid-only holdings and displays failed rows', () => {
    mocks.portfolio.data = [
      row('LIQUID', 1234567n, 0n),
      row('STAKED', 0n, 2000000n),
      row('MIXED', 1000000n, 3000000n),
      { key: 'FAILED', symbol: 'FAILED', status: 'failure', blockNumber: 123n },
    ]
    render(<OptimiserPage />)
    const table = screen.getByRole('table')
    for (const label of [
      'Token',
      'Held',
      'Staked',
      'Unstaked',
      'Scout Rating',
      'Action hint',
    ]) {
      expect(
        within(table).getByRole('columnheader', { name: label }),
      ).toBeInTheDocument()
    }
    const rows = within(table).getAllByRole('row')
    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      '1.234567',
      '0',
      '1.234567',
      '1.234567',
      'Not staked: stake in the Socios.com app to be eligible for RP and votes',
    ])
    expect(rows[1]).toHaveClass('bg-sr-surface')
    expect(
      within(rows[2])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['0', '2', '0', '2', '—'])
    expect(rows[2]).not.toHaveClass('bg-sr-surface')
    expect(
      within(rows[3])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['1', '3', '1', '4', '—'])
    expect(screen.getAllByText(NAMES.optimiserCopy.notStaked)).toHaveLength(1)
    expect(within(rows[4]).getAllByText('Unavailable')).toHaveLength(5)
    expect(rows[4]).not.toHaveTextContent('0')
    expect(screen.getByText('Capture block: 123')).toBeInTheDocument()
  })

  it('shows a connect prompt without exposing cached rows when disconnected', () => {
    mocks.connection.isConnected = false
    mocks.portfolio.data = [row('CACHED', 1000000n, 0n)]
    render(<OptimiserPage />)
    expect(mocks.usePortfolio).toHaveBeenCalledWith(undefined)
    expect(screen.getByText(NAMES.optimiserCopy.connect)).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('distinguishes loading, RPC failure and empty data and offers a retry', () => {
    mocks.portfolio.isPending = true
    const { rerender } = render(<OptimiserPage />)
    expect(
      screen.getByRole('status', { name: NAMES.wallet.loading }),
    ).toHaveTextContent(NAMES.wallet.loading)
    mocks.portfolio.isPending = false
    mocks.portfolio.isError = true
    rerender(<OptimiserPage />)
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent?.includes(NAMES.wallet.rpcError)),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: NAMES.wallet.retry }))
    expect(mocks.portfolio.refetch).toHaveBeenCalledOnce()
    mocks.portfolio.isError = false
    rerender(<OptimiserPage />)
    expect(screen.getByText(NAMES.wallet.empty)).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
