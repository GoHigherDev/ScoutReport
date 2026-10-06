import {
  createWalletClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  multicall3Abi,
  type Hex,
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('./chains.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./chains.ts')>()
  return {
    ...original,
    chilizTransport: custom({ request }, { retryCount: 0 }),
    spicyTransport: custom({ request }, { retryCount: 0 }),
  }
})

beforeEach(() => {
  vi.resetModules()
  request.mockReset()
})

const mockMetadata = (decimals: number, symbol = 'NAVI', fail = false) => {
  request.mockImplementation(
    ({ method, params }: { method: string; params: [{ data: Hex }] }) => {
      expect(method).toBe('eth_call')
      const { args, functionName } = decodeFunctionData({
        abi: multicall3Abi,
        data: params[0].data,
      })
      if (functionName !== 'aggregate3') throw new Error('Expected aggregate3')
      const results = args[0].map(({ callData }) => {
        const { functionName } = decodeFunctionData({
          abi: erc20Abi,
          data: callData,
        })
        const result =
          functionName === 'decimals'
            ? encodeFunctionResult({
                abi: erc20Abi,
                functionName,
                result: decimals,
              })
            : functionName === 'symbol'
              ? encodeFunctionResult({
                  abi: erc20Abi,
                  functionName,
                  result: symbol,
                })
              : encodeFunctionResult({
                  abi: erc20Abi,
                  functionName: 'name',
                  result: 'Natus Vincere',
                })
        return {
          success: !(fail && functionName === 'decimals'),
          returnData:
            fail && functionName === 'decimals' ? ('0x' as const) : result,
        }
      })
      return encodeFunctionResult({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        result: results,
      })
    },
  )
}

describe('shared public clients', () => {
  it('memoises clients per supported chain and enables multicall', async () => {
    const { getPublicClient, spicy } = await import('./index.ts')
    expect(getPublicClient(88882)).toBe(getPublicClient(88882))
    expect(getPublicClient(88888)).toBe(getPublicClient(88888))
    expect(getPublicClient(88882)).not.toBe(getPublicClient(88888))
    expect(getPublicClient(88882).chain?.id).toBe(88882)
    expect(getPublicClient(88888).chain?.id).toBe(88888)
    expect(getPublicClient(88882).batch?.multicall).toBe(true)
    expect(spicy.contracts.multicall3.address).toBe(
      '0xcA11bde05977b3631167028862bE2a173976CA11',
    )
    expect(() => getPublicClient(1)).toThrow('Unsupported chain ID: 1')
  })

  it('can be used without browser globals or a Node process global', async () => {
    const { getPublicClient } = await import('./index.ts')
    vi.stubGlobal('process', undefined)
    try {
      expect(getPublicClient(88882).chain?.id).toBe(88882)
      expect(getPublicClient(88888).chain?.id).toBe(88888)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('ensureChain', () => {
  const wallet = (provider: (args: unknown) => Promise<unknown>) =>
    createWalletClient({
      transport: custom({ request: provider }, { retryCount: 0 }),
    })

  it('does nothing when the wallet is already on the requested chain', async () => {
    const { ensureChain } = await import('./index.ts')
    const provider = vi.fn().mockResolvedValue('0x15b32')
    await ensureChain(wallet(provider), 88882)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(provider.mock.calls[0][0].method).toBe('eth_chainId')
  })

  it('switches an existing network', async () => {
    const { ensureChain } = await import('./index.ts')
    const provider = vi
      .fn()
      .mockResolvedValueOnce('0x1')
      .mockResolvedValue(null)
    await ensureChain(wallet(provider), 88882)
    expect(provider.mock.calls[1][0]).toEqual({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x15b32' }],
    })
  })

  it('adds an unknown chain and then switches again', async () => {
    const { ensureChain } = await import('./index.ts')
    const provider = vi
      .fn()
      .mockResolvedValueOnce('0x1')
      .mockRejectedValueOnce({ code: 4902, message: 'Unknown chain' })
      .mockResolvedValue(null)
    await ensureChain(wallet(provider), 88882)
    expect(provider.mock.calls.map(([call]) => call.method)).toEqual([
      'eth_chainId',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'wallet_switchEthereumChain',
    ])
    expect(provider.mock.calls[2][0].params[0]).toMatchObject({
      chainId: '0x15b32',
      rpcUrls: ['https://spicy-rpc.chiliz.com/'],
      blockExplorerUrls: [
        'https://testnet.chiliscan.com',
        'https://spicy-explorer.chiliz.com',
      ],
    })
  })

  it.each(['switch', 'add', 'retry'])(
    'maps user rejection during %s to a typed error',
    async (step) => {
      const { ensureChain, ChainSwitchRejectedError } =
        await import('./index.ts')
      const rejection = { code: 4001, message: 'User rejected' }
      const provider = vi.fn().mockResolvedValueOnce('0x1')
      if (step !== 'switch') {
        provider.mockRejectedValueOnce({ code: 4902, message: 'Unknown chain' })
        if (step === 'retry') provider.mockResolvedValueOnce(null)
      }
      provider.mockRejectedValueOnce(rejection)
      const result = ensureChain(wallet(provider), 88882)
      await expect(result).rejects.toBeInstanceOf(ChainSwitchRejectedError)
      await expect(result).rejects.toThrow(
        'Please approve the change in your wallet.',
      )
    },
  )

  it('does not add a chain on unrelated errors', async () => {
    const { ensureChain } = await import('./index.ts')
    const provider = vi
      .fn()
      .mockResolvedValueOnce('0x1')
      .mockRejectedValueOnce({ code: -32603, message: 'Internal error' })
    await expect(ensureChain(wallet(provider), 88882)).rejects.toThrow()
    expect(provider).toHaveBeenCalledTimes(2)
    await expect(ensureChain(wallet(provider), 1)).rejects.toThrow(
      'Unsupported chain ID: 1',
    )
  })
})

describe('Fan Token metadata and verification', () => {
  it('reads non-18 decimals on Spicy, caches in-flight reads and batches multiple tokens', async () => {
    const { FAN_TOKENS, readTokenMeta, spicy } = await import('./index.ts')
    const addresses = FAN_TOKENS.map((token) => token.addresses[88888] as Hex)
    mockMetadata(6)
    const first = readTokenMeta(88882, addresses[0])
    expect(readTokenMeta(88882, addresses[0].toLowerCase() as Hex)).toBe(first)
    const result = await Promise.all([
      first,
      readTokenMeta(88882, addresses[1]),
    ])
    expect(result).toEqual([
      { symbol: 'NAVI', name: 'Natus Vincere', decimals: 6 },
      { symbol: 'NAVI', name: 'Natus Vincere', decimals: 6 },
    ])
    expect(request).toHaveBeenCalledTimes(1)
    const call = request.mock.calls[0][0].params[0]
    expect(call.to.toLowerCase()).toBe(
      spicy.contracts.multicall3.address.toLowerCase(),
    )
    const { args, functionName } = decodeFunctionData({
      abi: multicall3Abi,
      data: call.data,
    })
    if (functionName !== 'aggregate3') throw new Error('Expected aggregate3')
    expect(args[0]).toHaveLength(6)
    expect(
      args[0].map(
        ({ callData }) =>
          decodeFunctionData({
            abi: erc20Abi,
            data: callData,
          }).functionName,
      ),
    ).toEqual(['symbol', 'name', 'decimals', 'symbol', 'name', 'decimals'])
    await readTokenMeta(88882, addresses[0])
    expect(request).toHaveBeenCalledTimes(1)
    await readTokenMeta(88888, addresses[0])
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not cache failed decimals reads', async () => {
    const { FAN_TOKENS, readTokenMeta } = await import('./index.ts')
    const address = FAN_TOKENS[0].addresses[88888] as Hex
    mockMetadata(6, 'NAVI', true)
    await expect(readTokenMeta(88882, address)).rejects.toThrow()
    mockMetadata(0)
    expect((await readTokenMeta(88882, address)).decimals).toBe(0)
    expect(request).toHaveBeenCalledTimes(2)
    expect(() => readTokenMeta(88882, '' as Hex)).toThrow(
      'Invalid token address',
    )
  })

  it('accepts verified config and treats absent Spicy deployments as unavailable', async () => {
    const { FAN_TOKENS, validateTokenConfig, getTokenAddress, verifyTokens } =
      await import('./index.ts')
    expect(() => validateTokenConfig()).not.toThrow()
    expect(getTokenAddress(FAN_TOKENS[0], 88882)).toBeUndefined()
    expect(await verifyTokens(88882)).toEqual([
      'NAVI: not available on chain 88882',
      'AFC: not available on chain 88882',
    ])
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['', '0x123', '0x0000000000000000000000000000000000000000'])(
    'rejects invalid configured address %s',
    async (address) => {
      const { FAN_TOKENS, verifyTokens } = await import('./index.ts')
      await expect(
        verifyTokens(88888, [
          {
            ...FAN_TOKENS[0],
            addresses: { 88888: address },
          },
        ]),
      ).rejects.toThrow('Invalid address')
      expect(request).not.toHaveBeenCalled()
    },
  )

  it('rejects missing Mainnet addresses and malformed optional Spicy addresses', async () => {
    const { FAN_TOKENS, validateTokenConfig } = await import('./index.ts')
    expect(() =>
      validateTokenConfig([{ ...FAN_TOKENS[0], addresses: {} }]),
    ).toThrow('Missing Mainnet address')
    expect(() =>
      validateTokenConfig([
        {
          ...FAN_TOKENS[0],
          addresses: { ...FAN_TOKENS[0].addresses, 88882: '' },
        },
      ]),
    ).toThrow('Invalid address')
  })

  it('verifies symbol and decimals against config rather than assuming decimals', async () => {
    const { FAN_TOKENS, verifyTokens } = await import('./index.ts')
    mockMetadata(18)
    expect(await verifyTokens(88888, [FAN_TOKENS[0]])).toHaveLength(1)
    await expect(
      verifyTokens(88888, [
        {
          ...FAN_TOKENS[0],
          expectedDecimals: 6,
        },
      ]),
    ).rejects.toThrow('metadata mismatch')
    await expect(
      verifyTokens(88888, [
        {
          ...FAN_TOKENS[0],
          symbol: 'OTHER',
        },
      ]),
    ).rejects.toThrow('metadata mismatch')
  })
})

describe('token amounts', () => {
  it('formats en-GB amounts without losing bigint precision', async () => {
    const { formatTokenAmount, parseTokenAmount } = await import('./index.ts')
    const value = '9007199254740993.123456'
    expect(formatTokenAmount(parseTokenAmount(value, 6), 6)).toBe(
      '9,007,199,254,740,993.123456',
    )
    expect(formatTokenAmount(1234567n, 6)).toBe('1.234567')
    expect(formatTokenAmount(1234n, 0)).toBe('1,234')
    expect(formatTokenAmount(-1234567n, 6)).toBe('-1.234567')
    expect(formatTokenAmount(0n, 6)).toBe('0')
    expect(
      formatTokenAmount(999999n, 6, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }),
    ).toBe('1.00')
    expect(
      formatTokenAmount(1234000n, 6, {
        useGrouping: false,
        minimumFractionDigits: 4,
      }),
    ).toBe('1.2340')
  })

  it('parses exact amounts and rejects silent precision loss or invalid input', async () => {
    const { parseTokenAmount, formatTokenAmount } = await import('./index.ts')
    expect(parseTokenAmount('1.234567', 6)).toBe(1234567n)
    expect(parseTokenAmount('-1.5', 6)).toBe(-1500000n)
    expect(parseTokenAmount('1.000', 0)).toBe(1n)
    expect(() => parseTokenAmount('1.000001', 0)).toThrow('decimal places')
    expect(() => parseTokenAmount('1.2345678', 6)).toThrow('decimal places')
    for (const amount of ['1,000', '1e3', '', 'NaN', ' 1 ', '.5']) {
      expect(() => parseTokenAmount(amount, 6)).toThrow('token amount')
    }
    for (const decimals of [-1, 256, 1.5, NaN]) {
      expect(() => parseTokenAmount('1', decimals)).toThrow('Token decimals')
      expect(() => formatTokenAmount(1n, decimals)).toThrow('Token decimals')
    }
  })
})
