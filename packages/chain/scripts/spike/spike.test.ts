import { createHash } from 'node:crypto'
import {
  custom,
  createPublicClient,
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  keccak256,
  toBytes,
  toEventSelector,
  type Abi,
  type Hex,
} from 'viem'
import { describe, expect, it, vi } from 'vitest'
import stakingJson from '../../abis/staking.json'
import surveyJson from '../../abis/survey3.json'
import { chiliz } from '../../src/chains.ts'
import { STAKING_ADDRESS } from '../../src/staking.ts'
import { probeWallets } from './all.ts'
import { runCapture } from './common.ts'
import { matchAnswers, probePolls, VOTE_TOPIC } from './polls.ts'
import { probeStaking } from './staking.ts'

const stakingAbi = stakingJson as Abi
const surveyAbi = surveyJson as Abi
const tuple = {
  totalStake: 2_000_000n,
  totalUnstakable: 2_000_000n,
  totalLocked: 0n,
  totalLockedFlexible: 0n,
  totalClaimable: 0n,
  totalPendingUnstake: 600_000_000n,
  totalExemptFromCooldownPeriod: 0n,
  totalLockedPerEventType: [],
}
const answers = [
  { id: 'offline-fixture', text: 'Test only', totalVotes: 1n, totalTokens: 1n },
]
const hash = keccak256(toBytes(answers[0].id))

const setup = (chainId = '0x15b38', failQuestion = false) => {
  const methods: string[] = []
  const calls: string[] = []
  const request = vi.fn(
    async ({ method, params }: { method: string; params?: unknown[] }) => {
      methods.push(method)
      switch (method) {
        case 'eth_chainId':
          return chainId
        case 'eth_blockNumber':
          return '0x249972b'
        case 'eth_getBlockByNumber':
          return { number: '0x249972b', timestamp: '0x1', hash }
        case 'eth_getCode':
          expect(params?.[1]).toBe('0x249972b')
          return '0x6000'
        case 'eth_getLogs': {
          const filter = params?.[0] as {
            fromBlock: Hex
            toBlock: Hex
            topics?: Hex[]
          }
          expect(
            BigInt(filter.toBlock) - BigInt(filter.fromBlock),
          ).toBeLessThan(50_000n)
          expect(BigInt(filter.fromBlock)).toBeGreaterThanOrEqual(0n)
          if (filter.topics?.length) expect(filter.topics).toEqual([VOTE_TOPIC])
          return []
        }
        case 'eth_call': {
          const { to, data } = params?.[0] as { to: string; data: Hex }
          expect(params?.[1]).toBe('0x249972b')
          const abi =
            to.toLowerCase() === STAKING_ADDRESS
              ? stakingAbi
              : to.toLowerCase().startsWith('0xc145') ||
                  to.toLowerCase().startsWith('0x51f5')
                ? surveyAbi
                : erc20Abi
          const decoded = decodeFunctionData({ abi, data })
          const name = decoded.functionName
          calls.push(name)
          const entry = abi.find(
            (item) => item.type === 'function' && item.name === name,
          )
          expect(
            entry?.type === 'function' &&
              (entry.stateMutability === 'view' ||
                ['getStakeDataLatest', 'getClaimableStake'].includes(name)),
          ).toBe(true)
          if (failQuestion && name === 'question')
            throw new Error('private RPC URL')
          const result =
            name === 'decimals'
              ? 6
              : name === 'getStakeDataLatest' || name === 'getStakeData'
                ? tuple
                : name === 'getAnswers'
                  ? answers
                  : name === 'getUserAnswers'
                    ? [hash]
                    : name === 'getUserVoteByAnswer'
                      ? [0n, 1n, 1n]
                      : name === 'getAnswer'
                        ? answers[0]
                        : name === 'question' ||
                            name === 'questionId' ||
                            name === 'getAnswerIdsByIndex'
                          ? 'offline-fixture'
                          : name === 'getState' ||
                              name === 'isBinding' ||
                              name === 'whitelistEnabled'
                            ? true
                            : 2_000_000n
          return encodeFunctionResult({ abi, functionName: name, result })
        }
        default:
          throw new Error(`Unexpected RPC method: ${method}`)
      }
    },
  )
  const client = createPublicClient({
    chain: chiliz,
    transport: custom({ request }, { retryCount: 0 }),
  })
  return { client, request, methods, calls }
}

describe('SR-50 read-only research capture', () => {
  it('preserves the exact supplied ABI array and Vote signature', () => {
    expect(
      createHash('sha256').update(JSON.stringify(surveyJson)).digest('hex'),
    ).toBe('bc02c7f5f37891a55520aa63c16e72e0daf06871fa81002b0cc2e003bc026cdd')
    expect(toEventSelector('Vote(address,address,string,uint256)')).toBe(
      VOTE_TOPIC,
    )
    const event = surveyJson.find(
      (entry) => entry.type === 'event' && entry.name === 'Vote',
    )
    expect(
      event?.inputs.every((input) => 'indexed' in input && !input.indexed),
    ).toBe(true)
  })

  it('collects pending fields, polls and code hashes using only read RPC methods', async () => {
    const { client, methods, calls } = setup()
    const result = await runCapture(client, [
      probeStaking,
      probePolls,
      probeWallets,
    ])
    expect(result.blocked).toBeNull()
    expect(
      Object.entries(result.reads).filter(
        ([, read]) => (read as { status: string }).status !== 'ok',
      ),
    ).toEqual([])
    expect(new Set(methods)).toEqual(
      new Set([
        'eth_chainId',
        'eth_blockNumber',
        'eth_getBlockByNumber',
        'eth_call',
        'eth_getLogs',
        'eth_getCode',
      ]),
    )
    expect(calls).toContain('getClaimableStake')
    expect(calls).toContain('getUserVoteByAnswer')
    const normalised = Object.entries(result.reads).find(([key]) =>
      key.endsWith('.normalised'),
    )
    expect(normalised?.[1]).toMatchObject({
      value: { decimals: 6, formatted: { staked: '2' } },
    })
    const latest = Object.entries(result.reads).find(([key]) =>
      key.endsWith('.getStakeDataLatest.true'),
    )
    expect(latest?.[1]).toMatchObject({
      value: { totalPendingUnstake: 600_000_000n },
    })
    const wallet = Object.entries(result.reads).find(([key]) =>
      key.startsWith('wallet.'),
    )
    expect(wallet?.[1]).toMatchObject({
      value: {
        hasCode: true,
        codeHash: keccak256('0x6000'),
        sociosWallet: 'UNKNOWN',
      },
    })
  })

  it('fails closed on the wrong network or an unavailable RPC', async () => {
    const { client, methods } = setup('0x15b32')
    const probe = vi.fn()
    expect((await runCapture(client, [probe])).blocked).not.toBeNull()
    expect(methods).toEqual(['eth_chainId'])
    expect(probe).not.toHaveBeenCalled()
    const offline = setup()
    offline.request.mockRejectedValue(new Error('credential-bearing URL'))
    const result = await runCapture(offline.client, [probe])
    expect(result.blocked).not.toBeNull()
    expect(JSON.stringify(result)).not.toContain('credential-bearing')
  })

  it('records failed reads as UNKNOWN and continues independent probes', async () => {
    const { client } = setup(undefined, true)
    const result = await runCapture(client, [probePolls, probeWallets])
    expect(result.reads).toHaveProperty(
      'poll.0xc145fea14431b05f4048e13ef679079b6ff38747.question',
      { status: 'failed', value: 'UNKNOWN' },
    )
    expect(
      Object.keys(result.reads).some((key) => key.startsWith('wallet.')),
    ).toBe(true)
  })

  it('matches keccak256 answer IDs and leaves unknown hashes unmatched', () => {
    const unknown = keccak256(toBytes('unknown-fixture'))
    expect(matchAnswers(answers, [hash, unknown])).toEqual([
      { hash, answer: answers[0] },
      { hash: unknown, answer: null },
    ])
  })
})
