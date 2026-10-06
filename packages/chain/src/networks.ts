import { chiliz, spicy } from './chains'

export const isSupportedChainId = (chainId: number): boolean =>
  chainId === chiliz.id || chainId === spicy.id

type SupportedChain = typeof chiliz | typeof spicy

const getChain = (chainId: number): SupportedChain => {
  if (chainId === chiliz.id) return chiliz
  if (chainId === spicy.id) return spicy
  throw new Error(`Unsupported chain ID: ${chainId}`)
}

const getConfiguredChain = (
  variableName: string,
  rawChainId: string | undefined,
  defaultChainId: number,
): SupportedChain => {
  if (rawChainId === undefined || rawChainId === '')
    return getChain(defaultChainId)
  if (!/^\d+$/.test(rawChainId)) {
    throw new Error(
      `Unsupported chain ID "${rawChainId}" in ${variableName} (expected ${chiliz.id} or ${spicy.id})`,
    )
  }

  const chainId = Number(rawChainId)
  if (!isSupportedChainId(chainId)) {
    throw new Error(
      `Unsupported chain ID "${rawChainId}" in ${variableName} (expected ${chiliz.id} or ${spicy.id})`,
    )
  }
  return getChain(chainId)
}

export const getAppChain = (): SupportedChain =>
  getConfiguredChain(
    'NEXT_PUBLIC_APP_CHAIN_ID',
    typeof process === 'undefined'
      ? undefined
      : process.env.NEXT_PUBLIC_APP_CHAIN_ID,
    spicy.id,
  )

export const getDataChain = (): SupportedChain =>
  getConfiguredChain(
    'NEXT_PUBLIC_DATA_CHAIN_ID',
    typeof process === 'undefined'
      ? undefined
      : process.env.NEXT_PUBLIC_DATA_CHAIN_ID,
    chiliz.id,
  )

export const explorerAddressUrl = (chainId: number, address: string): string =>
  `${getChain(chainId).blockExplorers.default.url}/address/${encodeURIComponent(address)}`

export const explorerTxUrl = (chainId: number, hash: string): string =>
  `${getChain(chainId).blockExplorers.default.url}/tx/${encodeURIComponent(hash)}`
