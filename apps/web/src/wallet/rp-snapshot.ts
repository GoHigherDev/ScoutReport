import {
  STAKING_ADDRESS,
  chiliz,
  getStakingLogClient,
  type StakeDataResponse,
} from '@scoutreport/chain'
import {
  erc20Abi,
  type Abi,
  type AbiEvent,
  type Address,
  type PublicClient,
} from 'viem'
import stakingJson from '../../../../packages/chain/abis/staking.json'
import type { RpCalibration, RpSnapshot } from './rp-model'

const stakingAbi = stakingJson as Abi
const upgradedEvent = stakingAbi.find(
  (item) => item.type === 'event' && item.name === 'Upgraded',
) as AbiEvent

function cached<K, V>(
  cache: Map<K, Promise<V>>,
  key: K,
  read: () => Promise<V>,
) {
  const existing = cache.get(key)
  if (existing) return existing
  // Bound browser memory, including wallet-specific historical reads.
  if (cache.size >= 256) cache.delete(cache.keys().next().value!)
  const promise = read().catch((error: unknown) => {
    cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  return promise
}

export class RpSnapshotReader {
  private days = new Map<number, Promise<bigint>>()
  private midpoints = new Map<string, Promise<bigint>>()
  private pools = new Map<
    string,
    Promise<{ poolStake: bigint; decimals: number }>
  >()
  private wallets = new Map<string, Promise<bigint>>()
  private upgrades = new Map<string, Promise<boolean>>()

  constructor(private client: PublicClient) {
    if (client.chain?.id !== chiliz.id)
      throw new Error('RP snapshots require Mainnet.')
  }

  private async beforeMidnight(
    boundary: number,
    head: bigint,
  ): Promise<bigint> {
    return cached(this.days, boundary, async () => {
      let low = 0n
      let high = head
      const target = BigInt(boundary / 1000)
      if (
        (await this.client.getBlock({ blockNumber: low })).timestamp >= target
      )
        throw new Error('No block precedes the boundary.')
      while (low < high) {
        const middle = (low + high + 1n) / 2n
        const timestamp = await cached(
          this.midpoints,
          `${boundary}:${middle}`,
          async () =>
            (await this.client.getBlock({ blockNumber: middle })).timestamp,
        )
        if (timestamp < target) low = middle
        else high = middle - 1n
      }
      return low
    })
  }

  async read(
    wallet: Address,
    token: Address,
    calibration: RpCalibration,
    now: number,
  ): Promise<RpSnapshot> {
    const boundary = Math.floor(now / 86400_000) * 86400_000
    const head = await this.client.getBlock({ blockTag: 'latest' })
    if (
      !head.hash ||
      head.timestamp * 1000n < BigInt(boundary) ||
      calibration.blockNumber > head.number
    )
      throw new Error('Snapshot head unavailable.')
    const blockNumber = await this.beforeMidnight(boundary, head.number)
    const [block, next] = await Promise.all([
      this.client.getBlock({ blockNumber }),
      this.client.getBlock({ blockNumber: blockNumber + 1n }),
    ])
    if (
      !block.hash ||
      block.timestamp * 1000n >= BigInt(boundary) ||
      next.timestamp * 1000n < BigInt(boundary)
    ) {
      this.days.delete(boundary)
      this.midpoints.clear()
      throw new Error('Midnight snapshot changed; hide until refreshed.')
    }
    const upgraded = await cached(
      this.upgrades,
      `${calibration.blockNumber}:${head.hash}`,
      async () => {
        for (
          let fromBlock = calibration.blockNumber + 1n;
          fromBlock <= head.number;
          fromBlock += 5000n
        ) {
          const toBlock =
            fromBlock + 4999n > head.number ? head.number : fromBlock + 4999n
          const logs = await this.client.getLogs({
            address: STAKING_ADDRESS,
            event: upgradedEvent,
            fromBlock,
            toBlock,
          })
          if (logs.length) return true
        }
        return false
      },
    )
    if (upgraded)
      return {
        stake: 0n,
        poolStake: 0n,
        decimals: 0,
        blockNumber,
        blockHash: block.hash,
        boundary,
        readAt: now,
        upgraded,
      }
    const key = `${token.toLowerCase()}:${boundary}:${block.hash}`
    const [pool, stake] = await Promise.all([
      cached(this.pools, key, async () => {
        const [poolStake, decimals] = await this.client.multicall({
          allowFailure: false,
          blockNumber,
          contracts: [
            {
              address: STAKING_ADDRESS,
              abi: stakingAbi,
              functionName: 'getTotalStake',
              args: [token],
            },
            { address: token, abi: erc20Abi, functionName: 'decimals' },
          ],
        })
        return { poolStake: poolStake as bigint, decimals: decimals as number }
      }),
      cached(this.wallets, `${key}:${wallet.toLowerCase()}`, async () => {
        const [data] = await this.client.multicall({
          allowFailure: false,
          blockNumber,
          contracts: [
            {
              address: STAKING_ADDRESS,
              abi: stakingAbi,
              functionName: 'getStakeDataLatest',
              args: [wallet, token, false],
            },
          ],
        })
        // totalStake, not pending, locked or claimable tuple fields.
        return (data as StakeDataResponse).totalStake
      }),
    ])
    const [verified, verifiedHead] = await Promise.all([
      this.client.getBlock({ blockNumber }),
      this.client.getBlock({ blockNumber: head.number }),
    ])
    if (verified.hash !== block.hash || verifiedHead.hash !== head.hash)
      throw new Error('Snapshot or upgrade-check head reorganised.')
    return {
      stake,
      ...pool,
      blockNumber,
      blockHash: block.hash,
      boundary,
      readAt: now,
      upgraded,
    }
  }
}

let reader: RpSnapshotReader | undefined
export function getRpSnapshotReader() {
  reader ??= new RpSnapshotReader(getStakingLogClient())
  return reader
}
