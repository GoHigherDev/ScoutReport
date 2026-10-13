'use client'

import { useQuery } from '@tanstack/react-query'
import { useConnection } from 'wagmi'
import {
  FAN_TOKENS,
  chiliz,
  getDataChain,
  getPublicClient,
  getTokenAddress,
  readStakeDataLatestBatch,
  type StakeBatchResult,
} from '@scoutreport/chain'
import type { Address } from 'viem'

export type PortfolioRow = StakeBatchResult & {
  key: string
  symbol: string
  blockNumber: bigint
}

export async function readHoldings(address: Address) {
  const chain = getDataChain()
  if (chain.id !== chiliz.id)
    throw new Error('Fan Token holdings require Mainnet DATA_CHAIN.')
  const tokens = FAN_TOKENS.flatMap((token) => {
    if (!token.addresses[chiliz.id]) return []
    const tokenAddress = getTokenAddress(token, chain.id)
    return tokenAddress
      ? [{ key: token.key, symbol: token.symbol, address: tokenAddress }]
      : []
  })
  const client = getPublicClient(chain.id)
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
  const stakes = await readStakeDataLatestBatch(
    client,
    address,
    tokens.map((token) => token.address),
    { allowFailure: true, blockNumber },
  )
  return tokens.flatMap<PortfolioRow>((token, index) => {
    const stake = stakes[index]
    const row = { key: token.key, symbol: token.symbol, blockNumber }
    if (stake.status === 'failure') return [{ ...row, ...stake }]
    return stake.held > 0n || stake.staked > 0n
      ? [{ ...row, ...stake, symbol: stake.meta.symbol }]
      : []
  })
}

export function useHoldings() {
  const { address, isConnected } = useConnection()
  return useOptimiserPortfolio(isConnected ? address : undefined)
}

export function useOptimiserPortfolio(address: Address | undefined) {
  return useQuery({
    queryKey: ['holdings', getDataChain().id, address],
    queryFn: () => readHoldings(address!),
    enabled: Boolean(address),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
  })
}

export function useWalletKind() {
  const { address, isConnected } = useConnection()
  const chain = getDataChain()
  const query = useQuery({
    queryKey: ['wallet-kind', chain.id, isConnected ? address : undefined],
    queryFn: async (): Promise<'eoa' | 'contract'> => {
      const code = await getPublicClient(chain.id).getCode({
        address: address!,
      })
      return code && code !== '0x' ? 'contract' : 'eoa'
    },
    enabled: isConnected && Boolean(address),
    gcTime: 0,
    retry: false,
  })
  return {
    ...query,
    kind: isConnected ? query.data : undefined,
    isContractAccount: isConnected && query.data === 'contract',
  }
}
