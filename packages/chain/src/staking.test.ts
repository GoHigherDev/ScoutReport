import {
  custom,
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionResult,
  erc20Abi,
  multicall3Abi,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import stakingJson from '../abis/staking.json'
import fixture from './fixtures/staking.json'
import type { StakeDataResponse } from './staking.ts'

const abi = stakingJson as Abi
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

const zeroStake: StakeDataResponse = {
  totalStake: BigInt(fixture.stakeDataLatest.totalStake),
  totalUnstakable: BigInt(fixture.stakeDataLatest.totalUnstakable),
  totalLocked: BigInt(fixture.stakeDataLatest.totalLocked),
  totalLockedFlexible: BigInt(fixture.stakeDataLatest.totalLockedFlexible),
  totalClaimable: BigInt(fixture.stakeDataLatest.totalClaimable),
  totalPendingUnstake: BigInt(fixture.stakeDataLatest.totalPendingUnstake),
  totalExemptFromCooldownPeriod: BigInt(
    fixture.stakeDataLatest.totalExemptFromCooldownPeriod,
  ),
  totalLockedPerEventType: [],
}

const setup = async (decimals = 18, held = 0n, stake = zeroStake) => {
  const helpers = await import('./index.ts')
  const token = helpers.getTokenAddress(helpers.FAN_TOKENS[0], 88888)!
  const user = fixture.wallet as Address
  const calls: string[] = []
  const reply = (to: Address, data: Hex): Hex => {
    const proxy = to.toLowerCase() === helpers.STAKING_ADDRESS
    const decoded = decodeFunctionData({ abi: proxy ? abi : erc20Abi, data })
    calls.push(decoded.functionName)
    if (proxy) {
      if (decoded.functionName === 'getStakeDataLatest') {
        expect(decoded.args).toEqual([user, token, false])
        return encodeFunctionResult({
          abi,
          functionName: 'getStakeDataLatest',
          result: stake,
        })
      }
      expect(decoded.functionName).toBe('unstakePeriod')
      expect(decoded.args ?? []).toEqual([])
      return encodeFunctionResult({
        abi,
        functionName: 'unstakePeriod',
        result: BigInt(fixture.unstakePeriodSeconds),
      })
    }
    expect(to.toLowerCase()).toBe(token.toLowerCase())
    switch (decoded.functionName) {
      case 'balanceOf':
        expect(decoded.args).toEqual([user])
        return encodeFunctionResult({
          abi: erc20Abi,
          functionName: 'balanceOf',
          result: held,
        })
      case 'decimals':
        return encodeFunctionResult({
          abi: erc20Abi,
          functionName: 'decimals',
          result: decimals,
        })
      case 'symbol':
        return encodeFunctionResult({
          abi: erc20Abi,
          functionName: 'symbol',
          result: 'NAVI',
        })
      case 'name':
        return encodeFunctionResult({
          abi: erc20Abi,
          functionName: 'name',
          result: 'Natus Vincere',
        })
      default:
        throw new Error(`Unexpected read: ${decoded.functionName}`)
    }
  }
  request.mockImplementation(
    ({
      method,
      params,
    }: {
      method: string
      params: [{ to: Address; data: Hex }]
    }) => {
      expect(method).toBe('eth_call')
      const { to, data } = params[0]
      if (
        to.toLowerCase() !==
        helpers.chiliz.contracts.multicall3.address.toLowerCase()
      ) {
        return reply(to, data)
      }
      const decoded = decodeFunctionData({ abi: multicall3Abi, data })
      if (decoded.functionName !== 'aggregate3')
        throw new Error('Expected aggregate3')
      return encodeFunctionResult({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        result: decoded.args[0].map(({ target, callData }) => ({
          success: true,
          returnData: reply(target, callData),
        })),
      })
    },
  )
  return {
    ...helpers,
    client: helpers.getPublicClient(88888),
    user,
    token,
    calls,
  }
}

describe('read-only Socios staking', () => {
  it('preserves the exact latest tuple and no-argument period ABI', () => {
    const latest = stakingJson.find(
      (item) => item.name === 'getStakeDataLatest',
    )!
    expect(latest.stateMutability).toBe('nonpayable')
    expect(latest.inputs.map((input) => input.type)).toEqual([
      'address',
      'address',
      'bool',
    ])
    expect(latest.outputs).toHaveLength(1)
    expect(latest.outputs![0].type).toBe('tuple')
    const output = latest.outputs![0]
    if (!('components' in output)) throw new Error('Expected tuple components')
    expect(output.components.map((component) => component.name)).toEqual(
      Object.keys(fixture.stakeDataLatest),
    )
    const period = stakingJson.find((item) => item.name === 'unstakePeriod')!
    expect(period.inputs).toEqual([])
    expect(period.stateMutability).toBe('view')
    const data = encodeFunctionResult({
      abi,
      functionName: 'getStakeDataLatest',
      result: zeroStake,
    })
    expect(
      decodeFunctionResult({ abi, functionName: 'getStakeDataLatest', data }),
    ).toEqual(zeroStake)
  })

  it('decodes the approved zero-stake fixture through eth_call to the proxy', async () => {
    const h = await setup()
    expect(await h.readStakeDataLatest(h.client, h.user, h.token)).toEqual({
      held: 0n,
      staked: 0n,
      unstaked: 0n,
      totalScoutRating: 0n,
      decimals: 18,
      formatted: {
        held: '0',
        staked: '0',
        unstaked: '0',
        totalScoutRating: '0',
      },
    })
    expect(h.calls).toEqual(
      expect.arrayContaining(['getStakeDataLatest', 'balanceOf', 'decimals']),
    )
  })

  it('reads the recorded period in seconds without passing token or applying decimals', async () => {
    const h = await setup()
    expect(await h.readUnstakePeriod(h.client, h.token)).toBe(604800n)
    const otherToken = h.getTokenAddress(h.FAN_TOKENS[1], 88888)!
    expect(await h.readUnstakePeriod(h.client, otherToken)).toBe(604800n)
    expect(h.calls).toEqual(['unstakePeriod', 'unstakePeriod'])
  })

  it('uses on-chain decimals and totalStake without adding locked/pending amounts (synthetic)', async () => {
    const h = await setup(6, 1234567n, {
      ...zeroStake,
      totalStake: 2000000n,
      totalLocked: 1000000n,
      totalPendingUnstake: 500000n,
    })
    const result = await h.readStakeDataLatest(h.client, h.user, h.token)
    expect(result.decimals).toBe(6)
    expect(result.staked).toBe(2000000n)
    expect(result.unstaked).toBe(1234567n)
    expect(result.totalScoutRating).toBe(3234567n)
    expect(result.formatted.totalScoutRating).toBe('3.234567')
  })

  it.each([0, 6, 18])(
    'normalises exact bigint amounts with %i decimals (synthetic)',
    async (decimals) => {
      const { normaliseStake } = await import('./index.ts')
      const held = 9007199254740993n * 10n ** BigInt(decimals)
      const result = normaliseStake(held, 0n, decimals)
      expect(result.totalScoutRating).toBe(held)
      expect(result.formatted.held).toBe('9,007,199,254,740,993')
      expect(result.unstaked).toBe(result.held)
    },
  )

  it('rejects Spicy before making any Mainnet staking calls', async () => {
    const h = await setup()
    const spicyClient = h.getPublicClient(88882)
    await expect(
      h.readStakeDataLatest(spicyClient, h.user, h.token),
    ).rejects.toThrow('Mainnet')
    await expect(h.readUnstakePeriod(spicyClient, h.token)).rejects.toThrow(
      'Mainnet',
    )
    expect(request).not.toHaveBeenCalled()
  })

  it('rejects malformed wallet and invalid token addresses before RPC', async () => {
    const h = await setup()
    await expect(
      h.readStakeDataLatest(h.client, 'invalid' as Address, h.token),
    ).rejects.toThrow('wallet')
    for (const token of ['invalid', fixture.wallet]) {
      await expect(
        h.readStakeDataLatest(h.client, h.user, token as Address),
      ).rejects.toThrow('token')
      await expect(
        h.readUnstakePeriod(h.client, token as Address),
      ).rejects.toThrow('token')
    }
    expect(request).not.toHaveBeenCalled()
  })

  it('propagates failed reads instead of fabricating zero balances or periods', async () => {
    const h = await setup()
    request.mockRejectedValue(new Error('RPC unavailable'))
    await expect(
      h.readStakeDataLatest(h.client, h.user, h.token),
    ).rejects.toThrow('RPC unavailable')
    await expect(h.readUnstakePeriod(h.client, h.token)).rejects.toThrow(
      'RPC unavailable',
    )
  })

  it('prints normalised CLI output using a local fixture RPC without storing wallet data', async () => {
    await setup()
    const server = createServer(async (incoming, response) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of incoming) chunks.push(chunk as Buffer)
        const rpc = JSON.parse(Buffer.concat(chunks).toString()) as {
          id: number
          method: string
          params: unknown[]
        }
        const result = await request(rpc)
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }))
      } catch {
        response.writeHead(500)
        response.end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('Expected RPC port')
      const url = `http://127.0.0.1:${address.port}`
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          '--experimental-strip-types',
          new URL('../scripts/read-stake.ts', import.meta.url).pathname,
          fixture.wallet,
          fixture.tokenKey,
        ],
        {
          env: {
            ...process.env,
            NEXT_PUBLIC_DATA_CHAIN_ID: '88888',
            RPC_URL_MAINNET: url,
            RPC_URL_MAINNET_FALLBACK: url,
          },
          timeout: 10000,
        },
      )
      expect(JSON.parse(stdout)).toEqual({
        chainId: 88888,
        tokenKey: 'NAVI',
        held: '0',
        staked: '0',
        unstaked: '0',
        totalScoutRating: '0',
        decimals: 18,
        formatted: {
          held: '0',
          staked: '0',
          unstaked: '0',
          totalScoutRating: '0',
        },
        unstakePeriodSeconds: '604800',
      })
      expect(request).toHaveBeenCalled()
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
