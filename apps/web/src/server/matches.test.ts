// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import predictionsAbi from '../../../../packages/chain/abis/ScoutReportPredictions.json'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import type { AdminMatch } from '../lib/admin-matches'
import { getDatabase } from './db'
import { adminAuditLog, matches } from './db/schema'
import {
  createMatchRoutes as buildMatchRoutes,
  type MatchStore,
} from './matches'
import type { VerifiedSession } from './session'

vi.mock('server-only', () => ({}))
vi.mock('@scoutreport/chain', async () => {
  const { FAN_TOKENS } =
    await vi.importActual<typeof import('@scoutreport/chain')>(
      '@scoutreport/chain',
    )
  const { default: abi } =
    await import('../../../../packages/chain/abis/ScoutReportPredictions.json')
  return {
    FAN_TOKENS,
    SCOUTREPORT_ABIS: [abi],
    getAppChain: vi.fn(() => ({ id: 88882 })),
    getPredictionsAddress: vi.fn(() => undefined),
    getPublicClient: vi.fn(() => {
      throw new Error('No live RPC')
    }),
  }
})
vi.mock('./db', () => ({
  getDatabase: vi.fn(() => {
    throw new Error('No live database')
  }),
}))

const abi = predictionsAbi as Abi
function createMatchRoutes(
  dependencies: Parameters<typeof buildMatchRoutes>[0] = {},
) {
  return buildMatchRoutes({
    rateLimiter: { consume: () => ({ allowed: true, retryAfter: 0 }) },
    ...dependencies,
  })
}
const actor = '0x00000000000000000000000000000000000000ab'
const address: Address = '0x00000000000000000000000000000000000000cd'
const txHash: Hex = `0x${'1'.repeat(64)}`
const blockHash: Hex = `0x${'2'.repeat(64)}`
const matchId: Hex = keccak256(
  toBytes('scoutreport:00000000-0000-4000-8000-000000000001'),
)
const match: AdminMatch = {
  id: '00000000-0000-4000-8000-000000000001',
  matchId,
  sport: 'football',
  sides: [
    { name: 'Arsenal', tokenKey: 'AFC' },
    { name: 'Other', tokenKey: null },
  ],
  kickoff: '2026-07-10T19:00:00.000Z',
  lockTime: '2026-07-10T19:00:00.000Z',
  outcomes: ['Home', 'Away'],
  pointsForCorrect: 12,
}
const input = {
  sport: match.sport,
  sides: match.sides,
  kickoff: '2026-07-10T20:00',
  outcomes: match.outcomes,
  pointsForCorrect: match.pointsForCorrect,
}
const session: VerifiedSession = {
  address: actor,
  chainId: 88882,
  isContract: false,
  issuedAt: Date.now(),
}
const request = (
  method: string,
  body?: unknown,
  origin = 'https://scoutreport.test',
) =>
  new Request('https://scoutreport.test/api/admin/matches', {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

let store: MatchStore
let getSession: ReturnType<typeof vi.fn<() => Promise<VerifiedSession | null>>>
beforeEach(() => {
  vi.stubEnv('ADMIN_ADDRESSES', actor)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://scoutreport.test')
  store = {
    list: vi.fn(async () => [match]),
    find: vi.fn(async () => match),
    create: vi.fn(async () => {}),
    audit: vi.fn(async () => {}),
  }
  getSession = vi.fn(async () => session)
})
afterEach(() => vi.unstubAllEnvs())

function setupAudit(
  action: 'createMatch' | 'settle' | 'voidMatch' | 'creditPoints' = 'settle',
) {
  const lockTime = BigInt(Date.parse(match.lockTime) / 1000)
  const args = {
    createMatch: [matchId, lockTime, 2, 12],
    settle: [matchId, 1],
    voidMatch: [matchId],
    creditPoints: [matchId, 5n],
  }[action]
  const eventName = {
    createMatch: 'MatchCreated',
    settle: 'MatchSettled',
    voidMatch: 'MatchVoided',
    creditPoints: 'PointsCredited',
  }[action]
  const data = {
    createMatch: encodeAbiParameters(
      [{ type: 'uint64' }, { type: 'uint8' }, { type: 'uint32' }],
      [lockTime, 2, 12],
    ),
    settle: encodeAbiParameters([{ type: 'uint8' }], [1]),
    voidMatch: '0x' as Hex,
    creditPoints: encodeAbiParameters(
      [{ type: 'uint32' }, { type: 'uint32' }],
      [0, 5],
    ),
  }[action]
  const transaction = {
    hash: txHash,
    chainId: 88882,
    blockHash,
    from: actor,
    to: address,
    value: 0n,
    input: encodeFunctionData({ abi, functionName: action, args }),
  }
  const receipt = {
    transactionHash: txHash,
    status: 'success',
    from: actor,
    to: address,
    blockHash,
    blockNumber: 5n,
    logs: [
      {
        address,
        data,
        topics: encodeEventTopics({ abi, eventName, args: { matchId } }),
      },
    ],
  }
  const state = {
    lockTime,
    outcomeCount: 2,
    pointsForCorrect: 12,
    status: action === 'voidMatch' ? 3 : action === 'createMatch' ? 1 : 2,
    result: 1,
  }
  const client = {
    getChainId: vi.fn(async () => 88882),
    getTransaction: vi.fn(async () => transaction),
    getTransactionReceipt: vi.fn(async () => receipt),
    readContract: vi.fn(async () => state),
  }
  const getClient = vi.fn(() => client)
  const routes = createMatchRoutes({
    store,
    getSession,
    predictionsAddress: () => address,
    getClient: getClient as unknown as NonNullable<
      Parameters<typeof createMatchRoutes>[0]
    >['getClient'],
  })
  return {
    action,
    transaction,
    receipt,
    state,
    client,
    getClient,
    routes,
    body: { matchId, txHash, action },
  }
}

describe('admin match metadata', () => {
  it('lists authorised match metadata', async () => {
    const response = await createMatchRoutes({ store, getSession }).GET(
      request('GET'),
    )
    expect(await response.json()).toEqual({ matches: [match] })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
  it('looks up older metadata by match ID without using the latest-100 list', async () => {
    const id = '00000000-0000-4000-8000-000000000002'
    const olderMatch = {
      ...match,
      id,
      matchId: keccak256(toBytes(`scoutreport:${id}`)),
    }
    vi.mocked(store.find).mockResolvedValueOnce(olderMatch)
    const response = await createMatchRoutes({ store, getSession }).GET(
      new Request(
        `https://scoutreport.test/api/admin/matches?matchId=0x${olderMatch.matchId.slice(2).toUpperCase()}`,
      ),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ matches: [olderMatch] })
    expect(store.find).toHaveBeenCalledWith(olderMatch.matchId)
    expect(store.list).not.toHaveBeenCalled()
  })
  it('returns the same empty-list DTO when a match ID is not found', async () => {
    vi.mocked(store.find).mockResolvedValueOnce(undefined)
    const response = await createMatchRoutes({ store, getSession }).GET(
      new Request(
        `https://scoutreport.test/api/admin/matches?matchId=${matchId}`,
      ),
    )
    expect(await response.json()).toEqual({ matches: [] })
    expect(store.list).not.toHaveBeenCalled()
  })
  it.each(['', 'not-a-hash', '0x1234', `0x${'g'.repeat(64)}`])(
    'rejects malformed lookup ID %s before database access',
    async (value) => {
      const response = await createMatchRoutes({ store, getSession }).GET(
        new Request(
          `https://scoutreport.test/api/admin/matches?matchId=${value}`,
        ),
      )
      expect(response.status).toBe(400)
      expect(store.find).not.toHaveBeenCalled()
      expect(store.list).not.toHaveBeenCalled()
    },
  )
  it.each([null, { ...session, address }])(
    'authenticates lookup queries before database access or ID validation',
    async (value) => {
      getSession.mockResolvedValue(value)
      const routes = createMatchRoutes({ store, getSession })
      for (const id of [matchId, 'invalid']) {
        const response = await routes.GET(
          new Request(
            `https://scoutreport.test/api/admin/matches?matchId=${id}`,
          ),
        )
        expect(response.status).toBe(value ? 403 : 401)
      }
      expect(store.find).not.toHaveBeenCalled()
      expect(store.list).not.toHaveBeenCalled()
    },
  )
  it('generates the UUID hash and UTC timestamps and supplies a single atomic create', async () => {
    const response = await createMatchRoutes({ store, getSession }).POST(
      request('POST', input),
    )
    expect(response.status).toBe(200)
    const { match: created } = (await response.json()) as { match: AdminMatch }
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.matchId).toBe(
      keccak256(toBytes(`scoutreport:${created.id}`)),
    )
    expect(created.lockTime).toBe(match.lockTime)
    expect(created.kickoff).toBe(match.kickoff)
    expect(store.create).toHaveBeenCalledWith(created, {
      actorAddress: actor,
      action: 'matches.metadata.create',
      payload: { matchId: created.matchId, txHash: null },
    })
  })
  it('requires supplied points and rejects late lock time', async () => {
    const routes = createMatchRoutes({ store, getSession })
    for (const change of [
      { pointsForCorrect: undefined },
      { lockTime: '2026-07-10T20:01' },
    ]) {
      expect(
        (await routes.POST(request('POST', { ...input, ...change }))).status,
      ).toBe(400)
    }
    expect(store.create).not.toHaveBeenCalled()
  })
  it.each([null, { ...session, address }])(
    'rejects unauthorised callers before any storage or RPC',
    async (value) => {
      getSession.mockResolvedValue(value)
      const { routes, getClient, body } = setupAudit()
      expect((await routes.GET(request('GET'))).status).toBe(value ? 403 : 401)
      expect((await routes.POST(request('POST', input))).status).toBe(
        value ? 403 : 401,
      )
      expect((await routes.audit(request('POST', body))).status).toBe(
        value ? 403 : 401,
      )
      expect(store.list).not.toHaveBeenCalled()
      expect(store.find).not.toHaveBeenCalled()
      expect(store.create).not.toHaveBeenCalled()
      expect(getClient).not.toHaveBeenCalled()
    },
  )
  it('normalises the verified actor, and does not trust arbitrary Host or missing Origin', async () => {
    getSession.mockResolvedValue({
      ...session,
      address: '0x00000000000000000000000000000000000000AB',
    })
    const routes = createMatchRoutes({ store, getSession })
    expect((await routes.POST(request('POST', input))).status).toBe(200)
    expect(store.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorAddress: actor }),
    )
    for (const origin of ['https://attacker.test', 'null', '']) {
      expect((await routes.POST(request('POST', input, origin))).status).toBe(
        400,
      )
    }
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect((await routes.POST(request('POST', input))).status).toBe(400)
    expect(store.create).toHaveBeenCalledTimes(1)
  })
  it('uses injected handler rate limits', async () => {
    const routes = createMatchRoutes({
      store,
      getSession,
      rateLimiter: { consume: () => ({ allowed: false, retryAfter: 15 }) },
    })
    const response = await routes.GET(request('GET'))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('15')
    expect(store.list).not.toHaveBeenCalled()
  })
})

describe('receipt-verified audits', () => {
  it('does not acknowledge the receipt status when audit persistence fails', async () => {
    const { routes, body } = setupAudit()
    vi.mocked(store.audit).mockRejectedValueOnce(
      new Error('Audit write failed'),
    )
    const response = await routes.audit(request('POST', body))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
  })
  it.each(['createMatch', 'settle', 'voidMatch', 'creditPoints'] as const)(
    'records authentic %s calldata and event',
    async (action) => {
      const { routes, body, getClient, client } = setupAudit(action)
      const response = await routes.audit(request('PUT', body))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        ok: true,
        receiptStatus: 'success',
      })
      expect(getClient).toHaveBeenCalledWith(88882)
      expect(client.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ address, blockNumber: 5n }),
      )
      expect(store.audit).toHaveBeenCalledWith({
        actorAddress: actor,
        action: `matches.${action}`,
        payload: expect.objectContaining({
          matchId,
          txHash,
          chainId: 88882,
          receiptStatus: 'success',
          ...(action === 'settle' ? { result: 1 } : {}),
          ...(action === 'creditPoints'
            ? { from: 0, to: 5, maxCount: '5', result: 1 }
            : {}),
        }),
      })
    },
  )
  it.each(['createMatch', 'settle', 'voidMatch', 'creditPoints'] as const)(
    'records a verified reverted %s attempt without requiring events or state',
    async (action) => {
      const { routes, body, receipt, client } = setupAudit(action)
      receipt.status = 'reverted'
      receipt.logs = []
      client.readContract.mockRejectedValueOnce(
        new Error('Reverted creation has no state'),
      )
      const response = await routes.audit(request('POST', body))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        ok: true,
        receiptStatus: 'reverted',
      })
      expect(client.readContract).not.toHaveBeenCalled()
      expect(store.audit).toHaveBeenCalledWith({
        actorAddress: actor,
        action: `matches.${action}`,
        payload: {
          matchId,
          txHash,
          chainId: 88882,
          receiptStatus: 'reverted',
          ...(action === 'settle' ? { result: 1 } : {}),
          ...(action === 'creditPoints' ? { maxCount: '5' } : {}),
        },
      })
    },
  )
  it.each(['foreignSender', 'wrongDestination', 'wrongAction', 'wrongMatch'])(
    'still rejects reverted attempts with %s',
    async (scenario) => {
      const { routes, body, receipt, transaction } = setupAudit()
      receipt.status = 'reverted'
      receipt.logs = []
      if (scenario === 'foreignSender') transaction.from = address
      if (scenario === 'wrongDestination') transaction.to = actor
      if (scenario === 'wrongAction') body.action = 'voidMatch'
      if (scenario === 'wrongMatch')
        transaction.input = encodeFunctionData({
          abi,
          functionName: 'settle',
          args: [txHash, 1],
        })
      expect((await routes.audit(request('POST', body))).status).toBe(400)
      expect(store.audit).not.toHaveBeenCalled()
    },
  )
  it('fails closed without the approved address or on Mainnet before database/RPC access', async () => {
    const { getClient, body } = setupAudit()
    for (const dependencies of [
      { predictionsAddress: () => undefined },
      {
        predictionsAddress: () => address,
        appChain: (() => ({ id: 88888 })) as NonNullable<
          Parameters<typeof createMatchRoutes>[0]
        >['appChain'],
      },
    ]) {
      const routes = createMatchRoutes({
        store,
        getSession,
        ...dependencies,
        getClient: getClient as unknown as NonNullable<
          Parameters<typeof createMatchRoutes>[0]
        >['getClient'],
      })
      expect((await routes.audit(request('POST', body))).status).toBe(400)
    }
    expect(store.find).not.toHaveBeenCalled()
    expect(getClient).not.toHaveBeenCalled()
  })
  it.each([
    'unknownReceiptStatus',
    'foreignSender',
    'wrongDestination',
    'mainnetTransaction',
    'mainnetRpc',
    'noEvent',
    'foreignEvent',
    'wrongEvent',
    'wrongAction',
    'wrongMatch',
    'badResult',
    'badConfig',
    'wrongHash',
    'wrongBlock',
    'nonCanonical',
  ])('rejects %s without writing audit', async (scenario) => {
    const { routes, body, transaction, receipt, state, client } = setupAudit()
    if (scenario === 'unknownReceiptStatus') receipt.status = 'pending'
    if (scenario === 'foreignSender') transaction.from = address
    if (scenario === 'wrongDestination') transaction.to = actor
    if (scenario === 'mainnetTransaction') transaction.chainId = 88888
    if (scenario === 'mainnetRpc') client.getChainId.mockResolvedValue(88888)
    if (scenario === 'noEvent') receipt.logs = []
    if (scenario === 'foreignEvent') receipt.logs[0].address = actor
    if (scenario === 'wrongEvent')
      receipt.logs[0].data = encodeAbiParameters([{ type: 'uint8' }], [0])
    if (scenario === 'wrongAction') body.action = 'voidMatch'
    if (scenario === 'wrongMatch')
      transaction.input = encodeFunctionData({
        abi,
        functionName: 'settle',
        args: [txHash, 1],
      })
    if (scenario === 'badResult')
      transaction.input = encodeFunctionData({
        abi,
        functionName: 'settle',
        args: [matchId, 2],
      })
    if (scenario === 'badConfig') state.pointsForCorrect = 13
    if (scenario === 'wrongHash') receipt.transactionHash = blockHash
    if (scenario === 'wrongBlock') transaction.blockHash = txHash
    if (scenario === 'nonCanonical')
      transaction.input = `${transaction.input}00`
    expect((await routes.audit(request('POST', body))).status).toBe(400)
    expect(store.audit).not.toHaveBeenCalled()
  })
  it('rejects mismatched creation configuration and unbounded batch events', async () => {
    const create = setupAudit('createMatch')
    create.transaction.input = encodeFunctionData({
      abi,
      functionName: 'createMatch',
      args: [matchId, BigInt(Date.parse(match.lockTime) / 1000), 2, 13],
    })
    expect(
      (await create.routes.audit(request('POST', create.body))).status,
    ).toBe(400)
    const credit = setupAudit('creditPoints')
    credit.receipt.logs[0].data = encodeAbiParameters(
      [{ type: 'uint32' }, { type: 'uint32' }],
      [0, 6],
    )
    expect(
      (await credit.routes.audit(request('POST', credit.body))).status,
    ).toBe(400)
    expect(store.audit).not.toHaveBeenCalled()
  })
  it('rejects missing metadata and RPC errors without audit', async () => {
    const { routes, body, client } = setupAudit()
    vi.mocked(store.find).mockResolvedValueOnce(undefined)
    expect((await routes.audit(request('POST', body))).status).toBe(400)
    expect(client.getTransaction).not.toHaveBeenCalled()
    client.getTransactionReceipt.mockRejectedValueOnce(
      new Error('RPC unavailable'),
    )
    expect((await routes.audit(request('POST', body))).status).toBe(400)
    expect(store.audit).not.toHaveBeenCalled()
  })
})

describe('match persistence constraints', () => {
  it('lists only the latest 100 database rows and serialises UTC dates', async () => {
    const limit = vi.fn(async () => [
      {
        ...match,
        kickoff: new Date(match.kickoff),
        lockTime: new Date(match.lockTime),
        createdAt: new Date(),
      },
    ])
    const orderBy = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ orderBy }))
    vi.mocked(getDatabase).mockReturnValue({
      select: vi.fn(() => ({ from })),
    } as unknown as ReturnType<typeof getDatabase>)
    const response = await createMatchRoutes({ getSession }).GET(request('GET'))
    expect(await response.json()).toEqual({ matches: [match] })
    expect(from).toHaveBeenCalledWith(matches)
    expect(orderBy).toHaveBeenCalledWith(
      expect.objectContaining({ queryChunks: expect.any(Array) }),
      expect.objectContaining({ queryChunks: expect.any(Array) }),
    )
    expect(limit).toHaveBeenCalledWith(100)
  })
  it('inserts metadata and its audit in one database transaction and propagates audit failure', async () => {
    const metadataValues = vi.fn(async () => {})
    const auditValues = vi.fn(async () => {})
    const insert = vi.fn((table) => ({
      values: table === matches ? metadataValues : auditValues,
    }))
    const transaction = vi.fn(
      async (run: (tx: { insert: typeof insert }) => Promise<void>) =>
        run({ insert }),
    )
    vi.mocked(getDatabase).mockReturnValue({
      transaction,
    } as unknown as ReturnType<typeof getDatabase>)
    const routes = createMatchRoutes({ getSession })
    expect((await routes.POST(request('POST', input))).status).toBe(200)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls.map(([table]) => table)).toEqual([
      matches,
      adminAuditLog,
    ])
    expect(metadataValues).toHaveBeenCalledWith(
      expect.objectContaining({
        kickoff: new Date(match.kickoff),
        lockTime: new Date(match.lockTime),
      }),
    )
    auditValues.mockRejectedValueOnce(new Error('Audit write failed'))
    expect((await routes.POST(request('POST', input))).status).toBe(500)
    expect(transaction).toHaveBeenCalledTimes(2)
  })
  it('handles repeated verified audits using database conflict suppression', async () => {
    const { body, getClient } = setupAudit()
    const onConflictDoNothing = vi.fn(async () => {})
    const values = vi.fn(() => ({ onConflictDoNothing }))
    const insert = vi.fn(() => ({ values }))
    vi.mocked(getDatabase).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                ...match,
                kickoff: new Date(match.kickoff),
                lockTime: new Date(match.lockTime),
                createdAt: new Date(),
              },
            ],
          }),
        }),
      }),
      insert,
    } as unknown as ReturnType<typeof getDatabase>)
    const routes = createMatchRoutes({
      getSession,
      predictionsAddress: () => address,
      getClient: getClient as unknown as NonNullable<
        Parameters<typeof createMatchRoutes>[0]
      >['getClient'],
    })
    expect((await routes.audit(request('POST', body))).status).toBe(200)
    expect((await routes.audit(request('POST', body))).status).toBe(200)
    expect(insert).toHaveBeenCalledWith(adminAuditLog)
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2)
  })
  it('stores timezone-aware match dates and constrained metadata', () => {
    expect(matches.id.primary).toBe(true)
    expect(matches.matchId.isUnique).toBe(true)
    expect(matches.kickoff.getSQLType()).toBe('timestamp with time zone')
    expect(matches.lockTime.getSQLType()).toBe('timestamp with time zone')
    expect(matches.pointsForCorrect.default).toBeUndefined()
    expect(getTableConfig(matches).checks.map((check) => check.name)).toEqual([
      'matches_match_id',
      'matches_sport',
      'matches_lock_time',
      'matches_points',
      'matches_sides',
      'matches_outcomes',
    ])
  })
  it('deduplicates chain/action/hash audits with a database unique index', () => {
    const [index] = getTableConfig(adminAuditLog).indexes
    expect(index.config.unique).toBe(true)
    expect(index.config.columns).toHaveLength(3)
    expect(new PgDialect().sqlToQuery(index.config.where!).sql).toContain(
      'matches.creditPoints',
    )
  })
})
