// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { AdminMatch } from '../lib/admin-matches'
import { getDatabase } from './db'
import { createMatchRoutes, scoreMatch, type MatchStore } from './matches'
import { HttpError } from './http'
import type { VerifiedSession } from './session'

vi.mock('server-only', () => ({}))
vi.mock('./db', () => ({
  getDatabase: vi.fn(() => {
    throw new Error('Unexpected database access')
  }),
}))

const actor = '0x00000000000000000000000000000000000000ab'
const id = '00000000-0000-4000-8000-000000000001'
const session: VerifiedSession = {
  address: actor,
  chainId: 88882,
  isContract: false,
  issuedAt: Date.now(),
}
const match: AdminMatch = {
  id,
  sport: 'football',
  sides: [
    { name: 'Arsenal', tokenKey: 'AFC' },
    { name: 'Other', tokenKey: null },
  ],
  kickoff: '2020-07-10T19:00:00.000Z',
  lockTime: '2020-07-10T19:00:00.000Z',
  outcomes: ['HOME', 'DRAW', 'AWAY'],
  pointsForCorrect: 12,
  externalRef: null,
  status: 'open',
  result: null,
  voidReason: null,
  locked: true,
}
const input = {
  sport: 'football',
  sides: match.sides,
  kickoff: '2020-07-10T20:00',
  outcomes: match.outcomes,
  pointsForCorrect: 12,
}
const request = (method: string, body?: unknown, url = '/api/admin/matches') =>
  new Request(`https://scoutreport.test${url}`, {
    method,
    headers: {
      Origin: 'https://scoutreport.test',
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

function createMemoryStore(initial = match) {
  let current = { ...initial }
  const picks = [
    { outcome: 'HOME', updatedAt: new Date('2020-07-10T18:59:00Z') },
    { outcome: 'HOME', updatedAt: new Date('2020-07-10T19:00:00Z') },
    { outcome: 'AWAY', updatedAt: new Date('2020-07-10T18:00:00Z') },
  ]
  let points: number[] = []
  const audits: {
    action: string
    before: unknown
    after: unknown
    score?: { creditedCount: number; totalPoints: number }
  }[] = []
  const calculate = () => {
    points =
      current.status === 'settled'
        ? picks
            .filter(
              (pick) =>
                pick.outcome === current.result &&
                new Date(current.lockTime).getTime() > pick.updatedAt.getTime(),
            )
            .map(() => current.pointsForCorrect)
        : []
    return {
      creditedCount: points.length,
      totalPoints: points.reduce((total, value) => total + value, 0),
    }
  }
  const store: MatchStore = {
    list: vi.fn(async () => [current]),
    find: vi.fn(async () => current),
    create: vi.fn(async (changes, actorAddress) => {
      const before = null
      current = {
        ...match,
        ...changes,
        id,
        status: 'open',
        result: null,
        voidReason: null,
        locked: false,
      }
      audits.push({ action: 'matches.create', before, after: current })
      expect(actorAddress).toBe(actor)
      return current
    }),
    edit: vi.fn(async (_id, changes, actorAddress) => {
      const before = current
      current = { ...current, ...changes }
      audits.push({ action: 'matches.edit', before, after: current })
      expect(actorAddress).toBe(actor)
      return current
    }),
    settle: vi.fn(async (_id, result, actorAddress) => {
      const before = current
      if (current.status !== 'open') {
        throw new HttpError(409, 'CONFLICT', 'Only open matches can settle')
      }
      if (Date.now() < new Date(current.lockTime).getTime()) {
        throw new HttpError(409, 'CONFLICT', 'Match is not locked')
      }
      current = { ...current, status: 'settled', result, locked: true }
      const score = calculate()
      audits.push({ action: 'matches.settle', before, after: current, score })
      expect(actorAddress).toBe(actor)
      return score
    }),
    void: vi.fn(async (_id, reason, actorAddress) => {
      const before = current
      if (current.status !== 'open') {
        throw new HttpError(409, 'CONFLICT', 'Only open matches can be voided')
      }
      current = {
        ...current,
        status: 'voided',
        result: null,
        voidReason: reason,
      }
      const score = calculate()
      audits.push({ action: 'matches.void', before, after: current, score })
      expect(actorAddress).toBe(actor)
      return score
    }),
    credit: vi.fn(async (_id, actorAddress) => {
      if (current.status === 'open') {
        throw new HttpError(409, 'CONFLICT', 'Match cannot be recalculated')
      }
      const score = calculate()
      audits.push({
        action: 'matches.credit',
        before: current,
        after: current,
        score,
      })
      expect(actorAddress).toBe(actor)
      return score
    }),
  }
  return { store, audits, getCurrent: () => current, getPoints: () => points }
}

let store: ReturnType<typeof createMemoryStore>
const getSession = vi.fn(
  async (request: Request): Promise<VerifiedSession | null> =>
    request.headers.get('x-test-anonymous') ? null : session,
)
function routes() {
  return createMatchRoutes({
    store: store.store,
    getSession,
    rateLimiter: { consume: () => ({ allowed: true, retryAfter: 0 }) },
  })
}

function mockScoringDatabase(status: 'open' | 'settled' | 'voided') {
  const timestamp = new Date('2020-07-10T19:00:00.000Z')
  const row = {
    id,
    sport: 'football',
    homeLabel: 'Arsenal',
    awayLabel: 'Other',
    homeTokenKey: 'AFC',
    awayTokenKey: null,
    externalRef: null,
    kickoffUtc: timestamp,
    lockAtUtc: timestamp,
    outcomes: ['HOME', 'DRAW', 'AWAY'],
    pointsForCorrect: 12,
    status,
    result: status === 'settled' ? 'HOME' : null,
    voidReason: status === 'voided' ? 'Postponed' : null,
    createdBy: actor,
    createdAt: timestamp,
    updatedAt: timestamp,
    settledAt: status === 'settled' ? timestamp : null,
    settledBy: status === 'settled' ? actor : null,
    voidedAt: status === 'voided' ? timestamp : null,
    voidedBy: status === 'voided' ? actor : null,
  }
  const matchLimit = vi.fn(async () => [row])
  const matchForUpdate = vi.fn(() => ({ limit: matchLimit }))
  const matchWhere = vi.fn(() => ({ for: matchForUpdate }))
  const matchFrom = vi.fn(() => ({ where: matchWhere }))
  const totalsWhere = vi.fn(async () => [{ creditedCount: 1, totalPoints: 12 }])
  const pointsFrom = vi.fn(() => ({ where: totalsWhere }))
  const execute = vi.fn(async (query: unknown) => {
    expect(query).toBeDefined()
    return []
  })
  const transaction = {
    select: vi.fn((projection?: unknown) => ({
      from: projection ? pointsFrom : matchFrom,
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    execute,
  }
  const database = {
    transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  }
  vi.mocked(getDatabase).mockReturnValue(
    database as unknown as ReturnType<typeof getDatabase>,
  )
  return { transaction, database, execute }
}

afterEach(() => vi.unstubAllEnvs())

beforeEach(() => {
  getSession.mockReset()
  getSession.mockResolvedValue(session)
  vi.stubEnv('ADMIN_ADDRESSES', actor)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://scoutreport.test')
  store = createMemoryStore()
})

describe('off-chain admin match routes', () => {
  it('creates matches in the database model without chain identifiers', async () => {
    const response = await routes().POST(request('POST', input))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.match).toMatchObject({
      id,
      status: 'open',
      kickoff: match.kickoff,
      lockTime: match.lockTime,
    })
    expect(body.match).not.toHaveProperty('matchId')
    expect(store.audits).toMatchObject([
      { action: 'matches.create', before: null, after: { id } },
    ])
  })

  it('requires verified SIWE and the admin allowlist before any database call', async () => {
    for (const value of [
      null,
      { ...session, address: '0x00000000000000000000000000000000000000cd' },
    ]) {
      getSession.mockResolvedValue(value)
      const response = await routes().GET(request('GET'))
      expect(response.status).toBe(value ? 403 : 401)
      expect(
        (await routes().PATCH(request('PATCH', { action: 'credit', id })))
          .status,
      ).toBe(value ? 403 : 401)
    }
    vi.stubEnv('ADMIN_ADDRESSES', '')
    getSession.mockResolvedValue(session)
    expect((await routes().POST(request('POST', input))).status).toBe(403)
    expect(
      (await routes().PATCH(request('PATCH', { action: 'credit', id }))).status,
    ).toBe(403)
    expect(store.store.list).not.toHaveBeenCalled()
    expect(store.store.create).not.toHaveBeenCalled()
    expect(store.store.credit).not.toHaveBeenCalled()
  })

  it('settles after lock and scores only correct picks updated before lock', async () => {
    const response = await routes().PATCH(
      request('PATCH', { action: 'settle', id, result: 'HOME' }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      score: { creditedCount: 1, totalPoints: 12 },
    })
    expect(store.getPoints()).toEqual([12])
    expect(store.audits.at(-1)).toMatchObject({
      action: 'matches.settle',
      before: { status: 'open' },
      after: { status: 'settled', result: 'HOME' },
    })
  })

  it('rejects settlement before lock', async () => {
    store = createMemoryStore({
      ...match,
      kickoff: '2099-07-10T19:00:00.000Z',
      lockTime: '2099-07-10T19:00:00.000Z',
      locked: false,
    })
    expect(
      (
        await routes().PATCH(
          request('PATCH', { action: 'settle', id, result: 'HOME' }),
        )
      ).status,
    ).toBe(409)
  })

  it('recalculates settled points idempotently on repeated credit actions', async () => {
    store = createMemoryStore({
      ...match,
      status: 'settled',
      result: 'HOME',
    })
    const body = { action: 'credit', id }
    const first = await routes().PATCH(request('PATCH', body))
    const firstResult = await first.json()
    const second = await routes().PATCH(request('PATCH', body))
    expect(await second.json()).toEqual(firstResult)
    expect(store.getPoints()).toEqual([12])
    expect(store.audits.map(({ action }) => action)).toEqual([
      'matches.credit',
      'matches.credit',
    ])
  })

  it('locks and replaces scored rows, excluding late picks in the SQL scoring query', async () => {
    const database = mockScoringDatabase('settled')
    const first = await scoreMatch(id)
    const second = await scoreMatch(id)
    expect(first).toEqual({
      creditedCount: 1,
      totalPoints: 12,
    })
    expect(second).toEqual(first)
    expect(database.database.transaction).toHaveBeenCalledTimes(2)
    expect(database.transaction.select).toHaveBeenCalledTimes(4)
    expect(database.transaction.delete).toHaveBeenCalledTimes(2)
    expect(database.execute).toHaveBeenCalledTimes(2)
    const query = database.execute.mock.calls[0][0]
    const sqlText = new PgDialect().sqlToQuery(query as never).sql
    expect(sqlText).toContain('p.updated_at < m.lock_at_utc')
    expect(sqlText).toContain('p.outcome = m.result')
    expect(sqlText).toContain("date_trunc('week'")
    expect(sqlText).toContain("'Europe/London'")
  })

  it.each(['open', 'voided'] as const)(
    'deletes prior totals without inserting points for %s matches',
    async (status) => {
      const database = mockScoringDatabase(status)
      await scoreMatch(id)
      expect(database.transaction.delete).toHaveBeenCalledOnce()
      expect(database.execute).not.toHaveBeenCalled()
    },
  )

  it('voids only open matches and recalculates them to zero points', async () => {
    store = createMemoryStore({
      ...match,
      status: 'settled',
      result: 'HOME',
    })
    expect(
      (
        await routes().PATCH(
          request('PATCH', { action: 'void', id, reason: 'Postponed' }),
        )
      ).status,
    ).toBe(409)

    store = createMemoryStore()
    const response = await routes().PATCH(
      request('PATCH', { action: 'void', id, reason: 'Postponed' }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      score: { creditedCount: 0, totalPoints: 0 },
    })
    expect(store.getPoints()).toEqual([])
    expect(store.audits.at(-1)).toMatchObject({
      action: 'matches.void',
      before: { status: 'open' },
      after: { status: 'voided', voidReason: 'Postponed' },
    })
  })

  it('rejects a second settlement after the result is final', async () => {
    store = createMemoryStore({
      ...match,
      status: 'settled',
      result: 'HOME',
    })
    const response = await routes().PATCH(
      request('PATCH', { action: 'settle', id, result: 'AWAY' }),
    )
    expect(response.status).toBe(409)
  })

  it('writes before/after audit records for edits and rejects invalid origins', async () => {
    const edit = {
      action: 'edit',
      id,
      changes: { ...input, kickoff: '2020-07-10T20:00' },
    }
    expect((await routes().PATCH(request('PATCH', edit))).status).toBe(200)
    expect(store.audits.at(-1)).toMatchObject({
      action: 'matches.edit',
      before: { id },
      after: { id },
    })
    expect(
      (
        await routes().POST(
          new Request('https://scoutreport.test/api/admin/matches', {
            method: 'POST',
            headers: { Origin: 'https://attacker.test' },
            body: JSON.stringify(input),
          }),
        )
      ).status,
    ).toBe(400)
  })
})
