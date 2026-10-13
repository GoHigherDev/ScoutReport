import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import { FAN_TOKENS, getTokenAddress, normaliseStake } from '@scoutreport/chain'
import {
  readHoldings,
  useHoldings,
  useOptimiserPortfolio,
  useWalletKind,
} from './hooks'

const {
  connection,
  batch,
  cooldowns,
  getBlockNumber,
  getCode,
  getPublicClient,
} = vi.hoisted(() => ({
  connection: {
    address: '0x0000000000000000000000000000000000000001',
    isConnected: true,
  },
  batch: vi.fn(),
  cooldowns: vi.fn(),
  getBlockNumber: vi.fn(),
  getCode: vi.fn(),
  getPublicClient: vi.fn(),
}))
vi.mock('wagmi', () => ({ useConnection: () => connection }))
vi.mock('@scoutreport/chain', async (importOriginal) => {
  const original = await importOriginal<typeof import('@scoutreport/chain')>()
  return {
    ...original,
    FAN_TOKENS: [
      ...original.FAN_TOKENS,
      { ...original.FAN_TOKENS[0], key: 'missing-mainnet', addresses: {} },
    ],
    getPublicClient,
    readStakeDataLatestBatch: batch,
    readPendingUnstakesBatch: cooldowns,
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
  vi.stubEnv('NEXT_PUBLIC_DATA_CHAIN_ID', '88888')
  connection.isConnected = true
  connection.address = '0x0000000000000000000000000000000000000001'
  getPublicClient.mockReturnValue({ getCode, getBlockNumber })
  getBlockNumber.mockResolvedValue(123n)
  batch.mockImplementation(async (_client, _user, addresses: string[]) =>
    addresses.map(() => successfulStake(0n, 0n)),
  )
  cooldowns.mockImplementation(
    async (_client, _user, tokens: { pendingAmount: bigint }[]) =>
      tokens.map(({ pendingAmount }) => ({
        pendingAmount,
        releaseAt: null,
        unstakePeriodSeconds: 604800n,
        pendingOperationCount: 0,
      })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

function successfulStake(held: bigint, staked: bigint) {
  return {
    ...normaliseStake(held, staked, 6),
    status: 'success' as const,
    meta: { symbol: 'TEST', name: 'Synthetic test token', decimals: 6 },
  }
}

describe('holdings reads', () => {
  it('retains pending-only rows and passes existing pending amounts to the cooldown helper', async () => {
    batch.mockImplementation(async (_client, _user, addresses: string[]) =>
      addresses.map((_, index) => ({
        ...successfulStake(0n, 0n),
        ...normaliseStake(0n, 0n, 6, index === 0 ? 600000000n : 0n),
      })),
    )
    const result = await readHoldings(connection.address as `0x${string}`)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      pendingAmount: 600000000n,
      held: 0n,
      unstaked: 0n,
      totalScoutRating: 0n,
      releaseAt: null,
    })
    expect(cooldowns.mock.calls[0][2]).toEqual([
      {
        token: getTokenAddress(FAN_TOKENS[0], 88888),
        pendingAmount: 600000000n,
      },
    ])
    expect(cooldowns.mock.calls[0][3]).toBe(123n)
  })

  it('batches every Mainnet token, filters zeros and uses helper formatting', async () => {
    const addresses = FAN_TOKENS.flatMap((token) => {
      if (!token.addresses[88888]) return []
      const address = getTokenAddress(token, 88888)
      return address ? [address] : []
    })
    batch.mockResolvedValue(
      addresses.map((_, index) =>
        successfulStake(
          index === 0 ? 1234567n : 0n,
          index === 1 ? 2000000n : 0n,
        ),
      ),
    )
    const result = await readHoldings(connection.address as `0x${string}`)
    expect(getPublicClient).toHaveBeenCalledWith(88888)
    expect(batch).toHaveBeenCalledOnce()
    expect(batch.mock.calls[0][2]).toEqual(addresses)
    expect(batch.mock.calls[0][3]).toEqual({
      allowFailure: true,
      blockNumber: 123n,
    })
    expect(getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 })
    expect(result).toHaveLength(2)
    if (result[0].status !== 'success' || result[1].status !== 'success')
      throw new Error('Expected available rows')
    expect(result[0].formatted.held).toBe('1.234567')
    expect(result[1].formatted.totalScoutRating).toBe('2')
    expect(result[0].unstaked).toBe(result[0].held)
    expect(result[1].held).toBe(0n)
    expect(result[0].blockNumber).toBe(123n)
  })

  it('retains failed tokens as unavailable without losing successful rows or fabricating zeros', async () => {
    batch.mockImplementation(async (_client, _user, addresses: string[]) =>
      addresses.map((_, index) =>
        index === 0
          ? { status: 'failure' }
          : successfulStake(index === 1 ? 1000000n : 0n, 0n),
      ),
    )
    const result = await readHoldings(connection.address as `0x${string}`)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      key: FAN_TOKENS[0].key,
      symbol: FAN_TOKENS[0].symbol,
      status: 'failure',
      blockNumber: 123n,
    })
    expect(result[1].status).toBe('success')
  })

  it('shares the holdings query with the optimiser and disables reads without an address', async () => {
    const { result, rerender } = renderHook(
      ({ address }: { address: `0x${string}` | undefined }) => ({
        optimiser: useOptimiserPortfolio(address),
        holdings: useHoldings(),
      }),
      {
        wrapper,
        initialProps: {
          address: connection.address as `0x${string}` | undefined,
        },
      },
    )
    await waitFor(() => expect(result.current.optimiser.data).toEqual([]))
    expect(result.current.holdings.data).toEqual([])
    expect(batch).toHaveBeenCalledOnce()
    connection.isConnected = false
    rerender({ address: undefined })
    expect(result.current.optimiser.data).toBeUndefined()
    expect(result.current.holdings.data).toBeUndefined()
    expect(batch).toHaveBeenCalledOnce()
  })

  it('does not read when disconnected and clears results on disconnect', async () => {
    connection.isConnected = false
    const { result, rerender } = renderHook(useHoldings, { wrapper })
    expect(batch).not.toHaveBeenCalled()
    connection.isConnected = true
    rerender()
    await waitFor(() => expect(result.current.data).toEqual([]))
    connection.isConnected = false
    rerender()
    expect(result.current.data).toBeUndefined()
  })

  it('does not reuse another account’s holdings', async () => {
    let resolve!: (value: ReturnType<typeof successfulStake>[]) => void
    batch.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const { result, rerender } = renderHook(useHoldings, { wrapper })
    await waitFor(() => expect(batch).toHaveBeenCalledOnce())
    connection.address = '0x0000000000000000000000000000000000000002'
    rerender()
    await waitFor(() => expect(result.current.data).toEqual([]))
    await act(async () => {
      resolve([successfulStake(100n, 0n)])
    })
    expect(result.current.data).toEqual([])
  })

  it('exposes RPC errors without reporting an empty portfolio', async () => {
    batch.mockRejectedValue(new Error('RPC unavailable'))
    const { result } = renderHook(useHoldings, { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('wallet kind on DATA_CHAIN', () => {
  it('reuses cached account code on rerender, remount, focus and reconnect, reading each new address once', async () => {
    const client = new QueryClient()
    const cachedWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    getCode.mockResolvedValueOnce('0x').mockResolvedValueOnce('0x6000')
    try {
      const first = renderHook(useWalletKind, { wrapper: cachedWrapper })
      await waitFor(() => expect(first.result.current.kind).toBe('eoa'))
      expect(getCode).toHaveBeenCalledTimes(1)
      expect(
        client.getQueryCache().find({
          queryKey: ['wallet-kind', 88888, connection.address],
        })?.gcTime,
      ).toBe(30 * 60 * 1000)
      first.rerender()
      first.unmount()

      const second = renderHook(useWalletKind, { wrapper: cachedWrapper })
      expect(second.result.current.kind).toBe('eoa')
      await act(async () => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
        onlineManager.setOnline(false)
        onlineManager.setOnline(true)
      })
      expect(getCode).toHaveBeenCalledTimes(1)

      connection.address = '0x0000000000000000000000000000000000000002'
      second.rerender()
      expect(second.result.current.kind).toBeUndefined()
      await waitFor(() => expect(second.result.current.kind).toBe('contract'))
      second.rerender()
      expect(getCode.mock.calls).toEqual([
        [{ address: '0x0000000000000000000000000000000000000001' }],
        [{ address: '0x0000000000000000000000000000000000000002' }],
      ])

      connection.address = '0x0000000000000000000000000000000000000001'
      second.rerender()
      expect(second.result.current.kind).toBe('eoa')
      expect(getCode).toHaveBeenCalledTimes(2)
      second.unmount()
    } finally {
      client.clear()
      focusManager.setFocused(undefined)
      onlineManager.setOnline(true)
    }
  })

  it.each([
    [undefined, 'eoa'],
    ['0x', 'eoa'],
    ['0x6000', 'contract'],
  ] as const)('classifies code %s as %s', async (code, kind) => {
    getCode.mockResolvedValue(code)
    const { result, rerender } = renderHook(useWalletKind, { wrapper })
    await waitFor(() => expect(result.current.kind).toBe(kind))
    expect(result.current.isContractAccount).toBe(kind === 'contract')
    expect(getPublicClient).toHaveBeenCalledWith(88888)
    expect(getCode).toHaveBeenCalledWith({ address: connection.address })
    connection.isConnected = false
    rerender()
    expect(result.current.kind).toBeUndefined()
    expect(result.current.isContractAccount).toBe(false)
  })

  it('leaves kind unknown after an RPC error', async () => {
    getCode.mockRejectedValue(new Error('RPC unavailable'))
    const { result } = renderHook(useWalletKind, { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.kind).toBeUndefined()
    expect(result.current.isContractAccount).toBe(false)
  })
})
