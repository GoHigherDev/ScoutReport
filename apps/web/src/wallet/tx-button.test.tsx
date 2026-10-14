import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { encodeErrorResult } from 'viem'
import { ConnectorChainMismatchError } from '@wagmi/core'
import { SCOUTREPORT_ABIS } from '@scoutreport/chain'
import { NAMES } from '../copy/names'
import { TransactionButton } from './tx-button'

const mocks = vi.hoisted(() => ({
  config: {},
  account: vi.fn(),
  wallet: vi.fn(),
  send: vi.fn(),
  rpc: {
    getBalance: vi.fn(),
    estimateGas: vi.fn(),
    estimateFeesPerGas: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  },
}))
vi.mock('wagmi', () => ({ useConfig: () => mocks.config }))
vi.mock('@wagmi/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@wagmi/core')>()),
  getAccount: mocks.account,
  getWalletClient: mocks.wallet,
}))
vi.mock('@scoutreport/chain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@scoutreport/chain')>()
  return {
    ...actual,
    getPublicClient: () => mocks.rpc,
    useTxGuard: (
      request: Parameters<typeof actual.useTxGuard>[0],
      options: Parameters<typeof actual.useTxGuard>[1],
    ) => actual.useTxGuard(request, { ...options, client: mocks.rpc }),
  }
})

const address = '0x0000000000000000000000000000000000000001'
const request = { to: address, data: '0x' } as const
const hash = `0x${'1'.repeat(64)}`
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
  mocks.account.mockReturnValue({ address, chainId: 88882 })
  mocks.rpc.getBalance.mockResolvedValue(100n)
  mocks.rpc.estimateGas.mockResolvedValue(10n)
  mocks.rpc.estimateFeesPerGas.mockResolvedValue({ maxFeePerGas: 2n })
  mocks.wallet.mockResolvedValue({ sendTransaction: mocks.send })
  mocks.send.mockResolvedValue(hash)
  mocks.rpc.waitForTransactionReceipt.mockResolvedValue({
    status: 'success',
    transactionHash: hash,
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it('guards a Spicy write and uses APP_CHAIN for its explorer and receipt', async () => {
  render(<TransactionButton request={request} />)
  expect(mocks.rpc.getBalance).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() =>
    expect(screen.getByRole('button')).toHaveTextContent(NAMES.gas.confirmed),
  )
  expect(mocks.wallet).toHaveBeenCalledWith(mocks.config, {
    chainId: 88882,
    account: address,
  })
  expect(mocks.send).toHaveBeenCalledWith({
    ...request,
    account: address,
    chain: expect.objectContaining({ id: 88882 }),
  })
  expect(mocks.rpc.waitForTransactionReceipt).toHaveBeenCalledWith({
    hash,
    onReplaced: expect.any(Function),
  })
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    `https://testnet.chiliscan.com/tx/${hash}`,
  )
})

it('blocks low balance and shows faucet guidance before wallet preparation', async () => {
  mocks.rpc.getBalance.mockResolvedValue(1n)
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.gas.insufficient_gas,
  )
  expect(
    screen.getByRole('link', { name: NAMES.gas.spicyFaucet }),
  ).toBeInTheDocument()
  expect(mocks.wallet).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
})

it('blocks a supplied priority fee that the current balance cannot cover', async () => {
  mocks.rpc.estimateFeesPerGas.mockResolvedValue({
    maxFeePerGas: 2n,
    maxPriorityFeePerGas: 1n,
  })
  render(
    <TransactionButton request={{ ...request, maxPriorityFeePerGas: 10n }} />,
  )
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.gas.insufficient_gas,
  )
  expect(mocks.send).not.toHaveBeenCalled()
})

it('blocks DATA_CHAIN wallets without RPC work', async () => {
  mocks.account.mockReturnValue({ address, chainId: 88888 })
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.gas.wrong_network,
  )
  expect(mocks.rpc.getBalance).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
})

it.each([
  { address, chainId: 1 },
  { address: '0x0000000000000000000000000000000000000002', chainId: 88882 },
])('blocks wallet changes during preparation: %j', async (changed) => {
  mocks.wallet.mockImplementation(async () => {
    mocks.account.mockReturnValue(changed)
    return { sendTransaction: mocks.send }
  })
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    changed.chainId !== 88882 ? NAMES.gas.wrong_network : NAMES.gas.unknown,
  )
  expect(mocks.send).not.toHaveBeenCalled()
})

it('decodes estimation reverts into approved copy', async () => {
  const data = encodeErrorResult({
    abi: SCOUTREPORT_ABIS[0],
    errorName: 'MatchLocked',
  })
  mocks.rpc.estimateGas.mockRejectedValue({ cause: { data } })
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.gas.errors.MatchLocked,
  )
  expect(mocks.send).not.toHaveBeenCalled()
})

it('shows wrong-network guidance when wallet preparation rejects a chain mismatch', async () => {
  mocks.wallet.mockRejectedValue(
    new ConnectorChainMismatchError({
      connectionChainId: 88882,
      connectorChainId: 1,
    }),
  )
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.gas.wrong_network,
  )
  expect(mocks.send).not.toHaveBeenCalled()
})

it('keeps other wallet preparation failures generic', async () => {
  mocks.wallet.mockRejectedValue(new Error('Private provider details'))
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(NAMES.gas.unknown)
  expect(mocks.send).not.toHaveBeenCalled()
})

it('has reviewed copy for every generated custom error', () => {
  for (const abi of SCOUTREPORT_ABIS) {
    for (const item of abi) {
      if (item.type === 'error') {
        expect(Object.hasOwn(NAMES.gas.errors, item.name)).toBe(true)
      }
    }
  }
})

it('does not confirm a cancelled replacement transaction', async () => {
  mocks.rpc.waitForTransactionReceipt.mockImplementation(
    async ({ onReplaced }) => {
      onReplaced({ reason: 'cancelled' })
      return { status: 'success', transactionHash: hash }
    },
  )
  render(<TransactionButton request={request} />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(NAMES.gas.unknown)
  expect(screen.getByRole('button')).toHaveTextContent(NAMES.gas.failed)
})
