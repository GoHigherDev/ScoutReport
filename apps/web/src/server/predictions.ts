import 'server-only'
import { randomBytes } from 'node:crypto'
import { getPublicClient } from '@scoutreport/chain'
import { and, asc, eq, gt, or, sql } from 'drizzle-orm'
import { isErc6492Signature, verifyTypedData, type Hex } from 'viem'
import { z } from 'zod'
import { NAMES } from '../copy/names'
import {
  pickTypedData,
  type MyPrediction,
  type PredictMatch,
  type PredictPage,
} from '../lib/predict'
import { toStoredAddress } from './address'
import { getDatabase } from './db'
import {
  matches,
  picks,
  predictAgeConfirmations,
  predictNonces,
  predictionAudit,
  predictionPoints,
  predictTermsAcceptances,
} from './db/schema'
import { handler, HttpError, type RateLimiter } from './http'
import {
  assertPickEligibility,
  assertPredictCountry,
  lockPredictWallet,
  predictAcceptanceLimiter,
  predictReadLimiter,
  predictEligibilityStore,
  requirePredictOrigin,
  type PredictEligibilityStore,
} from './predict'
import { PREDICT_TERMS_VERSION } from './predict-config'
import { getVerifiedSession, type VerifiedSession } from './session'

type Transaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>['transaction']>[0]
>[0]
const selectionSchema = z
  .object({ matchId: z.uuid(), outcome: z.string().min(1).max(200) })
  .strict()
const pickSchema = selectionSchema.extend({
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z
    .string()
    .regex(/^0x(?:[a-fA-F0-9]{2})+$/)
    .max(8192),
})
export type SignedPick = z.infer<typeof pickSchema>
type Selection = z.infer<typeof selectionSchema>
type Cursor = { kickoff: string; id: string } | null
type VerifySignature = (
  session: VerifiedSession,
  input: SignedPick,
  origin: string,
) => Promise<boolean>

export const verifyPickSignature: VerifySignature = async (
  session,
  { matchId, outcome, nonce, signature },
  origin,
) => {
  const data = pickTypedData(origin, session.chainId, {
    matchId,
    outcome,
    nonce,
  })
  // Counterfactual signatures are not supported by this off-chain pick flow.
  if (isErc6492Signature(signature as Hex)) return false
  if (session.isContract) {
    return getPublicClient(session.chainId).verifyTypedData({
      ...data,
      address: session.address as Hex,
      signature: signature as Hex,
    })
  }
  return verifyTypedData({
    ...data,
    address: session.address as Hex,
    signature: signature as Hex,
  })
}

function toMatch(row: typeof matches.$inferSelect, now: Date): PredictMatch {
  return {
    id: row.id,
    sport: row.sport,
    homeLabel: row.homeLabel,
    awayLabel: row.awayLabel,
    kickoff: row.kickoffUtc.toISOString(),
    lockTime: row.lockAtUtc.toISOString(),
    outcomes: row.outcomes,
    pointsForCorrect: row.pointsForCorrect,
    status:
      row.status === 'open'
        ? row.lockAtUtc <= now
          ? 'locked'
          : 'upcoming'
        : row.status,
    result: row.result,
    voidReason: row.voidReason,
  }
}

function page<T extends PredictMatch>(rows: T[]): PredictPage<T> {
  const visible = rows.slice(0, 50)
  const last = visible.at(-1)
  return {
    matches: visible,
    nextCursor: rows.length > 50 && last ? `${last.kickoff},${last.id}` : null,
  }
}

function cursorCondition(cursor: Cursor) {
  if (!cursor) return undefined
  const kickoff = new Date(cursor.kickoff)
  return or(
    gt(matches.kickoffUtc, kickoff),
    and(eq(matches.kickoffUtc, kickoff), gt(matches.id, cursor.id)),
  )
}

function readCursor(request: Request): Cursor {
  const value = new URL(request.url).searchParams.get('cursor')
  if (!value) return null
  const parsed = z
    .object({ kickoff: z.iso.datetime(), id: z.uuid() })
    .safeParse(
      Object.fromEntries(
        ['kickoff', 'id'].map((key, index) => [key, value.split(',')[index]]),
      ),
    )
  if (!parsed.success || value.split(',').length !== 2)
    throw new HttpError(400, 'INVALID_REQUEST', NAMES.predict.error)
  return parsed.data
}

async function serverTime(tx: Transaction): Promise<Date> {
  const [row] = await tx.execute<{ now: Date | string }>(
    sql`SELECT clock_timestamp() AS now`,
  )
  return new Date(row.now)
}

export function assertPredictionOpen(
  match: { status: string; lockAtUtc: Date } | undefined,
  now: Date,
): asserts match is { status: string; lockAtUtc: Date } {
  if (!match || match.status !== 'open' || match.lockAtUtc <= now)
    throw new HttpError(409, 'CONFLICT', NAMES.predict.matchUnavailable)
}

async function openMatch(tx: Transaction, input: Selection) {
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, input.matchId))
    .for('update')
    .limit(1)
  assertPredictionOpen(match, await serverTime(tx))
  if (!match.outcomes.includes(input.outcome))
    throw new HttpError(400, 'INVALID_REQUEST', NAMES.predict.invalidOutcome)
  return match
}

function transactionEligibility(tx: Transaction): PredictEligibilityStore {
  return {
    ...predictEligibilityStore,
    async hasAgeConfirmation(address) {
      const rows = await tx
        .select({ address: predictAgeConfirmations.address })
        .from(predictAgeConfirmations)
        .where(eq(predictAgeConfirmations.address, address))
        .limit(1)
      return rows.length === 1
    },
    async hasTermsAcceptance(address, version) {
      const rows = await tx
        .select({ address: predictTermsAcceptances.address })
        .from(predictTermsAcceptances)
        .where(
          and(
            eq(predictTermsAcceptances.address, address),
            eq(predictTermsAcceptances.version, version),
          ),
        )
        .limit(1)
      return rows.length === 1
    },
  }
}

export interface PredictionStore {
  list(address: string, cursor: Cursor): Promise<PredictPage<PredictMatch>>
  mine(
    address: string,
    cursor: Cursor,
  ): Promise<PredictPage<MyPrediction> & { totalPoints: number }>
  issueNonce(
    input: Selection,
    session: VerifiedSession,
    request: Request,
  ): Promise<{ nonce: string; expiresAt: string }>
  submit(
    input: SignedPick,
    session: VerifiedSession,
    request: Request,
    verify: VerifySignature,
  ): Promise<{ ok: true }>
}

export const predictionStore: PredictionStore = {
  async list(address, cursor) {
    const rows = await getDatabase()
      .select({
        match: matches,
        outcome: picks.outcome,
        now: sql<string>`clock_timestamp()`,
      })
      .from(matches)
      .leftJoin(
        picks,
        and(eq(picks.matchId, matches.id), eq(picks.address, address)),
      )
      .where(cursorCondition(cursor))
      .orderBy(asc(matches.kickoffUtc), asc(matches.id))
      .limit(51)
    return page(
      rows.map(({ match, now, outcome }) => ({
        ...toMatch(match, new Date(now)),
        outcome,
      })),
    )
  },
  async mine(address, cursor) {
    const rows = await getDatabase()
      .select({
        match: matches,
        outcome: picks.outcome,
        points: sql<number>`CASE WHEN ${matches.status} = 'voided' THEN 0 ELSE coalesce(${predictionPoints.points}, 0) END`,
        now: sql<string>`clock_timestamp()`,
      })
      .from(picks)
      .innerJoin(matches, eq(matches.id, picks.matchId))
      .leftJoin(
        predictionPoints,
        and(
          eq(predictionPoints.matchId, picks.matchId),
          eq(predictionPoints.address, picks.address),
        ),
      )
      .where(and(eq(picks.address, address), cursorCondition(cursor)))
      .orderBy(asc(matches.kickoffUtc), asc(matches.id))
      .limit(51)
    const [total] = await getDatabase()
      .select({
        points: sql<number>`coalesce(sum(${predictionPoints.points}), 0)::int`,
      })
      .from(predictionPoints)
      .innerJoin(matches, eq(matches.id, predictionPoints.matchId))
      .where(
        and(
          eq(predictionPoints.address, address),
          eq(matches.status, 'settled'),
        ),
      )
    return {
      ...page(
        rows.map(({ match, now, outcome, points }) => ({
          ...toMatch(match, new Date(now)),
          outcome,
          points,
        })),
      ),
      totalPoints: total.points,
    }
  },
  async issueNonce(input, session, request) {
    return getDatabase().transaction(async (tx) => {
      await lockPredictWallet(tx, session.address)
      await openMatch(tx, input)
      await assertPickEligibility(session, request, transactionEligibility(tx))
      // Per-wallet replacement bounds outstanding challenges to one. Cleanup is
      // bounded too and uses the existing primary key, not a full-table deletion.
      await tx
        .delete(predictNonces)
        .where(eq(predictNonces.address, session.address))
      await tx.execute(sql`
        DELETE FROM predict_nonces WHERE nonce IN (
          SELECT nonce FROM predict_nonces
          WHERE expires_at <= clock_timestamp() AND address <> ${session.address}
          ORDER BY nonce LIMIT 100 FOR UPDATE SKIP LOCKED
        )
      `)
      const nonce = randomBytes(32).toString('hex')
      const [row] = await tx
        .insert(predictNonces)
        .values({
          nonce,
          address: session.address,
          expiresAt: sql`clock_timestamp() + interval '10 minutes'`,
        })
        .returning({ expiresAt: predictNonces.expiresAt })
      return { nonce, expiresAt: row.expiresAt.toISOString() }
    })
  },
  async submit(input, session, request, verify) {
    const origin = requirePredictOrigin(request)
    const db = getDatabase()
    const [preflight] = await db
      .select({ match: matches, now: sql<string>`clock_timestamp()` })
      .from(matches)
      .where(eq(matches.id, input.matchId))
      .limit(1)
    if (!preflight)
      throw new HttpError(409, 'CONFLICT', NAMES.predict.matchUnavailable)
    assertPredictionOpen(preflight.match, new Date(preflight.now))
    if (!preflight.match.outcomes.includes(input.outcome))
      throw new HttpError(400, 'INVALID_REQUEST', NAMES.predict.invalidOutcome)
    const nonce = await db
      .select({ nonce: predictNonces.nonce })
      .from(predictNonces)
      .where(
        and(
          eq(predictNonces.nonce, input.nonce),
          eq(predictNonces.address, session.address),
          gt(predictNonces.expiresAt, sql`clock_timestamp()`),
        ),
      )
      .limit(1)
    if (!nonce.length)
      throw new HttpError(409, 'CONFLICT', NAMES.predict.invalidNonce)
    // ERC-1271 verification may be slow: never hold wallet or match locks over RPC.
    let valid: boolean
    try {
      valid = await verify(session, input, origin)
    } catch {
      valid = false
    }
    if (!valid)
      throw new HttpError(
        400,
        'INVALID_REQUEST',
        NAMES.predict.invalidSignature,
      )
    return getDatabase().transaction(async (tx) => {
      await lockPredictWallet(tx, session.address)
      const match = await openMatch(tx, input)
      // Consume only after the match lock; deletion and the pick/audit roll
      // back together. Erasure also removes challenges and eligibility records.
      const consumed = await tx
        .delete(predictNonces)
        .where(
          and(
            eq(predictNonces.nonce, input.nonce),
            eq(predictNonces.address, session.address),
            gt(predictNonces.expiresAt, sql`clock_timestamp()`),
          ),
        )
        .returning({ nonce: predictNonces.nonce })
      if (!consumed.length)
        throw new HttpError(409, 'CONFLICT', NAMES.predict.invalidNonce)
      await assertPickEligibility(session, request, transactionEligibility(tx))
      const now = await serverTime(tx)
      assertPredictionOpen(match, now)
      const values = {
        matchId: input.matchId,
        address: session.address,
        outcome: input.outcome,
        signature: input.signature,
      }
      await tx
        .insert(picks)
        .values({ ...values, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [picks.matchId, picks.address],
          set: {
            outcome: input.outcome,
            signature: input.signature,
            updatedAt: now,
          },
        })
      await tx.insert(predictionAudit).values({ ...values, createdAt: now })
      return { ok: true as const }
    })
  },
}

type RouteOptions = {
  store?: PredictionStore
  eligibilityStore?: PredictEligibilityStore
  rateLimiter?: RateLimiter
  readRateLimiter?: RateLimiter
  verifySignature?: VerifySignature
}

export function createPredictionRoutes(options: RouteOptions = {}) {
  const store = options.store ?? predictionStore
  const eligibility = options.eligibilityStore ?? predictEligibilityStore
  async function session(request: Request) {
    const value = await getVerifiedSession(request)
    if (!value)
      throw new HttpError(401, 'UNAUTHORISED', NAMES.predict.sessionRequired)
    return { ...value, address: toStoredAddress(value.address) }
  }
  const limited = (write = false) => ({
    auth: true,
    rateLimiter: write
      ? (options.rateLimiter ?? predictAcceptanceLimiter)
      : (options.readRateLimiter ?? predictReadLimiter),
    rateLimitKey: async (request: Request) => {
      const value = await session(request)
      if (write) {
        requirePredictOrigin(request)
        assertPredictCountry(request)
      }
      return value.address
    },
  })
  return {
    list: handler(limited(), async (_, request) =>
      store.list((await session(request)).address, readCursor(request)),
    ),
    mine: handler(limited(), async (_, request) =>
      store.mine((await session(request)).address, readCursor(request)),
    ),
    eligibility: handler(limited(), async (_, request) => {
      const value = await session(request)
      let countryAllowed = true
      try {
        assertPredictCountry(request)
      } catch (error) {
        if (!(error instanceof HttpError)) throw error
        countryAllowed = false
      }
      return {
        address: value.address,
        chainId: value.chainId,
        countryAllowed,
        ageConfirmed:
          countryAllowed &&
          (await eligibility.hasAgeConfirmation(value.address)),
        termsAccepted:
          countryAllowed &&
          (await eligibility.hasTermsAcceptance(
            value.address,
            PREDICT_TERMS_VERSION,
          )),
        termsVersion: PREDICT_TERMS_VERSION,
      }
    }),
    nonce: handler(
      { ...limited(true), schema: selectionSchema, maxBodyBytes: 1024 },
      async (input, request) => {
        const value = await session(request)
        await assertPickEligibility(value, request, eligibility)
        return store.issueNonce(input, value, request)
      },
    ),
    pick: handler(
      { ...limited(true), schema: pickSchema, maxBodyBytes: 12_288 },
      async (input, request) => {
        const value = await session(request)
        await assertPickEligibility(value, request, eligibility)
        return store.submit(
          input,
          value,
          request,
          options.verifySignature ?? verifyPickSignature,
        )
      },
    ),
  }
}

export const predictionRoutes = createPredictionRoutes()
