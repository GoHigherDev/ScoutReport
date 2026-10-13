import { createPublicClient, type PublicClient } from 'viem'
import {
  chiliz,
  chilizLogsTransport,
  chilizTransport,
  spicyTransport,
} from './chains.ts'
import { getChain } from './networks.ts'

const clients = new Map<number, PublicClient>()
let stakingLogClient: PublicClient | undefined

export const getStakingLogClient = (): PublicClient => {
  stakingLogClient ??= createPublicClient({
    chain: chiliz,
    transport: chilizLogsTransport,
  })
  return stakingLogClient
}

export const getPublicClient = (chainId: number): PublicClient => {
  const chain = getChain(chainId)
  let client = clients.get(chainId)
  if (!client) {
    client = createPublicClient({
      chain,
      transport: chainId === chiliz.id ? chilizTransport : spicyTransport,
      batch: { multicall: true },
    })
    clients.set(chainId, client)
  }
  return client
}
