import { isAddress, zeroAddress, type Address } from 'viem'
import { getChain, isSupportedChainId } from './networks.ts'

export type FanTokenConfig = {
  key: string
  symbol: string
  sport: 'cs2' | 'football'
  name: string
  expectedDecimals: number
  addresses: Partial<Record<88888 | 88882, string>>
}

// V2 reference: https://docs.chiliz.com/quick-start/token-contract-addresses
export const FAN_TOKENS: readonly FanTokenConfig[] = [
  {
    key: 'NAVI',
    symbol: 'NAVI',
    sport: 'cs2',
    name: 'Natus Vincere',
    expectedDecimals: 18,
    addresses: {
      // https://scan.chiliz.com/token/0x02728748392F1875682940681F4C936Fc683A68e
      88888: '0x02728748392F1875682940681F4C936Fc683A68e',
    },
  },
  {
    key: 'AFC',
    symbol: 'AFC',
    sport: 'football',
    name: 'Arsenal FC',
    expectedDecimals: 18,
    addresses: {
      // https://scan.chiliz.com/token/0x76088F3eD5dC655De9295D93868ec1EeC654A615
      88888: '0x76088F3eD5dC655De9295D93868ec1EeC654A615',
    },
  },
]

export const validateTokenConfig = (
  tokens: readonly FanTokenConfig[] = FAN_TOKENS,
): void => {
  for (const token of tokens) {
    if (
      !token.key ||
      !token.symbol ||
      !token.name ||
      !Number.isInteger(token.expectedDecimals) ||
      token.expectedDecimals < 0 ||
      token.expectedDecimals > 255
    ) {
      throw new Error(`Invalid Fan Token configuration: ${token.key}`)
    }
    if (token.addresses[88888] === undefined) {
      throw new Error(`Missing Mainnet address for ${token.key}`)
    }
    for (const [chainId, address] of Object.entries(token.addresses)) {
      if (
        !isSupportedChainId(Number(chainId)) ||
        !address ||
        !isAddress(address) ||
        address.toLowerCase() === zeroAddress
      ) {
        throw new Error(`Invalid address for ${token.key} on chain ${chainId}`)
      }
    }
  }
}

export const getTokenAddress = (
  token: FanTokenConfig,
  chainId: number,
): Address | undefined => {
  getChain(chainId)
  validateTokenConfig([token])
  return token.addresses[chainId as 88888 | 88882] as Address | undefined
}
