import {
  erc20Abi,
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
} from 'viem'
import { getPublicClient } from './clients.ts'
import { getChain } from './networks.ts'
import {
  FAN_TOKENS,
  getTokenAddress,
  validateTokenConfig,
  type FanTokenConfig,
} from './tokens.config.ts'

export type TokenMeta = Readonly<{
  symbol: string
  name: string
  decimals: number
}>

const metadata = new Map<string, Promise<TokenMeta>>()

export const readTokenMeta = (
  chainId: number,
  address: Address,
): Promise<TokenMeta> => {
  getChain(chainId)
  if (!isAddress(address)) throw new Error(`Invalid token address: ${address}`)
  const key = `${chainId}:${address.toLowerCase()}`
  const cached = metadata.get(key)
  if (cached) return cached

  const pending = getPublicClient(chainId)
    .multicall({
      allowFailure: false,
      contracts: [
        { address, abi: erc20Abi, functionName: 'symbol' },
        { address, abi: erc20Abi, functionName: 'name' },
        { address, abi: erc20Abi, functionName: 'decimals' },
      ],
    })
    .then(([symbol, name, decimals]) =>
      Object.freeze({ symbol, name, decimals }),
    )
    .catch((error: unknown) => {
      metadata.delete(key)
      throw error
    })
  metadata.set(key, pending)
  return pending
}

const validateDecimals = (decimals: number): void => {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('Token decimals must be an integer between 0 and 255.')
  }
}

export const parseTokenAmount = (value: string, decimals: number): bigint => {
  validateDecimals(decimals)
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new Error('Enter a token amount without grouping separators.')
  }
  const fraction = value.split('.')[1] ?? ''
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error(`Token amount exceeds ${decimals} decimal places.`)
  }
  return parseUnits(value, decimals)
}

export const formatTokenAmount = (
  value: bigint,
  decimals: number,
  opts: {
    maximumFractionDigits?: number
    minimumFractionDigits?: number
    useGrouping?: boolean
  } = {},
): string => {
  validateDecimals(decimals)
  const maximum = opts.maximumFractionDigits ?? decimals
  const minimum = opts.minimumFractionDigits ?? 0
  if (
    !Number.isInteger(maximum) ||
    maximum < 0 ||
    maximum > 255 ||
    !Number.isInteger(minimum) ||
    minimum < 0 ||
    minimum > maximum
  ) {
    throw new Error('Invalid token amount fraction digits.')
  }
  // Round with bigint arithmetic: converting token balances to Number loses precision.
  const magnitude = value < 0n ? -value : value
  const places = Math.min(maximum, decimals)
  const divisor = 10n ** BigInt(decimals - places)
  const rounded = (magnitude + divisor / 2n) / divisor
  const [whole, rawFraction = ''] = formatUnits(rounded, places).split('.')
  const fraction = rawFraction.replace(/0+$/, '').padEnd(minimum, '0')
  const grouped = new Intl.NumberFormat('en-GB', {
    useGrouping: opts.useGrouping ?? true,
    maximumFractionDigits: 0,
  }).format(BigInt(whole))
  return `${value < 0n && rounded !== 0n ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`
}

export const verifyTokens = async (
  chainId: number,
  tokens: readonly FanTokenConfig[] = FAN_TOKENS,
): Promise<string[]> => {
  getChain(chainId)
  validateTokenConfig(tokens)
  return Promise.all(
    tokens.map(async (token) => {
      const address = getTokenAddress(token, chainId)
      if (!address) return `${token.key}: not available on chain ${chainId}`
      const meta = await readTokenMeta(chainId, address)
      if (
        meta.symbol !== token.symbol ||
        meta.decimals !== token.expectedDecimals
      ) {
        throw new Error(
          `${token.key} metadata mismatch on chain ${chainId}: expected ${token.symbol}/${token.expectedDecimals}, received ${meta.symbol}/${meta.decimals}`,
        )
      }
      return `${token.key}: ${address} (${meta.symbol}, ${meta.decimals} decimals)`
    }),
  )
}
