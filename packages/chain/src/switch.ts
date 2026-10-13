import type { WalletClient } from 'viem'
import { getChain } from './networks.ts'

export class ChainSwitchRejectedError extends Error {
  constructor(cause: unknown) {
    super(
      'Network change rejected. Please approve the change in your wallet.',
      {
        cause,
      },
    )
    this.name = 'ChainSwitchRejectedError'
  }
}

const hasCode = (error: unknown, code: number): boolean => {
  const seen = new Set<unknown>()
  while (typeof error === 'object' && error !== null && !seen.has(error)) {
    seen.add(error)
    if ('code' in error && error.code === code) return true
    error = 'cause' in error ? error.cause : undefined
  }
  return false
}

export const ensureChain = async (
  walletClient: Pick<WalletClient, 'getChainId' | 'switchChain' | 'addChain'>,
  chainId: number,
): Promise<void> => {
  const chain = getChain(chainId)
  try {
    if ((await walletClient.getChainId()) === chainId) return
    try {
      await walletClient.switchChain({ id: chainId })
    } catch (error) {
      if (!hasCode(error, 4902)) throw error
      await walletClient.addChain({ chain })
      await walletClient.switchChain({ id: chainId })
    }
  } catch (error) {
    if (hasCode(error, 4001)) throw new ChainSwitchRejectedError(error)
    throw error
  }
}
