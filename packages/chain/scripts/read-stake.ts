// External-wallet staking contributes to staking but does NOT earn Socios Reward Points.
import { isAddress } from 'viem'
import {
  FAN_TOKENS,
  chiliz,
  getDataChain,
  getPublicClient,
  getTokenAddress,
  readStakeDataLatest,
  readUnstakePeriod,
} from '../src/index.ts'

try {
  const [wallet, tokenKey, ...extra] = process.argv.slice(2)
  if (!wallet || !isAddress(wallet) || !tokenKey || extra.length) {
    throw new Error('Usage: read-stake.ts <public-wallet-address> <tokenKey>')
  }
  const token = FAN_TOKENS.find((entry) => entry.key === tokenKey)
  if (!token) throw new Error(`Unknown token key: ${tokenKey}`)
  const chain = getDataChain()
  if (chain.id !== chiliz.id) {
    throw new Error(
      'Socios staking is available on DATA_CHAIN Mainnet (88888) only.',
    )
  }
  const address = getTokenAddress(token, chain.id)
  if (!address)
    throw new Error(`Token ${tokenKey} is unavailable on DATA_CHAIN.`)
  const client = getPublicClient(chain.id)
  const [stake, unstakePeriodSeconds] = await Promise.all([
    readStakeDataLatest(client, wallet, address),
    readUnstakePeriod(client, address),
  ])
  console.log(
    JSON.stringify(
      { chainId: chain.id, tokenKey, ...stake, unstakePeriodSeconds },
      (_, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      2,
    ),
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Staking read failed.')
  process.exitCode = 1
}
