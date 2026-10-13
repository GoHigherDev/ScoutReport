import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chiliz, FAN_TOKENS, getTokenAddress } from '@scoutreport/chain'
import type { PublicClient, Address } from 'viem'
import { RpSnapshotReader } from './rp-snapshot'
import type { RpCalibration } from './rp-model'

const boundary = Date.parse('2026-10-13T00:00:00Z')
const token = getTokenAddress(FAN_TOKENS[0], chiliz.id)!
const wallet: Address = '0x0000000000000000000000000000000000000001'
const calibration = { blockNumber: 1n } as RpCalibration
let changedHash = false
const getBlock = vi.fn(
  async ({ blockNumber = 10n }: { blockNumber?: bigint }) => ({
    number: blockNumber,
    // Block 5 is exactly midnight; the snapshot MUST be block 4, not 5.
    timestamp: BigInt(boundary / 1000) + (blockNumber - 5n) * 10n,
    hash: `${changedHash ? 'new' : 'old'}-${blockNumber}`,
  }),
)
const getLogs = vi.fn(async () => [])
const multicall = vi.fn(
  async ({ contracts }: { contracts: { functionName: string }[] }) =>
    contracts.length === 2
      ? [100_000_000n, 6]
      : [{ totalStake: 2_000_000n, totalPendingUnstake: 999_000_000n }],
)
const client = {
  chain: chiliz,
  getBlock,
  getLogs,
  multicall,
} as unknown as PublicClient
beforeEach(() => {
  vi.clearAllMocks()
  changedHash = false
  getLogs.mockResolvedValue([])
})

describe('cached historical RP snapshots', () => {
  it('pins wallet, pool and on-chain decimals strictly before midnight, excluding pending', async () => {
    const reader = new RpSnapshotReader(client)
    const snapshot = await reader.read(
      wallet,
      token,
      calibration,
      boundary + 3600_000,
    )
    expect(snapshot).toMatchObject({
      blockNumber: 4n,
      stake: 2_000_000n,
      poolStake: 100_000_000n,
      decimals: 6,
      upgraded: false,
      readAt: boundary + 3600_000,
    })
    expect(
      multicall.mock.calls.every(
        ([args]) => (args as { blockNumber?: bigint }).blockNumber === 4n,
      ),
    ).toBe(true)
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 2n, toBlock: 10n }),
    )
  })
  it('caches midpoint lookups and per-token/day/hash pool and wallet snapshots', async () => {
    const reader = new RpSnapshotReader(client)
    await reader.read(wallet, token, calibration, boundary + 3600_000)
    getBlock.mockClear()
    const verified = await reader.read(
      wallet,
      token,
      calibration,
      boundary + 7200_000,
    )
    expect(verified.readAt).toBe(boundary + 7200_000)
    expect(multicall).toHaveBeenCalledTimes(2)
    expect(getLogs).toHaveBeenCalledTimes(1)
    expect(getBlock.mock.calls.map(([args]) => args.blockNumber)).toEqual([
      undefined,
      4n,
      5n,
      4n,
      10n,
    ])
    await reader.read(
      '0x0000000000000000000000000000000000000002',
      token,
      calibration,
      boundary + 7200_000,
    )
    expect(multicall).toHaveBeenCalledTimes(3)
  })
  it('does not reuse snapshots across block hashes', async () => {
    const reader = new RpSnapshotReader(client)
    await reader.read(wallet, token, calibration, boundary + 3600_000)
    changedHash = true
    const snapshot = await reader.read(
      wallet,
      token,
      calibration,
      boundary + 7200_000,
    )
    expect(snapshot.blockHash).toBe('new-4')
    expect(multicall).toHaveBeenCalledTimes(4)
    expect(getLogs).toHaveBeenCalledTimes(2)
  })
  it('hides upgrades since calibration and performs no snapshot reads', async () => {
    getLogs.mockResolvedValueOnce([{ blockNumber: 8n }] as never[])
    const snapshot = await new RpSnapshotReader(client).read(
      wallet,
      token,
      calibration,
      boundary + 3600_000,
    )
    expect(snapshot.upgraded).toBe(true)
    expect(multicall).not.toHaveBeenCalled()
  })
  it('propagates failed reads rather than reporting zero and does not cache failures', async () => {
    multicall.mockRejectedValueOnce(new Error('RPC failed'))
    const reader = new RpSnapshotReader(client)
    await expect(
      reader.read(wallet, token, calibration, boundary + 3600_000),
    ).rejects.toThrow('RPC failed')
    expect(
      (await reader.read(wallet, token, calibration, boundary + 3600_000))
        .stake,
    ).toBe(2_000_000n)
  })
})
