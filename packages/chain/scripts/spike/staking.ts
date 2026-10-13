import { erc20Abi, type Abi, type Address } from 'viem'
import stakingJson from '../../abis/staking.json' with { type: 'json' }
import {
  STAKING_ADDRESS,
  normaliseStake,
  type StakeDataResponse,
} from '../../src/staking.ts'
import { FAN_TOKENS, getTokenAddress } from '../../src/tokens.config.ts'
import { cli, type Probe } from './common.ts'

const abi = stakingJson as Abi

// Public Stake/Unstake samples from SR-30, not verified wallet-brand examples.
export const STAKERS: readonly { tokenKey: string; user: Address }[] = [
  { tokenKey: 'NAVI', user: '0x2bda90268064f289df62dd48c9b7a48fb9d9383b' },
  { tokenKey: 'AFC', user: '0xf2f267dbe597eb029e44359ca4e14ec991c88cc2' },
  { tokenKey: 'AFC', user: '0xfea00bddbf1dd40300f9739b933c0070b004049d' },
  { tokenKey: 'AFC', user: '0xe57316b95c3b2f1daac76e907705469e30af57e9' },
]

export const probeStaking: Probe = async ({ client, blockNumber, record }) => {
  const read = (functionName: string, args: readonly unknown[] = []) =>
    client.readContract({
      address: STAKING_ADDRESS,
      abi,
      functionName,
      args,
      blockNumber,
    })
  await Promise.all(
    ['unstakePeriod', 'MAX_UNSTAKE_PERIOD_SEC'].map((name) =>
      record(`staking.${name}`, () => read(name)),
    ),
  )
  for (const { tokenKey, user } of STAKERS) {
    const token = FAN_TOKENS.find((entry) => entry.key === tokenKey)
    const address = token && getTokenAddress(token, 88888)
    if (!address)
      throw new Error(`Missing configured Mainnet token: ${tokenKey}`)
    const prefix = `staking.${tokenKey}.${user}`
    const [decimals, held, latest] = await Promise.all([
      record(`${prefix}.decimals`, () =>
        client.readContract({
          address,
          abi: erc20Abi,
          functionName: 'decimals',
          blockNumber,
        }),
      ),
      record(`${prefix}.balanceOf`, () =>
        client.readContract({
          address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [user],
          blockNumber,
        }),
      ),
      record(`${prefix}.getStakeDataLatest.true`, async () => {
        // The existing helper omits pending/cooldown fields; capture the raw tuple.
        const { result } = await client.simulateContract({
          address: STAKING_ADDRESS,
          abi,
          functionName: 'getStakeDataLatest',
          args: [user, address, true],
          blockNumber,
        })
        return result as StakeDataResponse
      }),
      ...['getStakeData', 'getStake', 'getTotalStake', 'getTotalStakers'].map(
        (name) =>
          record(`${prefix}.${name}`, () =>
            read(
              name,
              name === 'getStakeData'
                ? [user, address, true]
                : name === 'getStake'
                  ? [user, address]
                  : [address],
            ),
          ),
      ),
      record(`${prefix}.getStakeDataLatest.false`, async () => {
        const { result } = await client.simulateContract({
          address: STAKING_ADDRESS,
          abi,
          functionName: 'getStakeDataLatest',
          args: [user, address, false],
          blockNumber,
        })
        return result
      }),
      record(`${prefix}.getClaimableStake`, async () => {
        const { result } = await client.simulateContract({
          address: STAKING_ADDRESS,
          abi,
          functionName: 'getClaimableStake',
          args: [user, address],
          blockNumber,
        })
        return result
      }),
    ])
    if (decimals !== undefined && held !== undefined && latest !== undefined) {
      await record(`${prefix}.normalised`, async () =>
        normaliseStake(held, latest.totalStake, decimals),
      )
    }
  }
  await record('staking.recentEvents', () =>
    client.getLogs({
      address: STAKING_ADDRESS,
      fromBlock: blockNumber > 499n ? blockNumber - 499n : 0n,
      toBlock: blockNumber,
    }),
  )
}

await cli(import.meta.url, [probeStaking])
