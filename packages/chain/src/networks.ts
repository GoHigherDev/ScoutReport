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
  envValue: string | undefined,
  defaultChainId: number,
): SupportedChain =>
  getChain(envValue === undefined ? defaultChainId : Number(envValue))

export const getAppChain = (): SupportedChain =>
  getConfiguredChain(
    typeof process === 'undefined'
      ? undefined
      : process.env.NEXT_PUBLIC_APP_CHAIN_ID,
    spicy.id,
  )

export const getDataChain = (): SupportedChain =>
  getConfiguredChain(
    typeof process === 'undefined'
      ? undefined
      : process.env.NEXT_PUBLIC_DATA_CHAIN_ID,
    chiliz.id,
  )

export const explorerAddressUrl = (chainId: number, address: string): string =>
  `${getChain(chainId).blockExplorers.default.url}/address/${encodeURIComponent(address)}`

export const explorerTxUrl = (chainId: number, hash: string): string =>
  `${getChain(chainId).blockExplorers.default.url}/tx/${encodeURIComponent(hash)}`
