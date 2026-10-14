// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NAMES } from '../copy/names'
import { getDatabase } from './db'
import { MemoryRateLimiter } from './http'
import {
  assertPickEligibility,
  createPredictAcceptanceRoutes,
  erasePredictData,
  type PredictEligibilityStore,
} from './predict'
import {
  blockedPredictCountries,
  DRAFT_BLOCKED_COUNTRIES,
  PREDICT_TERMS_VERSION,
} from './predict-config'
import { getVerifiedSession, type VerifiedSession } from './session'

vi.mock('server-only', () => ({}))
vi.mock('./session', () => ({ getVerifiedSession: vi.fn() }))
vi.mock('./db', () => ({
  getDatabase: vi.fn(() => {
    throw new Error('Unexpected DB lookup')
  }),
}))
const rpc = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('Unexpected balance or RP lookup')
  }),
)
vi.mock('@scoutreport/chain', () => ({ getPublicClient: rpc }))

const address = '0x00000000000000000000000000000000000000ab'
const session: VerifiedSession = {
  address,
  chainId: 88882,
  isContract: false,
  issuedAt: Date.now(),
}
const origin = 'https://scoutreport.test'
const request = (body?: unknown, country = 'ES', requestOrigin = origin) =>
  new Request(`${origin}/api/predict/terms-acceptance`, {
    method: 'POST',
    headers: {
      Origin: requestOrigin,
      'x-vercel-ip-country': country,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })
let store: PredictEligibilityStore
let limiter: MemoryRateLimiter
let routes: ReturnType<typeof createPredictAcceptanceRoutes>

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
  vi.stubEnv('PREDICT_BLOCKED_COUNTRIES', undefined)
  vi.mocked(getVerifiedSession).mockResolvedValue(session)
  store = {
    hasAgeConfirmation: vi.fn(async () => true),
    hasTermsAcceptance: vi.fn(async () => true),
    confirmAge: vi.fn(async () => {}),
    acceptTerms: vi.fn(async () => {}),
  }
  limiter = new MemoryRateLimiter(2)
  routes = createPredictAcceptanceRoutes({ store, rateLimiter: limiter })
})
afterEach(() => {
  limiter.dispose()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('free-to-play eligibility', () => {
  it('keeps the displayed legal revision aligned with the required terms version', () => {
    expect(NAMES.legal.revision).toContain(`Version: ${PREDICT_TERMS_VERSION}`)
  })
  it('requires a session before database work', async () => {
    await expect(
      assertPickEligibility(null, request(), store),
    ).rejects.toMatchObject({ status: 401 })
    expect(store.hasAgeConfirmation).not.toHaveBeenCalled()
  })
  it('returns 403 without an 18+ record', async () => {
    vi.mocked(store.hasAgeConfirmation).mockResolvedValue(false)
    await expect(
      assertPickEligibility(session, request(), store),
    ).rejects.toMatchObject({ status: 403, message: NAMES.predict.ageRequired })
    expect(store.hasTermsAcceptance).not.toHaveBeenCalled()
  })
  it('refuses absent or superseded terms acceptance', async () => {
    vi.mocked(store.hasTermsAcceptance).mockImplementation(
      async (_, version) => version === '0.2',
    )
    await expect(
      assertPickEligibility(session, request(), store),
    ).rejects.toMatchObject({ status: 403 })
    expect(store.hasTermsAcceptance).toHaveBeenCalledWith(
      address,
      PREDICT_TERMS_VERSION,
    )
  })
  it.each(DRAFT_BLOCKED_COUNTRIES)(
    'blocks draft country %s before DB work',
    async (country) => {
      await expect(
        assertPickEligibility(session, request({}, country), store),
      ).rejects.toMatchObject({ status: 403 })
      expect(store.hasAgeConfirmation).not.toHaveBeenCalled()
    },
  )
  it.each(['', 'XX', 'ZZ', 'EU', 'unknown'])(
    'fails closed for unknown production country %s',
    async (country) => {
      vi.stubEnv('NODE_ENV', 'production')
      await expect(
        assertPickEligibility(session, request({}, country), store),
      ).rejects.toMatchObject({ status: 403 })
      expect(store.hasAgeConfirmation).not.toHaveBeenCalled()
    },
  )
  it('ignores untrusted headers and client-supplied country', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', undefined)
    await expect(
      assertPickEligibility(session, request({ country: 'ES' }), store),
    ).rejects.toMatchObject({ status: 403 })
    expect(store.hasAgeConfirmation).not.toHaveBeenCalled()
  })
  it('allows unknown country only outside production', async () => {
    await expect(
      assertPickEligibility(session, request({}, ''), store),
    ).resolves.toBeUndefined()
  })
  it('admits a wallet with zero CHZ, zero Fan Tokens and zero RP without any asset lookup', async () => {
    const zeroAssets = { chz: 0n, fanTokens: 0n, rp: 0n }
    expect(Object.values(zeroAssets).every((value) => value === 0n)).toBe(true)
    await expect(
      assertPickEligibility(session, request(), store),
    ).resolves.toBeUndefined()
    expect(rpc).not.toHaveBeenCalled()
    expect(getDatabase).not.toHaveBeenCalled()
  })
  it('uses validated server configuration, never an empty allow-all list', () => {
    vi.stubEnv('PREDICT_BLOCKED_COUNTRIES', 'US, GB')
    expect([...blockedPredictCountries()]).toEqual(['US', 'GB'])
    for (const invalid of ['', 'us', 'USA', 'US,', 'ZZ']) {
      vi.stubEnv('PREDICT_BLOCKED_COUNTRIES', invalid)
      expect(blockedPredictCountries).toThrow()
    }
  })
})

describe('authenticated acceptance endpoints', () => {
  it('requires a SIWE session before paid limiting or persistence', async () => {
    vi.mocked(getVerifiedSession).mockResolvedValue(null)
    const defaultRoutes = createPredictAcceptanceRoutes({ store })
    expect(
      (await defaultRoutes.confirmAge(request({ confirmed: true }))).status,
    ).toBe(401)
    expect(
      (
        await defaultRoutes.acceptTerms(
          request({ version: PREDICT_TERMS_VERSION }),
        )
      ).status,
    ).toBe(401)
    expect(getDatabase).not.toHaveBeenCalled()
    expect(store.confirmAge).not.toHaveBeenCalled()
    expect(store.acceptTerms).not.toHaveBeenCalled()
  })
  it.each(['https://other.test', ''])(
    'rejects Origin %s before paid work',
    async (requestOrigin) => {
      const defaultRoutes = createPredictAcceptanceRoutes({ store })
      expect(
        (
          await defaultRoutes.confirmAge(
            request({ confirmed: true }, 'ES', requestOrigin),
          )
        ).status,
      ).toBe(403)
      expect(getDatabase).not.toHaveBeenCalled()
      expect(store.confirmAge).not.toHaveBeenCalled()
    },
  )
  it('records a positive 18+ confirmation for the session wallet only', async () => {
    expect((await routes.confirmAge(request({ confirmed: true }))).status).toBe(
      200,
    )
    expect(store.confirmAge).toHaveBeenCalledWith(address)
  })
  it.each([
    { confirmed: false },
    {},
    { confirmed: true, address },
    { confirmed: true, country: 'ES' },
  ])('rejects invalid age body %j', async (body) => {
    expect((await routes.confirmAge(request(body))).status).toBe(400)
    expect(store.confirmAge).not.toHaveBeenCalled()
  })
  it('records only the current version with server country and no IP', async () => {
    const response = await routes.acceptTerms(
      request({ version: PREDICT_TERMS_VERSION }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(store.acceptTerms).toHaveBeenCalledWith(
      address,
      PREDICT_TERMS_VERSION,
      { country: 'ES', countryCheck: 'allowed' },
    )
  })
  it('requires age confirmation before terms acceptance', async () => {
    vi.mocked(store.hasAgeConfirmation).mockResolvedValue(false)
    expect(
      (await routes.acceptTerms(request({ version: PREDICT_TERMS_VERSION })))
        .status,
    ).toBe(403)
    expect(store.acceptTerms).not.toHaveBeenCalled()
  })
  it.each([
    { version: '0.2' },
    { version: PREDICT_TERMS_VERSION, country: 'ES' },
  ])('rejects stale terms or client eligibility %j', async (body) => {
    expect((await routes.acceptTerms(request(body))).status).toBe(400)
    expect(store.acceptTerms).not.toHaveBeenCalled()
  })
  it('rejects a blocked country before even paid rate limiting', async () => {
    const defaultRoutes = createPredictAcceptanceRoutes({ store })
    expect(
      (
        await defaultRoutes.acceptTerms(
          request({ version: PREDICT_TERMS_VERSION }, 'US'),
        )
      ).status,
    ).toBe(403)
    expect(getDatabase).not.toHaveBeenCalled()
    expect(store.acceptTerms).not.toHaveBeenCalled()
  })
  it('rate limits both acceptance routes together before persistence', async () => {
    await routes.confirmAge(request({ confirmed: true }))
    await routes.acceptTerms(request({ version: PREDICT_TERMS_VERSION }))
    const response = await routes.confirmAge(request({ confirmed: true }))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()
    expect(store.confirmAge).toHaveBeenCalledTimes(1)
  })
  it('uses the same safeguards in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await routes.confirmAge(request({ confirmed: true }))).status).toBe(
      200,
    )
  })
})

describe('Predict erasure entry point', () => {
  it.each([undefined, '', 'short'])(
    'fails closed without a strong erasure secret',
    async (secret) => {
      vi.stubEnv('PREDICT_ERASURE_SECRET', secret)
      await expect(erasePredictData(address)).rejects.toThrow(
        'PREDICT_ERASURE_SECRET',
      )
      expect(getDatabase).not.toHaveBeenCalled()
    },
  )
  it('passes only the normalised wallet and keyed pseudonym into one transaction', async () => {
    vi.stubEnv('PREDICT_ERASURE_SECRET', randomBytes(32).toString('hex'))
    const execute = vi.fn<(query: SQL) => Promise<void>>(async () => {})
    const transaction = vi.fn(
      async (run: (tx: { execute: typeof execute }) => Promise<void>) =>
        run({ execute }),
    )
    vi.mocked(getDatabase).mockReturnValue({
      transaction,
    } as unknown as ReturnType<typeof getDatabase>)
    await erasePredictData(address.toUpperCase().replace('0X', '0x'))
    expect(transaction).toHaveBeenCalledTimes(1)
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0])
    expect(query.sql).toContain('erase_predict_data')
    expect(query.params[0]).toBe(address)
    expect(query.params[1]).toMatch(/^erased:[0-9a-f]{64}$/)
    expect(query.params).not.toContain(process.env.PREDICT_ERASURE_SECRET)
  })
})

describe('no prize or redeemable-value path', () => {
  it('forbids Predict flags and prize implementation identifiers', () => {
    const server = new URL('.', import.meta.url)
    const config = readFileSync(new URL('predict-config.ts', server), 'utf8')
    expect(config).not.toMatch(/(?:prize|reward|redeem|payout|cashValue)/i)
    const files = readdirSync(server).filter(
      (file) =>
        file.startsWith('predict') &&
        file.endsWith('.ts') &&
        !file.includes('.test.'),
    )
    for (const file of files) {
      const source = readFileSync(new URL(file, server), 'utf8')
      expect(source).not.toMatch(
        /(?:FEATURE_[A-Z_]*(?:PRIZE|REWARD|REDEEM)|(?:enable|claim|redeem|award|transfer|pay)(?:Prize|Reward|Points)|@scoutreport\/chain|(?:getBalance|balanceOf|pointsOf)\s*\()/,
      )
    }
    const src = new URL('../', import.meta.url)
    for (const file of readdirSync(src, {
      recursive: true,
      encoding: 'utf8',
    })) {
      if (!/\.[jt]sx?$/.test(file) || file.includes('.test.')) continue
      const source = readFileSync(new URL(file, src), 'utf8')
      expect(source, file).not.toMatch(
        /(?:FEATURE_|NEXT_PUBLIC_)?PREDICT[A-Z_]*(?:PRIZE|REWARD|REDEEM)/,
      )
    }
    expect(NAMES.legal.termsSections.at(-1)?.text).toContain(
      'No prizes are offered.',
    )
  })
})
