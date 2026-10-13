import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChainSwitchRejectedError, normaliseStake } from '@scoutreport/chain'
import {
  HoldingsStrip,
  NetworkBadge,
  WalletButton,
  WrongNetworkBanner,
} from './components'
import { NAMES } from '../copy/names'

const mocks = vi.hoisted(() => ({
  connection: {
    isConnected: false,
    address: '0x123400000000000000000000000000000000abcd',
    chainId: 88882,
  },
  modal: { available: true, openConnect: vi.fn() },
  disconnectAsync: vi.fn(),
  ensureChain: vi.fn(),
  client: { request: vi.fn() },
  connectorClient: vi.fn(),
  holdings: {
    isPending: false,
    isError: false,
    data: [] as unknown[],
    refetch: vi.fn(),
  },
}))
vi.mock('wagmi', () => ({
  useConnection: () => mocks.connection,
  useDisconnect: () => ({
    disconnectAsync: mocks.disconnectAsync,
    isPending: false,
  }),
  useConnectorClient: mocks.connectorClient,
}))
vi.mock('./providers', () => ({ useWalletModal: () => mocks.modal }))
vi.mock('./hooks', () => ({ useHoldings: () => mocks.holdings }))
vi.mock('@scoutreport/chain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@scoutreport/chain')>()),
  ensureChain: mocks.ensureChain,
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
  mocks.connection.isConnected = false
  mocks.connection.chainId = 88882
  mocks.modal.available = true
  mocks.holdings.isPending = false
  mocks.holdings.isError = false
  mocks.holdings.data = []
  mocks.connectorClient.mockImplementation((options: { chainId?: number }) => ({
    data:
      options.chainId === mocks.connection.chainId ? mocks.client : undefined,
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('wallet controls', () => {
  it('opens the connect modal and disables connection when configuration is missing', async () => {
    const { rerender } = render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: NAMES.connectWallet }))
    await waitFor(() => expect(mocks.modal.openConnect).toHaveBeenCalledOnce())
    mocks.modal.available = false
    rerender(<WalletButton />)
    expect(
      screen.getByRole('button', { name: NAMES.connectWallet }),
    ).toBeDisabled()
    expect(screen.getByText(NAMES.wallet.unavailable)).toBeInTheDocument()
  })

  it('shows the truncated address and disconnects', async () => {
    mocks.connection.isConnected = true
    render(<WalletButton />)
    expect(screen.getByText('0x1234…abcd')).toHaveAttribute(
      'title',
      mocks.connection.address,
    )
    fireEvent.click(
      screen.getByRole('button', { name: NAMES.wallet.disconnect }),
    )
    await waitFor(() => expect(mocks.disconnectAsync).toHaveBeenCalledOnce())
  })

  it('handles rejection of the connect modal', async () => {
    mocks.modal.openConnect.mockRejectedValue(new Error('Rejected'))
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: NAMES.connectWallet }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      NAMES.wallet.connectionError,
    )
  })

  it('uses warning and accent network badges', () => {
    mocks.connection.isConnected = true
    const { rerender } = render(<NetworkBadge />)
    expect(screen.getByText('Spicy')).toHaveClass('bg-sr-warning', 'text-sr-bg')
    mocks.connection.chainId = 88888
    rerender(<NetworkBadge />)
    expect(screen.getByText('Mainnet')).toHaveClass(
      'bg-sr-accent',
      'text-sr-bg',
    )
  })

  it.each([88888, 1])(
    'offers ensureChain from network %i and handles a rejected switch',
    async (chainId) => {
      mocks.connection.isConnected = true
      mocks.connection.chainId = chainId
      mocks.ensureChain.mockRejectedValue(
        new ChainSwitchRejectedError(new Error('Rejected')),
      )
      render(<WrongNetworkBanner />)
      expect(mocks.connectorClient).toHaveBeenCalledWith({ chainId })
      expect(
        screen.getByRole('button', { name: NAMES.wallet.switchSpicy }),
      ).toBeEnabled()
      fireEvent.click(
        screen.getByRole('button', { name: NAMES.wallet.switchSpicy }),
      )
      await waitFor(() =>
        expect(mocks.ensureChain).toHaveBeenCalledWith(
          expect.anything(),
          88882,
        ),
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        NAMES.wallet.switchRejected,
      )
    },
  )

  it('offers Mainnet when APP_CHAIN is Mainnet and hides after switching', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88888')
    mocks.connection.isConnected = true
    const { rerender } = render(<WrongNetworkBanner />)
    fireEvent.click(
      screen.getByRole('button', { name: NAMES.wallet.switchMainnet }),
    )
    await waitFor(() =>
      expect(mocks.ensureChain).toHaveBeenCalledWith(expect.anything(), 88888),
    )
    mocks.connection.chainId = 88888
    rerender(<WrongNetworkBanner />)
    expect(
      screen.queryByText(NAMES.wallet.wrongNetwork),
    ).not.toBeInTheDocument()
  })
})

describe('holdings strip', () => {
  it('renders no holdings when disconnected', () => {
    render(<HoldingsStrip />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('shows skeleton, empty and retryable RPC error states', () => {
    mocks.connection.isConnected = true
    mocks.holdings.isPending = true
    const { rerender } = render(<HoldingsStrip />)
    expect(screen.getByRole('status')).toHaveAccessibleName(
      NAMES.wallet.loading,
    )
    mocks.holdings.isPending = false
    rerender(<HoldingsStrip />)
    expect(screen.getByText(NAMES.wallet.empty)).toBeInTheDocument()
    mocks.holdings.isError = true
    rerender(<HoldingsStrip />)
    expect(screen.getByRole('alert')).toHaveTextContent(NAMES.wallet.rpcError)
    fireEvent.click(screen.getByRole('button', { name: NAMES.wallet.retry }))
    expect(mocks.holdings.refetch).toHaveBeenCalledOnce()
  })

  it('renders held, staked and held + staked without labelling stake as RP earnings', () => {
    mocks.connection.isConnected = true
    mocks.holdings.data = [
      { key: 'test', symbol: 'TEST', ...normaliseStake(1234567n, 2000000n, 6) },
    ]
    const { rerender } = render(<HoldingsStrip />)
    expect(screen.getByText('1.234567')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3.234567')).toBeInTheDocument()
    expect(screen.getByText(NAMES.scoreLabel)).toBeInTheDocument()
    expect(screen.getByText(NAMES.wallet.stakingCaveat)).toBeInTheDocument()
    mocks.connection.isConnected = false
    rerender(<HoldingsStrip />)
    expect(screen.queryByText('TEST')).not.toBeInTheDocument()
  })
})
