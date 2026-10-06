import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const environmentVariables = [
  'NEXT_PUBLIC_APP_CHAIN_ID',
  'NEXT_PUBLIC_DATA_CHAIN_ID',
  'RPC_URL_MAINNET',
  'RPC_URL_MAINNET_FALLBACK',
  'RPC_URL_SPICY',
  'RPC_WS_URL_MAINNET',
  'RPC_WS_URL_SPICY',
] as const

let originalEnvironment: Partial<
  Record<(typeof environmentVariables)[number], string>
>

beforeEach(() => {
  originalEnvironment = Object.fromEntries(
    environmentVariables.map((name) => [name, process.env[name]]),
  )
  environmentVariables.forEach((name) => delete process.env[name])
  vi.resetModules()
})

afterEach(() => {
  environmentVariables.forEach((name) => {
    const originalValue = originalEnvironment[name]
    if (originalValue === undefined) delete process.env[name]
    else process.env[name] = originalValue
  })
  vi.resetModules()
})

describe('Chiliz chains', () => {
  it('configures Mainnet and Spicy with CHZ and the correct network flags', async () => {
    const { chiliz, spicy } = await import('./index')

    expect(chiliz.id).toBe(88888)
    expect(spicy.id).toBe(88882)
    expect(chiliz.nativeCurrency).toEqual({
      name: 'CHZ',
      symbol: 'CHZ',
      decimals: 18,
    })
    expect(spicy.nativeCurrency).toEqual(chiliz.nativeCurrency)
    expect(spicy.testnet).toBe(true)
    expect(chiliz.testnet).toBeFalsy()
  })

  it('uses documented RPCs and explorers by default', async () => {
    const { chiliz, spicy } = await import('./index')

    expect(chiliz.rpcUrls.default.http).toEqual([
      'https://rpc.ankr.com/chiliz',
      'https://chiliz-rpc.publicnode.com',
    ])
    expect(chiliz.rpcUrls.default.webSocket).toEqual([
      'wss://chiliz-rpc.publicnode.com',
    ])
    expect(spicy.rpcUrls.default.http).toEqual([
      'https://spicy-rpc.chiliz.com/',
    ])
    expect(spicy.rpcUrls.default.webSocket).toEqual([
      'wss://spicy-rpc-ws.chiliz.com/',
    ])
    expect(chiliz.blockExplorers.default.url).toBe('https://chiliscan.com')
    expect(chiliz.blockExplorers.chilizScan.url).toBe('https://scan.chiliz.com')
    expect(spicy.blockExplorers.default.url).toBe(
      'https://testnet.chiliscan.com',
    )
    expect(spicy.blockExplorers.spicyExplorer.url).toBe(
      'https://spicy-explorer.chiliz.com',
    )
  })

  it('applies all RPC URL overrides', async () => {
    process.env.RPC_URL_MAINNET = 'https://mainnet.example'
    process.env.RPC_URL_MAINNET_FALLBACK = 'https://fallback.example'
    process.env.RPC_URL_SPICY = 'https://spicy.example'
    process.env.RPC_WS_URL_MAINNET = 'wss://mainnet.example'
    process.env.RPC_WS_URL_SPICY = 'wss://spicy.example'

    const { chiliz, spicy } = await import('./index')

    expect(chiliz.rpcUrls.default.http).toEqual([
      'https://mainnet.example',
      'https://fallback.example',
    ])
    expect(chiliz.rpcUrls.default.webSocket).toEqual(['wss://mainnet.example'])
    expect(spicy.rpcUrls.default.http).toEqual(['https://spicy.example'])
    expect(spicy.rpcUrls.default.webSocket).toEqual(['wss://spicy.example'])
  })
})

describe('network helpers', () => {
  it('resolves defaults and configured chain IDs', async () => {
    const { getAppChain, getDataChain } = await import('./index')

    expect(getAppChain().id).toBe(88882)
    expect(getDataChain().id).toBe(88888)

    process.env.NEXT_PUBLIC_APP_CHAIN_ID = '88888'
    process.env.NEXT_PUBLIC_DATA_CHAIN_ID = '88882'
    expect(getAppChain().id).toBe(88888)
    expect(getDataChain().id).toBe(88882)

    process.env.NEXT_PUBLIC_APP_CHAIN_ID = ''
    expect(getAppChain().id).toBe(88882)
  })

  it('rejects malformed or unsupported configured chain IDs clearly', async () => {
    const { getAppChain, getDataChain } = await import('./index')

    for (const rawChainId of ['abc', '0x15b38', ' 88888 ', '1']) {
      process.env.NEXT_PUBLIC_APP_CHAIN_ID = rawChainId
      expect(() => getAppChain()).toThrow(
        `Unsupported chain ID "${rawChainId}" in NEXT_PUBLIC_APP_CHAIN_ID (expected 88888 or 88882)`,
      )
    }

    process.env.NEXT_PUBLIC_DATA_CHAIN_ID = 'abc'
    expect(() => getDataChain()).toThrow(
      'Unsupported chain ID "abc" in NEXT_PUBLIC_DATA_CHAIN_ID (expected 88888 or 88882)',
    )
  })

  it('rejects unsupported explorer chain IDs', async () => {
    const { explorerAddressUrl, explorerTxUrl } = await import('./index')

    expect(() => explorerAddressUrl(1, '0xabc')).toThrow(
      'Unsupported chain ID: 1',
    )
    expect(() => explorerTxUrl(1, '0xabc')).toThrow('Unsupported chain ID: 1')
  })

  it('identifies supported chain IDs', async () => {
    const { isSupportedChainId } = await import('./index')

    expect(isSupportedChainId(88888)).toBe(true)
    expect(isSupportedChainId(88882)).toBe(true)
    expect(isSupportedChainId(1)).toBe(false)
  })

  it('builds address and transaction URLs for each explorer', async () => {
    const { explorerAddressUrl, explorerTxUrl } = await import('./index')

    expect(explorerAddressUrl(88888, '0xabc')).toBe(
      'https://chiliscan.com/address/0xabc',
    )
    expect(explorerTxUrl(88888, '0x123')).toBe('https://chiliscan.com/tx/0x123')
    expect(explorerAddressUrl(88882, '0xabc')).toBe(
      'https://testnet.chiliscan.com/address/0xabc',
    )
    expect(explorerTxUrl(88882, '0x123')).toBe(
      'https://testnet.chiliscan.com/tx/0x123',
    )
  })
})
