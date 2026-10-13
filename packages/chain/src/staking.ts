/**
 * External-wallet staking can contribute to staking and Scout Rating, but does
 * NOT earn Socios Reward Points. Only Socios Wallet staking earns RP.
 */
import {
  decodeEventLog,
  encodeEventTopics,
  erc20Abi,
  isAddress,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import stakingJson from '../abis/staking.json' with { type: 'json' }
import { chiliz } from './chains.ts'
import { getStakingLogClient } from './clients.ts'
import { formatTokenAmount, readTokenMeta, type TokenMeta } from './tokens.ts'

const stakingAbi = stakingJson as Abi
export const STAKING_ADDRESS: Address =
  '0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501'

export type StakeDataResponse = Readonly<{
  totalStake: bigint
  totalUnstakable: bigint
  totalLocked: bigint
  totalLockedFlexible: bigint
  totalClaimable: bigint
  totalPendingUnstake: bigint
  totalExemptFromCooldownPeriod: bigint
  totalLockedPerEventType: readonly bigint[]
}>

export const normaliseStake = (
  held: bigint,
  staked: bigint,
  decimals: number,
  pendingAmount = 0n,
) => {
  const amounts = {
    held,
    staked,
    unstaked: held,
    totalScoutRating: held + staked,
    pendingAmount,
  }
  return {
    ...amounts,
    decimals,
    formatted: {
      held: formatTokenAmount(amounts.held, decimals),
      staked: formatTokenAmount(amounts.staked, decimals),
      unstaked: formatTokenAmount(amounts.unstaked, decimals),
      totalScoutRating: formatTokenAmount(amounts.totalScoutRating, decimals),
      pendingAmount: formatTokenAmount(pendingAmount, decimals),
    },
  }
}

export type NormalisedStake = ReturnType<typeof normaliseStake>

const validateRead = (client: PublicClient, token: Address): void => {
  if (client.chain?.id !== chiliz.id) {
    throw new Error('Socios staking reads require Chiliz Mainnet (88888).')
  }
  if (!isAddress(token) || token.toLowerCase() === zeroAddress) {
    throw new Error(`Invalid token address: ${token}`)
  }
}

/**
 * Uses getStakeDataLatest with perEventType=false to refresh stake accounting
 * within eth_call. Unlike the view getStakeData, its nonpayable logic runs in
 * simulation only; no transaction is sent and no simulated state is persisted.
 * "unstaked" means the liquid balanceOf in the wallet, not pending unstake.
 */
export const readStakeDataLatest = async (
  client: PublicClient,
  user: Address,
  token: Address,
): Promise<NormalisedStake> => {
  validateRead(client, token)
  if (!isAddress(user)) throw new Error(`Invalid wallet address: ${user}`)
  const [{ result }, held, meta] = await Promise.all([
    client.simulateContract({
      address: STAKING_ADDRESS,
      abi: stakingAbi,
      functionName: 'getStakeDataLatest',
      args: [user, token, false],
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user],
    }),
    readTokenMeta(chiliz.id, token),
  ])
  const data = result as StakeDataResponse
  return normaliseStake(
    held,
    data.totalStake,
    meta.decimals,
    data.totalPendingUnstake,
  )
}

/**
 * Simulates all stake refreshes in Multicall3 via eth_call, without persisting
 * state. simulateContract disables automatic batching, so use an explicit
 * multicall for portfolio reads rather than one simulation RPC per token.
 */
export type StakeBatchResult =
  | (NormalisedStake & { status: 'success'; meta: TokenMeta })
  | { status: 'failure' }

export function readStakeDataLatestBatch(
  client: PublicClient,
  user: Address,
  tokens: readonly Address[],
  options: { allowFailure: true; blockNumber?: bigint },
): Promise<StakeBatchResult[]>
export function readStakeDataLatestBatch(
  client: PublicClient,
  user: Address,
  tokens: readonly Address[],
  options?: { allowFailure?: false; blockNumber?: bigint },
): Promise<NormalisedStake[]>
export async function readStakeDataLatestBatch(
  client: PublicClient,
  user: Address,
  tokens: readonly Address[],
  options: { allowFailure?: boolean; blockNumber?: bigint } = {},
): Promise<(NormalisedStake | StakeBatchResult)[]> {
  if (!isAddress(user)) throw new Error(`Invalid wallet address: ${user}`)
  tokens.forEach((token) => validateRead(client, token))
  if (tokens.length === 0) return []
  const [results, metas] = await Promise.all([
    client.multicall({
      allowFailure: true,
      blockNumber: options.blockNumber,
      contracts: tokens.flatMap((token) => [
        {
          address: STAKING_ADDRESS,
          abi: stakingAbi,
          functionName: 'getStakeDataLatest',
          args: [user, token, false],
        },
        {
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [user],
        },
      ]),
    }),
    Promise.allSettled(tokens.map((token) => readTokenMeta(chiliz.id, token))),
  ])
  return tokens.map((_, index) => {
    const stake = results[index * 2]
    const held = results[index * 2 + 1]
    const meta = metas[index]
    if (
      stake.status === 'failure' ||
      held.status === 'failure' ||
      meta.status === 'rejected'
    ) {
      if (options.allowFailure) return { status: 'failure' }
      throw stake.status === 'failure'
        ? stake.error
        : held.status === 'failure'
          ? held.error
          : meta.status === 'rejected'
            ? meta.reason
            : new Error('Token data unavailable.')
    }
    const normalised = normaliseStake(
      held.result as bigint,
      (stake.result as StakeDataResponse).totalStake,
      meta.value.decimals,
      (stake.result as StakeDataResponse).totalPendingUnstake,
    )
    return options.allowFailure
      ? { status: 'success', meta: meta.value, ...normalised }
      : normalised
  })
}

/**
 * Contract-wide period in seconds, not a token amount. The token argument is
 * validated for API compatibility only; unstakePeriod() has no arguments and
 * does not expose any per-token override set by setUnstakePeriodForToken.
 */
export const readUnstakePeriod = async (
  client: PublicClient,
  token: Address,
  blockNumber?: bigint,
): Promise<bigint> => {
  validateRead(client, token)
  return (await client.readContract({
    address: STAKING_ADDRESS,
    abi: stakingAbi,
    functionName: 'unstakePeriod',
    args: [],
    blockNumber,
  })) as bigint
}

export type PendingUnstake = {
  pendingAmount: bigint
  releaseAt: bigint | null
  unstakePeriodSeconds: bigint | null
  pendingOperationCount: number
}

export const UNSTAKE_LOG_CHUNK_BLOCKS = 50000n
export const MAX_UNSTAKE_LOG_REQUESTS = 5
const BLOCK_TIME_SECONDS = 3n
const LOOKBACK_MARGIN_PERCENT = 10n

/**
 * PublicNode permits 50k-block log ranges (SR-52 review, 13 October 2026).
 * Look back the live default period plus 10%, estimating three-second blocks.
 * At most five sequential requests run without retries or Ankr fallback.
 * Incomplete history must never produce a guessed release deadline.
 */
export async function readPendingUnstakesBatch(
  client: PublicClient,
  user: Address,
  tokens: readonly { token: Address; pendingAmount: bigint }[],
  blockNumber: bigint,
): Promise<PendingUnstake[]> {
  if (!isAddress(user)) throw new Error(`Invalid wallet address: ${user}`)
  tokens.forEach(({ token }) => validateRead(client, token))
  if (tokens.length === 0) return []
  const unstakePeriodSeconds = await readUnstakePeriod(
    client,
    tokens[0].token,
    blockNumber,
  ).catch(() => null)
  const result: PendingUnstake[] = tokens.map(({ pendingAmount }) => ({
    pendingAmount,
    releaseAt: null,
    unstakePeriodSeconds,
    pendingOperationCount: 0,
  }))
  const pending = tokens.filter(({ pendingAmount }) => pendingAmount > 0n)
  if (pending.length > 0 && unstakePeriodSeconds !== null) {
    try {
      const unstakeTopics = encodeEventTopics({
        abi: stakingAbi,
        eventName: 'Unstake',
        args: { staker: user, token: pending.map(({ token }) => token) },
      })
      const claimTopics = encodeEventTopics({
        abi: stakingAbi,
        eventName: 'Claim',
      })
      const periodBlocks =
        (unstakePeriodSeconds + BLOCK_TIME_SECONDS - 1n) / BLOCK_TIME_SECONDS
      const marginBlocks = (periodBlocks * LOOKBACK_MARGIN_PERCENT + 99n) / 100n
      const budgetBlocks =
        UNSTAKE_LOG_CHUNK_BLOCKS * BigInt(MAX_UNSTAKE_LOG_REQUESTS)
      const lookbackBlocks = periodBlocks + marginBlocks + 1n
      const windowBlocks =
        lookbackBlocks < budgetBlocks ? lookbackBlocks : budgetBlocks
      const from =
        blockNumber + 1n > windowBlocks ? blockNumber + 1n - windowBlocks : 0n
      const logClient = getStakingLogClient()
      const logs = []
      for (
        let start = from, requests = 0;
        start <= blockNumber && requests < MAX_UNSTAKE_LOG_REQUESTS;
        start += UNSTAKE_LOG_CHUNK_BLOCKS, requests++
      ) {
        const end = start + UNSTAKE_LOG_CHUNK_BLOCKS - 1n
        logs.push(
          ...(await logClient.request(
            {
              method: 'eth_getLogs',
              params: [
                {
                  address: STAKING_ADDRESS,
                  topics: [
                    [unstakeTopics[0] as Hex, claimTopics[0] as Hex],
                    ...unstakeTopics.slice(1),
                  ],
                  fromBlock: `0x${start.toString(16)}`,
                  toBlock: `0x${(end < blockNumber ? end : blockNumber).toString(16)}`,
                },
              ],
            },
            { retryCount: 0 },
          )),
        )
      }
      logs.sort((a, b) => {
        const difference = BigInt(a.blockNumber!) - BigInt(b.blockNumber!)
        return difference === 0n
          ? Number(BigInt(a.logIndex!) - BigInt(b.logIndex!))
          : difference < 0n
            ? -1
            : 1
      })
      const operations = new Map<
        string,
        { amount: bigint; releaseAt: bigint }[]
      >()
      const incomplete = new Set<string>()
      for (const log of logs) {
        if (log.removed) throw new Error('Removed staking event.')
        const decoded = decodeEventLog({
          abi: stakingAbi,
          data: log.data,
          topics: log.topics,
        })
        const args = decoded.args as unknown as {
          staker: Address
          token: Address
          amount: bigint
          claimableAt?: bigint
        }
        if (args.staker.toLowerCase() !== user.toLowerCase()) continue
        const key = args.token.toLowerCase()
        const queue = operations.get(key) ?? []
        if (decoded.eventName === 'Unstake') {
          if (!args.claimableAt || args.claimableAt > 8640000000000n) {
            incomplete.add(key)
            continue
          }
          if (args.amount === 0n) continue
          queue.push({ amount: args.amount, releaseAt: args.claimableAt })
          queue.sort((a, b) =>
            a.releaseAt < b.releaseAt ? -1 : a.releaseAt > b.releaseAt ? 1 : 0,
          )
        } else if (decoded.eventName === 'Claim') {
          let remaining = args.amount
          while (remaining > 0n && queue.length > 0) {
            const consumed =
              remaining < queue[0].amount ? remaining : queue[0].amount
            remaining -= consumed
            queue[0].amount -= consumed
            if (queue[0].amount === 0n) queue.shift()
          }
          if (remaining > 0n) incomplete.add(key)
        }
        operations.set(key, queue)
      }
      tokens.forEach(({ token, pendingAmount }, index) => {
        const queue = operations.get(token.toLowerCase()) ?? []
        if (
          pendingAmount > 0n &&
          !incomplete.has(token.toLowerCase()) &&
          queue.length > 0 &&
          queue.reduce((sum, operation) => sum + operation.amount, 0n) ===
            pendingAmount
        ) {
          result[index].releaseAt = queue[0].releaseAt
          result[index].pendingOperationCount = queue.length
        }
      })
    } catch {
      // Keep the tuple's amount even when the bounded history is unavailable.
    }
  }
  return result
}
