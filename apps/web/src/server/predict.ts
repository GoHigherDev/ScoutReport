import 'server-only'
import { createHmac } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { NAMES } from '../copy/names'
import { addressSchema, toStoredAddress } from './address'
import { getDatabase } from './db'
import { predictAgeConfirmations, predictTermsAcceptances } from './db/schema'
import { handler, HttpError, type RateLimiter } from './http'
import {
  blockedPredictCountries,
  PREDICT_TERMS_VERSION,
  trustedPredictCountry,
} from './predict-config'
import { getVerifiedSession, type VerifiedSession } from './session'

type CountryCheck = {
  country: string | null
  countryCheck: 'allowed' | 'unknown'
}
export interface PredictEligibilityStore {
  hasAgeConfirmation(address: string): Promise<boolean>
  hasTermsAcceptance(address: string, version: string): Promise<boolean>
  confirmAge(address: string): Promise<void>
  acceptTerms(
    address: string,
    version: string,
    check: CountryCheck,
  ): Promise<void>
}

export const predictEligibilityStore: PredictEligibilityStore = {
  async hasAgeConfirmation(address) {
    const rows = await getDatabase()
      .select({ address: predictAgeConfirmations.address })
      .from(predictAgeConfirmations)
      .where(eq(predictAgeConfirmations.address, address))
      .limit(1)
    return rows.length === 1
  },
  async hasTermsAcceptance(address, version) {
    const rows = await getDatabase()
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
  async confirmAge(address) {
    await getDatabase()
      .insert(predictAgeConfirmations)
      .values({ address })
      .onConflictDoNothing()
  },
  async acceptTerms(address, version, check) {
    await getDatabase()
      .insert(predictTermsAcceptances)
      .values({ address, version, ...check })
      .onConflictDoNothing()
  },
}

const forbidden = (message: string) => new HttpError(403, 'FORBIDDEN', message)
const requireSession = (session: VerifiedSession | null): VerifiedSession => {
  if (!session)
    throw new HttpError(401, 'UNAUTHORISED', NAMES.predict.sessionRequired)
  return session
}

export function assertPredictCountry(request: Request): CountryCheck {
  const country = trustedPredictCountry(request)
  if (
    (country && blockedPredictCountries().has(country)) ||
    (!country && process.env.NODE_ENV === 'production')
  ) {
    throw forbidden(NAMES.predict.countryUnavailable)
  }
  return { country, countryCheck: country ? 'allowed' : 'unknown' }
}

// SR-45 must call this before accepting every pick, including replacements.
// It deliberately has no chain, balance or Reward Point dependency.
export async function assertPickEligibility(
  session: VerifiedSession | null,
  request: Request,
  store: PredictEligibilityStore = predictEligibilityStore,
): Promise<void> {
  const address = toStoredAddress(requireSession(session).address)
  assertPredictCountry(request)
  if (!(await store.hasAgeConfirmation(address))) {
    throw forbidden(NAMES.predict.ageRequired)
  }
  if (!(await store.hasTermsAcceptance(address, PREDICT_TERMS_VERSION))) {
    throw forbidden(NAMES.predict.termsRequired)
  }
}

function requirePredictOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (!configured) throw new Error('NEXT_PUBLIC_SITE_URL is required')
  const url = new URL(configured)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (configured !== url.origin && configured !== `${url.origin}/`) ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  )
    throw new Error('NEXT_PUBLIC_SITE_URL must be a trusted origin')
  if (request.headers.get('Origin') !== url.origin) {
    throw forbidden(NAMES.predict.originRequired)
  }
}

type PredictRouteOptions = {
  store?: PredictEligibilityStore
  rateLimiter?: RateLimiter
  rateLimitKey?: (request: Request) => string | Promise<string>
}

export function createPredictAcceptanceRoutes(
  options: PredictRouteOptions = {},
) {
  const store = options.store ?? predictEligibilityStore
  async function eligibleAddress(request: Request) {
    requirePredictOrigin(request)
    const address = toStoredAddress(
      requireSession(await getVerifiedSession(request)).address,
    )
    assertPredictCountry(request)
    return address
  }
  const limited = {
    auth: true,
    maxBodyBytes: 1024,
    rateLimiter: options.rateLimiter ?? predictAcceptanceLimiter,
    // Always authenticate before a possibly paid limiter; never accept a client key.
    rateLimitKey: async (request: Request) => {
      const address = await eligibleAddress(request)
      return options.rateLimitKey ? options.rateLimitKey(request) : address
    },
  }
  return {
    confirmAge: handler(
      { ...limited, schema: z.object({ confirmed: z.literal(true) }).strict() },
      async (_, request) => {
        const address = await eligibleAddress(request)
        assertPredictCountry(request)
        await store.confirmAge(address)
        return { ok: true }
      },
    ),
    acceptTerms: handler(
      {
        ...limited,
        schema: z
          .object({ version: z.literal(PREDICT_TERMS_VERSION) })
          .strict(),
      },
      async ({ version }, request) => {
        const address = await eligibleAddress(request)
        const check = assertPredictCountry(request)
        if (!(await store.hasAgeConfirmation(address)))
          throw forbidden(NAMES.predict.ageRequired)
        await store.acceptTerms(address, version, check)
        return { ok: true, version }
      },
    ),
  }
}

const predictAcceptanceLimiter: RateLimiter = {
  async consume(address) {
    const rows = await getDatabase().execute<{
      count: number
      retry_after: number
    }>(sql`
      WITH expired AS (
        SELECT address FROM predict_rate_limits
        WHERE expires_at < now() - interval '1 hour' AND address <> ${address}
        ORDER BY expires_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      ), cleanup AS (
        DELETE FROM predict_rate_limits
        WHERE address IN (SELECT address FROM expired)
      )
      INSERT INTO predict_rate_limits (address, count, expires_at)
      VALUES (${address}, 1, clock_timestamp() + interval '1 minute')
      ON CONFLICT (address) DO UPDATE SET
        count = CASE WHEN predict_rate_limits.expires_at <= clock_timestamp()
          THEN 1 ELSE predict_rate_limits.count + 1 END,
        expires_at = CASE WHEN predict_rate_limits.expires_at <= clock_timestamp()
          THEN clock_timestamp() + interval '1 minute' ELSE predict_rate_limits.expires_at END
      RETURNING count,
        GREATEST(1, ceil(extract(epoch FROM expires_at - clock_timestamp())))::integer AS retry_after
    `)
    return { allowed: rows[0].count <= 20, retryAfter: rows[0].retry_after }
  },
}

type DbTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>['transaction']>[0]
>[0]

export async function erasePredictData(
  address: string,
  transaction?: DbTransaction,
): Promise<void> {
  const stored = toStoredAddress(addressSchema.parse(address))
  const secret = process.env.PREDICT_ERASURE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'PREDICT_ERASURE_SECRET must contain at least 32 characters',
    )
  }
  const pseudonym = `erased:${createHmac('sha256', secret).update(stored).digest('hex')}`
  const erase = async (tx: DbTransaction) => {
    await tx.execute(sql`SELECT erase_predict_data(${stored}, ${pseudonym})`)
  }
  if (transaction) await erase(transaction)
  else await getDatabase().transaction(erase)
}
