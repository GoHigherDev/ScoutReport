/**
 * External-wallet staking can contribute to staking and Scout Rating, but does
 * NOT earn Socios Reward Points. Only Socios Wallet staking earns RP.
 */
import {
  erc20Abi,
  isAddress,
  zeroAddress,
  type Abi,
  type Address,
  type PublicClient,
} from 'viem'
import stakingJson from '../abis/staking.json' with { type: 'json' }
import { chiliz } from './chains.ts'
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
) => {
  const amounts = {
    held,
    staked,
    unstaked: held,
    totalScoutRating: held + staked,
  }
  return {
    ...amounts,
    decimals,
    formatted: {
      held: formatTokenAmount(amounts.held, decimals),
      staked: formatTokenAmount(amounts.staked, decimals),
      unstaked: formatTokenAmount(amounts.unstaked, decimals),
      totalScoutRating: formatTokenAmount(amounts.totalScoutRating, decimals),
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
  return normaliseStake(held, data.totalStake, meta.decimals)
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
): Promise<bigint> => {
  validateRead(client, token)
  return (await client.readContract({
    address: STAKING_ADDRESS,
    abi: stakingAbi,
    functionName: 'unstakePeriod',
    args: [],
  })) as bigint
}
