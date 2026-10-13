import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normaliseStake } from '@scoutreport/chain'
import OptimiserPage from '../app/optimiser/page'
import { NAMES } from '../copy/names'
import type { PortfolioRow } from './hooks'

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
}))
vi.mock('wagmi', () => ({ useConnection: () => mocks.connection }))
vi.mock('./hooks', () => ({
  useOptimiserPortfolio: mocks.usePortfolio,
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
})
afterEach(cleanup)

describe('optimiser checklist', () => {
  it('uses the approved name, Mainnet badge and exact approved caveats', () => {
    render(<OptimiserPage />)
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
