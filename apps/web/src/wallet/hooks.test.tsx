import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import { FAN_TOKENS, getTokenAddress, normaliseStake } from '@scoutreport/chain'
import { readHoldings, useHoldings, useWalletKind } from './hooks'

const { connection, batch, meta, getCode, getPublicClient } = vi.hoisted(
  () => ({
    connection: {
      address: '0x0000000000000000000000000000000000000001',
      isConnected: true,
    },
    batch: vi.fn(),
    meta: vi.fn(),
    getCode: vi.fn(),
    getPublicClient: vi.fn(),
  }),
)
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
    readTokenMeta: meta,
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
  connection.isConnected = true
  connection.address = '0x0000000000000000000000000000000000000001'
  getPublicClient.mockReturnValue({ getCode })
  meta.mockResolvedValue({
    symbol: 'TEST',
    name: 'Synthetic test token',
    decimals: 6,
  })
  batch.mockImplementation(async (_client, _user, addresses: string[]) =>
    addresses.map(() => normaliseStake(0n, 0n, 6)),
  )
})

afterEach(cleanup)

describe('holdings reads', () => {
  it('batches every Mainnet token, filters zeros and uses helper formatting', async () => {
    const addresses = FAN_TOKENS.flatMap((token) => {
      if (!token.addresses[88888]) return []
      const address = getTokenAddress(token, 88888)
      return address ? [address] : []
    })
    batch.mockResolvedValue(
      addresses.map((_, index) =>
        normaliseStake(
          index === 0 ? 1234567n : 0n,
          index === 1 ? 2000000n : 0n,
          6,
        ),
      ),
    )
    const result = await readHoldings(connection.address as `0x${string}`)
    expect(getPublicClient).toHaveBeenCalledWith(88888)
    expect(batch).toHaveBeenCalledOnce()
    expect(batch.mock.calls[0][2]).toEqual(addresses)
    expect(result).toHaveLength(2)
    expect(result[0].formatted.held).toBe('1.234567')
    expect(result[1].formatted.totalScoutRating).toBe('2')
    expect(meta).toHaveBeenCalledTimes(addresses.length)
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
    let resolve!: (value: ReturnType<typeof normaliseStake>[]) => void
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
      resolve([normaliseStake(100n, 0n, 0)])
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
