import {
  custom,
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionResult,
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  multicall3Abi,
  type Abi,
  type Address,
  type Hex,
  toHex,
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import stakingJson from '../abis/staking.json'
import fixture from './fixtures/staking.json'
import pendingFixture from './fixtures/pending-unstakes.json'
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

const setup = async (
  decimals = 18,
  held = 0n,
  stake = zeroStake,
  allTokens = false,
  failedRead?: string,
  user = fixture.wallet as Address,
) => {
  const helpers = await import('./index.ts')
  const token = helpers.getTokenAddress(helpers.FAN_TOKENS[0], 88888)!
  const allowedTokens = (
    allTokens ? helpers.FAN_TOKENS : helpers.FAN_TOKENS.slice(0, 1)
  ).map((item) => helpers.getTokenAddress(item, 88888)!.toLowerCase())
  const calls: string[] = []
  const reply = (to: Address, data: Hex): Hex => {
    const proxy = to.toLowerCase() === helpers.STAKING_ADDRESS
    const decoded = decodeFunctionData({ abi: proxy ? abi : erc20Abi, data })
    calls.push(decoded.functionName)
    if (proxy) {
      if (decoded.functionName === 'getStakeDataLatest') {
        expect(decoded.args?.[0]).toBe(user)
        expect(allowedTokens).toContain(
          (decoded.args?.[1] as string).toLowerCase(),
        )
        expect(decoded.args?.[2]).toBe(false)
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
    expect(allowedTokens).toContain(to.toLowerCase())
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
        result: decoded.args[0].map(({ target, callData }) => {
          const proxy = target.toLowerCase() === helpers.STAKING_ADDRESS
          const call = decodeFunctionData({
            abi: proxy ? abi : erc20Abi,
            data: callData,
          })
          const tokenAddress = proxy ? (call.args?.[1] as string) : target
          if (
            call.functionName === failedRead &&
            tokenAddress?.toLowerCase() === allowedTokens[1]
          ) {
            return { success: false, returnData: '0x' as Hex }
          }
          return { success: true, returnData: reply(target, callData) }
        }),
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
      pendingAmount: 0n,
      decimals: 18,
      formatted: {
        held: '0',
        staked: '0',
        unstaked: '0',
        totalScoutRating: '0',
        pendingAmount: '0',
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

  it('batches stake refreshes and liquid balances into read-only multicalls (synthetic)', async () => {
    const h = await setup(6, 1234567n, { ...zeroStake, totalStake: 2000000n })
    const results = await h.readStakeDataLatestBatch(h.client, h.user, [
      h.token,
      h.token,
    ])
    expect(results).toHaveLength(2)
    expect(results[0].formatted).toMatchObject({
      held: '1.234567',
      staked: '2',
      totalScoutRating: '3.234567',
    })
    expect(results[1]).toEqual(results[0])
    expect(request).toHaveBeenCalledTimes(1)
    for (const [rpc] of request.mock.calls) {
      expect(rpc.method).toBe('eth_call')
      expect(rpc.params[0].to.toLowerCase()).toBe(
        h.chiliz.contracts.multicall3.address.toLowerCase(),
      )
    }
    const decoded = decodeFunctionData({
      abi: multicall3Abi,
      data: request.mock.calls[0][0].params[0].data,
    })
    if (decoded.functionName !== 'aggregate3')
      throw new Error('Expected aggregate3')
    expect(decoded.args[0]).toHaveLength(7)
  })

  it('reads the whole configured portfolio with fewer RPC requests than tokens (synthetic)', async () => {
    const h = await setup(6, 1n, zeroStake, true)
    const tokens = h.FAN_TOKENS.map((token) => h.getTokenAddress(token, 88888)!)
    const results = await h.readStakeDataLatestBatch(h.client, h.user, tokens)
    expect(results).toHaveLength(tokens.length)
    expect(
      results.every((result) => result.formatted.held === '0.000001'),
    ).toBe(true)
    expect(request.mock.calls.length).toBeLessThan(tokens.length)
    for (const [rpc] of request.mock.calls) {
      expect(rpc.method).toBe('eth_call')
      expect(rpc.params[0].to.toLowerCase()).toBe(
        h.chiliz.contracts.multicall3.address.toLowerCase(),
      )
    }
    expect(
      h.calls.filter((name) => name === 'getStakeDataLatest'),
    ).toHaveLength(tokens.length)
    expect(h.calls.filter((name) => name === 'balanceOf')).toHaveLength(
      tokens.length,
    )
  })

  it('skips empty batches and rejects invalid batch reads without RPC', async () => {
    const h = await setup()
    expect(await h.readStakeDataLatestBatch(h.client, h.user, [])).toEqual([])
    await expect(
      h.readStakeDataLatestBatch(h.getPublicClient(88882), h.user, [h.token]),
    ).rejects.toThrow('Mainnet')
    await expect(
      h.readStakeDataLatestBatch(h.client, 'invalid' as Address, [h.token]),
    ).rejects.toThrow('wallet')
    await expect(
      h.readStakeDataLatestBatch(h.client, h.user, ['invalid' as Address]),
    ).rejects.toThrow('token')
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['getStakeDataLatest', 'balanceOf', 'decimals'])(
    'isolates a failed %s read and reads metadata once per token (synthetic)',
    async (failedRead) => {
      const h = await setup(
        6,
        1234567n,
        { ...zeroStake, totalStake: 2000000n },
        true,
        failedRead,
      )
      const tokens = h.FAN_TOKENS.slice(0, 2).map((token) =>
        h.getTokenAddress(token, 88888)!,
      )
      const results = await h.readStakeDataLatestBatch(
        h.client,
        h.user,
        tokens,
        {
          allowFailure: true,
          blockNumber: 38378088n,
        },
      )
      expect(results[1]).toEqual({ status: 'failure' })
      expect(results[0].status).toBe('success')
      if (results[0].status !== 'success')
        throw new Error('Expected available data')
      expect(results[0].formatted).toMatchObject({
        held: '1.234567',
        staked: '2',
        unstaked: '1.234567',
        totalScoutRating: '3.234567',
      })
      expect(results[0].meta.decimals).toBe(6)
      expect(h.calls.filter((name) => name === 'decimals')).toHaveLength(
        failedRead === 'decimals' ? 1 : 2,
      )
      expect(
        request.mock.calls.some(
          ([rpc]) => rpc.params[1] === `0x${38378088n.toString(16)}`,
        ),
      ).toBe(true)
      await expect(
        h.readStakeDataLatestBatch(h.client, h.user, tokens),
      ).rejects.toThrow()
    },
  )

  it('propagates batch RPC errors rather than returning fabricated zero holdings', async () => {
    const h = await setup()
    request.mockRejectedValue(new Error('RPC unavailable'))
    await expect(
      h.readStakeDataLatestBatch(h.client, h.user, [h.token]),
    ).rejects.toThrow('RPC unavailable')
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
        pendingAmount: '0',
        decimals: 18,
        formatted: {
          held: '0',
          staked: '0',
          unstaked: '0',
          totalScoutRating: '0',
          pendingAmount: '0',
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

describe('pending unstake event reads (offline)', () => {
  const sample = pendingFixture.samples[0]
  const amount = BigInt(sample.amount) * 10n ** BigInt(pendingFixture.decimals)
  const snapshot = 38378088n

  async function pendingSetup(
    selected = sample,
    pendingAmount = BigInt(selected.amount) * 10n ** 18n,
  ) {
    const h = await setup(
      pendingFixture.decimals,
      0n,
      { ...zeroStake, totalPendingUnstake: pendingAmount },
      true,
      undefined,
      getAddress(selected.staker),
    )
    const token = h.getTokenAddress(
      h.FAN_TOKENS.find((token) => token.key === 'AFC')!,
      88888,
    )!
    return { ...h, token }
  }

  function log(
    token: Address,
    staker: Address,
    eventName: 'Unstake' | 'Claim',
    amount: bigint,
    blockNumber: bigint,
    releaseAt = BigInt(sample.claimableAt),
    logIndex = 0n,
  ) {
    return {
      address: '0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501',
      topics: encodeEventTopics({ abi, eventName, args: { staker, token } }),
      data:
        eventName === 'Unstake'
          ? encodeAbiParameters(
              [{ type: 'uint256' }, { type: 'uint256' }],
              [amount, releaseAt],
            )
          : encodeAbiParameters([{ type: 'uint256' }], [amount]),
      blockNumber: toHex(blockNumber),
      logIndex: toHex(logIndex),
      removed: false,
    }
  }

  function mockLogs(logs: ReturnType<typeof log>[], fail = false) {
    const ethCall = request.getMockImplementation()!
    request.mockImplementation((rpc) => {
      if (rpc.method !== 'eth_getLogs') return ethCall(rpc)
      if (fail) throw new Error('Log read unavailable')
      const filter = rpc.params[0]
      return logs.filter(
        (item) =>
          BigInt(item.blockNumber) >= BigInt(filter.fromBlock) &&
          BigInt(item.blockNumber) <= BigInt(filter.toBlock),
      )
    })
  }

  it.each(pendingFixture.samples)(
    'reconciles the recorded $amount AFC pending-only sample',
    async (selected) => {
      const pendingAmount = BigInt(selected.amount) * 10n ** 18n
      const h = await pendingSetup(selected)
      mockLogs([
        log(
          h.token,
          h.user,
          'Unstake',
          pendingAmount,
          BigInt(selected.blockNumber),
          BigInt(selected.claimableAt),
        ),
      ])
      const [stake] = await h.readStakeDataLatestBatch(
        h.client,
        h.user,
        [h.token],
        { blockNumber: snapshot },
      )
      expect(stake).toMatchObject({
        held: 0n,
        staked: 0n,
        pendingAmount,
        totalScoutRating: 0n,
      })
      const [cooldown] = await h.readPendingUnstakesBatch(
        h.client,
        h.user,
        [{ token: h.token, pendingAmount: stake.pendingAmount }],
        snapshot,
      )
      expect(cooldown).toEqual({
        pendingAmount,
        releaseAt: BigInt(selected.claimableAt),
        unstakePeriodSeconds: 604800n,
        pendingOperationCount: 1,
      })
      const filters = request.mock.calls
        .filter(([rpc]) => rpc.method === 'eth_getLogs')
        .map(([rpc]) => rpc.params[0])
      expect(filters).toHaveLength(2)
      expect(BigInt(filters[0].fromBlock)).toBe(snapshot - 403200n)
      expect(BigInt(filters[1].toBlock)).toBe(snapshot)
      expect(BigInt(filters[1].fromBlock)).toBe(BigInt(filters[0].toBlock) + 1n)
      for (const filter of filters) {
        expect(
          BigInt(filter.toBlock) - BigInt(filter.fromBlock) + 1n,
        ).toBeLessThanOrEqual(250000n)
        expect(filter.address).toBe(h.STAKING_ADDRESS)
        expect(filter.topics).toEqual([
          [
            encodeEventTopics({ abi, eventName: 'Unstake' })[0],
            encodeEventTopics({ abi, eventName: 'Claim' })[0],
          ],
          encodeEventTopics({
            abi,
            eventName: 'Unstake',
            args: { staker: h.user },
          })[1],
          [
            encodeEventTopics({
              abi,
              eventName: 'Unstake',
              args: { token: h.token },
            })[2],
          ],
        ])
      }
    },
  )

  it.each(['mismatch', 'failed logs', 'missing earlier unstake'] as const)(
    'keeps pending amounts but no release for %s',
    async (failure) => {
      const h = await pendingSetup()
      mockLogs(
        [
          log(
            h.token,
            h.user,
            failure === 'missing earlier unstake' ? 'Claim' : 'Unstake',
            amount - 1n,
            snapshot,
          ),
        ],
        failure === 'failed logs',
      )
      expect(
        await h.readPendingUnstakesBatch(
          h.client,
          h.user,
          [{ token: h.token, pendingAmount: amount }],
          snapshot,
        ),
      ).toEqual([
        {
          pendingAmount: amount,
          releaseAt: null,
          unstakePeriodSeconds: 604800n,
          pendingOperationCount: 0,
        },
      ])
    },
  )

  it('subtracts claims, orders releases and counts remaining operations (synthetic)', async () => {
    const h = await pendingSetup()
    const early = BigInt(sample.claimableAt)
    mockLogs([
      log(h.token, h.user, 'Unstake', 100n, snapshot - 3n, early + 100n),
      log(h.token, h.user, 'Unstake', 200n, snapshot - 2n, early),
      log(h.token, h.user, 'Claim', 50n, snapshot - 1n),
    ])
    expect(
      await h.readPendingUnstakesBatch(
        h.client,
        h.user,
        [{ token: h.token, pendingAmount: 250n }],
        snapshot,
      ),
    ).toEqual([
      {
        pendingAmount: 250n,
        releaseAt: early,
        unstakePeriodSeconds: 604800n,
        pendingOperationCount: 2,
      },
    ])
  })

  it('does not request logs for zero pending and bounds a short chain to genesis', async () => {
    const h = await pendingSetup()
    mockLogs([])
    await h.readPendingUnstakesBatch(
      h.client,
      h.user,
      [{ token: h.token, pendingAmount: 0n }],
      snapshot,
    )
    expect(request.mock.calls.every(([rpc]) => rpc.method === 'eth_call')).toBe(
      true,
    )
    expect(
      await h.readPendingUnstakesBatch(h.client, h.user, [], snapshot),
    ).toEqual([])
    request.mockClear()
    await h.readPendingUnstakesBatch(
      h.client,
      h.user,
      [{ token: h.token, pendingAmount: amount }],
      123n,
    )
    const filters = request.mock.calls.filter(
      ([rpc]) => rpc.method === 'eth_getLogs',
    )
    expect(filters).toHaveLength(1)
    expect(filters[0][0].params[0]).toMatchObject({
      fromBlock: '0x0',
      toBlock: '0x7b',
    })
  })

  it('keeps an event-derived release when the contract-wide default read fails', async () => {
    const h = await pendingSetup()
    mockLogs([log(h.token, h.user, 'Unstake', amount, snapshot)])
    const reply = request.getMockImplementation()!
    request.mockImplementation((rpc) => {
      if (rpc.method === 'eth_call') throw new Error('Period unavailable')
      return reply(rpc)
    })
    const [cooldown] = await h.readPendingUnstakesBatch(
      h.client,
      h.user,
      [{ token: h.token, pendingAmount: amount }],
      snapshot,
    )
    expect(cooldown.releaseAt).toBe(BigInt(sample.claimableAt))
    expect(cooldown.unstakePeriodSeconds).toBeNull()
  })
})
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
