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
import { formatTokenAmount, readTokenMeta } from './tokens.ts'

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
