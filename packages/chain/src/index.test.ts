import { describe, expect, it } from 'vitest'
import {
  chiliz,
  explorerAddressUrl,
  explorerTxUrl,
  getAppChain,
  getDataChain,
  isSupportedChainId,
  spicy,
} from './index'

describe('Chiliz chains', () => {
  it('configures Mainnet and Spicy with CHZ', () => {
    expect(chiliz.id).toBe(88888)
    expect(spicy.id).toBe(88882)
    expect(chiliz.nativeCurrency).toEqual({
      name: 'CHZ',
      symbol: 'CHZ',
      decimals: 18,
    })
    expect(spicy.nativeCurrency).toEqual(chiliz.nativeCurrency)
  })

  it('includes the documented RPCs and explorers', () => {
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
})

describe('network helpers', () => {
  it('resolves defaults and configured chain IDs', () => {
    const appChainId = process.env.NEXT_PUBLIC_APP_CHAIN_ID
    const dataChainId = process.env.NEXT_PUBLIC_DATA_CHAIN_ID

    try {
      delete process.env.NEXT_PUBLIC_APP_CHAIN_ID
      delete process.env.NEXT_PUBLIC_DATA_CHAIN_ID
      expect(getAppChain().id).toBe(88882)
      expect(getDataChain().id).toBe(88888)

      process.env.NEXT_PUBLIC_APP_CHAIN_ID = '88888'
      process.env.NEXT_PUBLIC_DATA_CHAIN_ID = '88882'
      expect(getAppChain().id).toBe(88888)
      expect(getDataChain().id).toBe(88882)
    } finally {
      if (appChainId === undefined) delete process.env.NEXT_PUBLIC_APP_CHAIN_ID
      else process.env.NEXT_PUBLIC_APP_CHAIN_ID = appChainId
      if (dataChainId === undefined)
        delete process.env.NEXT_PUBLIC_DATA_CHAIN_ID
      else process.env.NEXT_PUBLIC_DATA_CHAIN_ID = dataChainId
    }
  })

  it('rejects unsupported configured and helper chain IDs', () => {
    const appChainId = process.env.NEXT_PUBLIC_APP_CHAIN_ID

    try {
      process.env.NEXT_PUBLIC_APP_CHAIN_ID = '1'
      expect(() => getAppChain()).toThrow('Unsupported chain ID: 1')
      expect(() => explorerAddressUrl(1, '0xabc')).toThrow(
        'Unsupported chain ID: 1',
      )
      expect(() => explorerTxUrl(1, '0xabc')).toThrow('Unsupported chain ID: 1')
    } finally {
      if (appChainId === undefined) delete process.env.NEXT_PUBLIC_APP_CHAIN_ID
      else process.env.NEXT_PUBLIC_APP_CHAIN_ID = appChainId
    }
  })

  it('identifies supported chain IDs', () => {
    expect(isSupportedChainId(88888)).toBe(true)
    expect(isSupportedChainId(88882)).toBe(true)
    expect(isSupportedChainId(1)).toBe(false)
  })

  it('builds address and transaction URLs for each explorer', () => {
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
