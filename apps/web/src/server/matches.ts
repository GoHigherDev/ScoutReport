import 'server-only'
import { randomUUID } from 'node:crypto'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  londonToUtc,
  matchInputSchema,
  type AdminMatch,
} from '../lib/admin-matches'
import { SEASON_ID } from '../lib/admin-match-constants'
import { requireAdmin } from './admin'
import { toStoredAddress } from './address'
import { getDatabase } from './db'
import { adminAuditLog, matches, picks, predictionPoints } from './db/schema'
import { handler, HttpError, type RateLimiter } from './http'
import { getVerifiedSession } from './session'

type AuditRow = typeof adminAuditLog.$inferInsert
type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>['transaction']>[0]
>[0]

type ScoreTotals = { creditedCount: number; totalPoints: number }
type MatchChanges = {
  sport: 'football' | 'cs2'
  sides: { name: string; tokenKey: string | null }[]
  kickoff: string
  lockTime: string
  outcomes: string[]
  pointsForCorrect: number
  externalRef: string | null
}
export interface MatchStore {
  list(): Promise<AdminMatch[]>
  find(id: string): Promise<AdminMatch | undefined>
  create(input: MatchChanges, actor: string): Promise<AdminMatch>
  edit(id: string, input: MatchChanges, actor: string): Promise<AdminMatch>
  settle(id: string, result: string, actor: string): Promise<ScoreTotals>
  void(id: string, reason: string, actor: string): Promise<ScoreTotals>
  credit(id: string, actor: string): Promise<ScoreTotals>
}

function toMatch(row: typeof matches.$inferSelect): AdminMatch {
  return {
    id: row.id,
    sport: row.sport,
    sides: [
      { name: row.homeLabel, tokenKey: row.homeTokenKey },
      { name: row.awayLabel, tokenKey: row.awayTokenKey },
    ],
    kickoff: row.kickoffUtc.toISOString(),
    lockTime: row.lockAtUtc.toISOString(),
    outcomes: row.outcomes,
    pointsForCorrect: row.pointsForCorrect,
    externalRef: row.externalRef,
    status: row.status,
    result: row.result,
    voidReason: row.voidReason,
    locked: row.status === 'open' && row.lockAtUtc.getTime() <= Date.now(),
  }
}

function auditSnapshot(row: typeof matches.$inferSelect) {
  return {
    ...toMatch(row),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    settledBy: row.settledBy,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedBy: row.voidedBy,
  }
}

function changesFromInput(
  input: z.infer<typeof matchInputSchema>,
): MatchChanges {
  return {
    sport: input.sport,
    sides: input.sides,
    kickoff: londonToUtc(input.kickoff),
    lockTime: londonToUtc(input.lockTime ?? input.kickoff),
    outcomes: input.outcomes,
    pointsForCorrect: input.pointsForCorrect,
    externalRef: input.externalRef ?? null,
  }
}

function rowValues(input: MatchChanges) {
  return {
    sport: input.sport,
    homeLabel: input.sides[0].name,
    awayLabel: input.sides[1].name,
    homeTokenKey: input.sides[0].tokenKey,
    awayTokenKey: input.sides[1].tokenKey,
    kickoffUtc: new Date(input.kickoff),
    lockAtUtc: new Date(input.lockTime),
    outcomes: input.outcomes,
    pointsForCorrect: input.pointsForCorrect,
    externalRef: input.externalRef,
  }
}

function assertOpen(row: typeof matches.$inferSelect) {
  if (row.status !== 'open') {
    throw new HttpError(409, 'CONFLICT', 'Only open matches can be changed')
  }
}

async function lockedMatch(transaction: DbTransaction, id: string) {
  const [row] = await transaction
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .for('update')
    .limit(1)
  if (!row) throw new HttpError(404, 'INVALID_REQUEST', 'Match not found')
  return row
}

async function appendAudit(transaction: DbTransaction, audit: AuditRow) {
  await transaction.insert(adminAuditLog).values(audit)
}

async function scoreMatchInTransaction(
  transaction: DbTransaction,
  id: string,
): Promise<ScoreTotals> {
  const match = await lockedMatch(transaction, id)
  await transaction
    .delete(predictionPoints)
    .where(eq(predictionPoints.matchId, id))

  if (match.status === 'settled') {
    await transaction.execute(sql`
      INSERT INTO prediction_points
        (match_id, address, points, week_start_utc, season_id, credited_at)
      SELECT
        p.match_id,
        p.address,
        m.points_for_correct,
        date_trunc('week', m.lock_at_utc AT TIME ZONE 'Europe/London')
          AT TIME ZONE 'Europe/London',
        ${SEASON_ID},
        now()
      FROM picks p
      JOIN matches m ON m.id = p.match_id
      WHERE m.id = ${id}::uuid
        AND m.status = 'settled'
        AND p.outcome = m.result
        AND p.updated_at < m.lock_at_utc
    `)
  }

  const [totals] = await transaction
    .select({
      creditedCount: sql<number>`count(*)::int`,
      totalPoints: sql<number>`coalesce(sum(${predictionPoints.points}), 0)::int`,
    })
    .from(predictionPoints)
    .where(eq(predictionPoints.matchId, id))
  return totals
}

export async function scoreMatch(
  id: string,
  transaction?: DbTransaction,
): Promise<ScoreTotals> {
  if (transaction) return scoreMatchInTransaction(transaction, id)
  return getDatabase().transaction((transaction) =>
    scoreMatchInTransaction(transaction, id),
  )
}

const matchStore: MatchStore = {
  async list() {
    const rows = await getDatabase()
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt), desc(matches.id))
      .limit(100)
    return rows.map(toMatch)
  },
  async find(id) {
    const [row] = await getDatabase()
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1)
    return row ? toMatch(row) : undefined
  },
  async create(input, actor) {
    const id = randomUUID()
    const [row] = await getDatabase().transaction(async (transaction) => {
      const values = rowValues(input)
      const [created] = await transaction
        .insert(matches)
        .values({ id, ...values, createdBy: actor })
        .returning()
      await appendAudit(transaction, {
        actorAddress: actor,
        action: 'matches.create',
        payload: { before: null, after: auditSnapshot(created) },
      })
      return [created]
    })
    return toMatch(row)
  },
  async edit(id, input, actor) {
    return getDatabase().transaction(async (transaction) => {
      const before = await lockedMatch(transaction, id)
      assertOpen(before)
      if (before.lockAtUtc.getTime() <= Date.now()) {
        throw new HttpError(409, 'CONFLICT', 'Locked matches cannot be edited')
      }
      const hasPicks = await transaction
        .select({ id: picks.matchId })
        .from(picks)
        .where(eq(picks.matchId, id))
        .limit(1)
      if (
        hasPicks.length > 0 &&
        JSON.stringify(before.outcomes) !== JSON.stringify(input.outcomes)
      ) {
        throw new HttpError(
          409,
          'CONFLICT',
          'Outcomes cannot change after picks',
        )
      }
      const [after] = await transaction
        .update(matches)
        .set({ ...rowValues(input), updatedAt: new Date() })
        .where(eq(matches.id, id))
        .returning()
      await appendAudit(transaction, {
        actorAddress: actor,
        action: 'matches.edit',
        payload: {
          before: auditSnapshot(before),
          after: auditSnapshot(after),
        },
      })
      return toMatch(after)
    })
  },
  async settle(id, result, actor) {
    return getDatabase().transaction(async (transaction) => {
      const before = await lockedMatch(transaction, id)
      assertOpen(before)
      if (before.lockAtUtc.getTime() > Date.now()) {
        throw new HttpError(
          409,
          'CONFLICT',
          'A match cannot settle before lock',
        )
      }
      if (!before.outcomes.includes(result)) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Invalid match result')
      }
      const now = new Date()
      const [after] = await transaction
        .update(matches)
        .set({
          status: 'settled',
          result,
          settledAt: now,
          settledBy: actor,
          updatedAt: now,
        })
        .where(eq(matches.id, id))
        .returning()
      const score = await scoreMatch(id, transaction)
      await appendAudit(transaction, {
        actorAddress: actor,
        action: 'matches.settle',
        payload: {
          before: auditSnapshot(before),
          after: auditSnapshot(after),
          score,
        },
      })
      return score
    })
  },
  async void(id, reason, actor) {
    return getDatabase().transaction(async (transaction) => {
      const before = await lockedMatch(transaction, id)
      assertOpen(before)
      const now = new Date()
      const [after] = await transaction
        .update(matches)
        .set({
          status: 'voided',
          voidReason: reason,
          voidedAt: now,
          voidedBy: actor,
          updatedAt: now,
        })
        .where(eq(matches.id, id))
        .returning()
      const score = await scoreMatch(id, transaction)
      await appendAudit(transaction, {
        actorAddress: actor,
        action: 'matches.void',
        payload: {
          before: auditSnapshot(before),
          after: auditSnapshot(after),
          score,
        },
      })
      return score
    })
  },
  async credit(id, actor) {
    return getDatabase().transaction(async (transaction) => {
      const before = await lockedMatch(transaction, id)
      if (before.status === 'open') {
        throw new HttpError(
          409,
          'CONFLICT',
          'Only settled or voided matches recalculate',
        )
      }
      const score = await scoreMatch(id, transaction)
      const after = auditSnapshot(before)
      await appendAudit(transaction, {
        actorAddress: actor,
        action: 'matches.credit',
        payload: { before: after, after, score },
      })
      return score
    })
  },
}

const idSchema = z.string().uuid()
const createSchema = matchInputSchema
const actionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('edit'),
      id: idSchema,
      changes: matchInputSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('settle'),
      id: idSchema,
      result: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal('void'),
      id: idSchema,
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ action: z.literal('credit'), id: idSchema }).strict(),
])

type Dependencies = {
  store?: MatchStore
  getSession?: typeof getVerifiedSession
  rateLimiter?: RateLimiter
  rateLimitKey?: (request: Request) => string | Promise<string>
}

const assertOrigin = (request: Request) => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (!configured) throw new HttpError(400, 'INVALID_REQUEST', 'Invalid origin')
  let origin: string
  try {
    const url = new URL(configured)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (configured !== url.origin && configured !== `${url.origin}/`) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
      throw new Error()
    }
    origin = url.origin
  } catch {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid origin')
  }
  if (request.headers.get('Origin') !== origin) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Invalid origin')
  }
}

export function createMatchRoutes(dependencies: Dependencies = {}) {
  const store = dependencies.store ?? matchStore
  const authenticate = async (request: Request) => {
    const session = await (dependencies.getSession ?? getVerifiedSession)(
      request,
    )
    requireAdmin(session)
    return toStoredAddress(session!.address)
  }
  const options = {
    auth: true,
    rateLimiter: dependencies.rateLimiter,
    rateLimitKey: dependencies.rateLimitKey,
  }
  return {
    GET: handler(options, async (_, request) => {
      await authenticate(request)
      const id = new URL(request.url).searchParams.get('id')
      if (id !== null) {
        const parsed = idSchema.safeParse(id)
        if (!parsed.success) {
          throw new HttpError(400, 'INVALID_REQUEST', 'Invalid match ID')
        }
        const match = await store.find(parsed.data)
        return { matches: match ? [match] : [] }
      }
      return { matches: await store.list() }
    }),
    POST: handler(
      { ...options, schema: createSchema, maxBodyBytes: 16_384 },
      async (input, request) => {
        const actor = await authenticate(request)
        assertOrigin(request)
        return { match: await store.create(changesFromInput(input), actor) }
      },
    ),
    PATCH: handler(
      { ...options, schema: actionSchema, maxBodyBytes: 16_384 },
      async (input, request) => {
        const actor = await authenticate(request)
        assertOrigin(request)
        let score: ScoreTotals | undefined
        let match: AdminMatch | undefined
        if (input.action === 'edit') {
          match = await store.edit(
            input.id,
            changesFromInput(input.changes),
            actor,
          )
        } else if (input.action === 'settle') {
          score = await store.settle(input.id, input.result, actor)
        } else if (input.action === 'void') {
          score = await store.void(input.id, input.reason, actor)
        } else {
          score = await store.credit(input.id, actor)
        }
        return { ...(match ? { match } : {}), ...(score ? { score } : {}) }
      },
    ),
  }
}

export async function getPredictionPointsTotals() {
  const database = getDatabase()
  const [seasonTotals, weeklyTotals] = await Promise.all([
    database
      .select({
        address: predictionPoints.address,
        seasonId: predictionPoints.seasonId,
        points: sql<number>`sum(${predictionPoints.points})::int`,
      })
      .from(predictionPoints)
      .groupBy(predictionPoints.address, predictionPoints.seasonId),
    database
      .select({
        address: predictionPoints.address,
        weekStartUtc: predictionPoints.weekStartUtc,
        seasonId: predictionPoints.seasonId,
        points: sql<number>`sum(${predictionPoints.points})::int`,
      })
      .from(predictionPoints)
      .groupBy(
        predictionPoints.address,
        predictionPoints.weekStartUtc,
        predictionPoints.seasonId,
      ),
  ])
  return { seasonTotals, weeklyTotals }
}
