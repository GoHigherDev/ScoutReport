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
  readTokenMeta,
} from '@scoutreport/chain'
import type { Address } from 'viem'

export async function readHoldings(address: Address) {
  const chain = getDataChain()
  if (chain.id !== chiliz.id)
    throw new Error('Fan Token holdings require Mainnet DATA_CHAIN.')
  const tokens = FAN_TOKENS.flatMap((token) => {
    if (!token.addresses[chiliz.id]) return []
    const tokenAddress = getTokenAddress(token, chain.id)
    return tokenAddress ? [{ key: token.key, address: tokenAddress }] : []
  })
  const [stakes, metas] = await Promise.all([
    readStakeDataLatestBatch(
      getPublicClient(chain.id),
      address,
      tokens.map((token) => token.address),
    ),
    Promise.all(tokens.map((token) => readTokenMeta(chain.id, token.address))),
  ])
  return tokens.flatMap((token, index) => {
    const stake = stakes[index]
    return stake.held > 0n || stake.staked > 0n
      ? [{ key: token.key, symbol: metas[index].symbol, ...stake }]
      : []
  })
}

export function useHoldings() {
  const { address, isConnected } = useConnection()
  return useQuery({
    queryKey: [
      'holdings',
      getDataChain().id,
      isConnected ? address : undefined,
    ],
    queryFn: () => readHoldings(address!),
    enabled: isConnected && Boolean(address),
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
