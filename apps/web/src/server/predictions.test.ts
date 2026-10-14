// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NAMES } from '../copy/names'
import { pickTypedData } from '../lib/predict'
import { getDatabase } from './db'
import { MemoryRateLimiter } from './http'
import { type PredictEligibilityStore } from './predict'
import {
  assertPredictionOpen,
  createPredictionRoutes,
  verifyPickSignature,
  type PredictionStore,
  type SignedPick,
} from './predictions'
import { getVerifiedSession, type VerifiedSession } from './session'

vi.mock('server-only', () => ({}))
vi.mock('./session', () => ({ getVerifiedSession: vi.fn() }))
vi.mock('./db', () => ({
  getDatabase: vi.fn(() => {
    throw new Error('Unexpected paid DB')
  }),
}))
const rpc = vi.hoisted(() => ({ client: vi.fn(), verify: vi.fn() }))
vi.mock('@scoutreport/chain', () => ({
  getPublicClient: rpc.client.mockImplementation(() => ({
    verifyTypedData: rpc.verify,
  })),
}))

const origin = 'https://scoutreport.test'
let session: VerifiedSession
let store: PredictionStore
let eligibility: PredictEligibilityStore
let limiter: MemoryRateLimiter
let routes: ReturnType<typeof createPredictionRoutes>
const input = { matchId: randomUUID(), outcome: 'HOME' }

function request(
  method = 'GET',
  body?: unknown,
  country = 'ES',
  requestOrigin = origin,
) {
  return new Request(`${origin}/api/predict/matches`, {
    method,
    headers: {
      Origin: requestOrigin,
      'x-vercel-ip-country': country,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('VERCEL', '1')
  const account = privateKeyToAccount(generatePrivateKey())
  session = {
    address: account.address.toLowerCase(),
    chainId: 88882,
    isContract: false,
    issuedAt: Date.now(),
  }
  vi.mocked(getVerifiedSession).mockResolvedValue(session)
  store = {
    list: vi.fn(async () => ({ matches: [], nextCursor: null })),
    mine: vi.fn(async () => ({
      matches: [],
      nextCursor: null,
      totalPoints: 0,
    })),
    issueNonce: vi.fn(async () => ({
      nonce: randomBytes(32).toString('hex'),
      expiresAt: new Date().toISOString(),
    })),
    submit: vi.fn(async () => ({ ok: true as const })),
  }
  eligibility = {
    hasAgeConfirmation: vi.fn(async () => true),
    hasTermsAcceptance: vi.fn(async () => true),
    confirmAge: vi.fn(),
    acceptTerms: vi.fn(),
  }
  limiter = new MemoryRateLimiter(20)
  routes = createPredictionRoutes({
    store,
    eligibilityStore: eligibility,
    rateLimiter: limiter,
  })
})
afterEach(() => {
  limiter.dispose()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('signed pick verification', () => {
  async function signed(): Promise<{
    account: ReturnType<typeof privateKeyToAccount>
    pick: SignedPick
  }> {
    const account = privateKeyToAccount(generatePrivateKey())
    session.address = account.address.toLowerCase()
    const message = { ...input, nonce: randomBytes(32).toString('hex') }
    const signature = await account.signTypedData(
      pickTypedData(origin, session.chainId, message),
    )
    return { account, pick: { ...message, signature } }
  }
  it('verifies real EOA signatures locally without any RPC or database work', async () => {
    const { pick } = await signed()
    expect(await verifyPickSignature(session, pick, origin)).toBe(true)
    expect(rpc.client).not.toHaveBeenCalled()
    expect(getDatabase).not.toHaveBeenCalled()
  })
  it('rejects wrong wallets, outcomes, match IDs, nonces, chains and domains', async () => {
    const { pick } = await signed()
    for (const tampered of [
      { outcome: 'AWAY' },
      { matchId: randomUUID() },
      { nonce: randomBytes(32).toString('hex') },
    ]) {
      expect(
        await verifyPickSignature(session, { ...pick, ...tampered }, origin),
      ).toBe(false)
    }
    expect(
      await verifyPickSignature(
        {
          ...session,
          address: privateKeyToAccount(generatePrivateKey()).address,
        },
        pick,
        origin,
      ),
    ).toBe(false)
    expect(
      await verifyPickSignature({ ...session, chainId: 88888 }, pick, origin),
    ).toBe(false)
    expect(await verifyPickSignature(session, pick, 'https://other.test')).toBe(
      false,
    )
    expect(rpc.client).not.toHaveBeenCalled()
  })
  it('uses ERC-1271 verification on the session chain, not a client-supplied chain', async () => {
    const { pick } = await signed()
    rpc.verify.mockResolvedValue(true)
    expect(
      await verifyPickSignature({ ...session, isContract: true }, pick, origin),
    ).toBe(true)
    expect(rpc.client).toHaveBeenCalledWith(88882)
    expect(rpc.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        address: session.address,
        signature: pick.signature,
        domain: expect.objectContaining({ chainId: 88882 }),
      }),
    )
    rpc.verify.mockResolvedValue(false)
    expect(
      await verifyPickSignature({ ...session, isContract: true }, pick, origin),
    ).toBe(false)
  })
})

describe('authenticated and bounded Predict API', () => {
  const signedBody = {
    ...input,
    nonce: randomBytes(32).toString('hex'),
    signature: '0x1234',
  }
  it('authenticates ALL reads and writes before the paid limiter, store or RPC', async () => {
    vi.mocked(getVerifiedSession).mockResolvedValue(null)
    const defaults = createPredictionRoutes({
      store,
      eligibilityStore: eligibility,
    })
    for (const [route, req] of [
      [defaults.list, request()],
      [defaults.mine, request()],
      [defaults.eligibility, request()],
      [defaults.nonce, request('POST', input)],
      [defaults.pick, request('POST', signedBody)],
    ] as const) {
      expect((await route(req)).status).toBe(401)
    }
    expect(getDatabase).not.toHaveBeenCalled()
    expect(rpc.client).not.toHaveBeenCalled()
    for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled()
  })
  it('shares per-account limiting across match, mine, eligibility, nonce and pick routes', async () => {
    limiter.dispose()
    limiter = new MemoryRateLimiter(1)
    routes = createPredictionRoutes({
      store,
      eligibilityStore: eligibility,
      rateLimiter: limiter,
    })
    expect((await routes.list(request())).status).toBe(200)
    for (const [route, req] of [
      [routes.mine, request()],
      [routes.eligibility, request()],
      [routes.nonce, request('POST', input)],
      [routes.pick, request('POST', signedBody)],
    ] as const) {
      const response = await route(req)
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBeTruthy()
      expect(response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(store.mine).not.toHaveBeenCalled()
    expect(store.submit).not.toHaveBeenCalled()
  })
  it.each(['US', ''])(
    'refuses country %s for challenges and every replacement',
    async (country) => {
      for (const route of [routes.nonce, routes.pick]) {
        expect((await route(request('POST', signedBody, country))).status).toBe(
          403,
        )
      }
      expect(store.issueNonce).not.toHaveBeenCalled()
      expect(store.submit).not.toHaveBeenCalled()
    },
  )
  it('returns a usable eligibility status without country DB lookups when blocked', async () => {
    const response = await routes.eligibility(request('GET', undefined, 'US'))
    expect(await response.json()).toMatchObject({
      countryAllowed: false,
      ageConfirmed: false,
      termsAccepted: false,
    })
    expect(eligibility.hasAgeConfirmation).not.toHaveBeenCalled()
  })
  it.each(['hasAgeConfirmation', 'hasTermsAcceptance'] as const)(
    'requires %s for challenges and picks',
    async (key) => {
      vi.mocked(eligibility[key]).mockResolvedValue(false)
      expect((await routes.nonce(request('POST', input))).status).toBe(403)
      expect((await routes.pick(request('POST', signedBody))).status).toBe(403)
      expect(store.issueNonce).not.toHaveBeenCalled()
      expect(store.submit).not.toHaveBeenCalled()
    },
  )
  it('requires the trusted Origin before any write limiting', async () => {
    const defaults = createPredictionRoutes({
      store,
      eligibilityStore: eligibility,
    })
    expect(
      (
        await defaults.pick(
          request('POST', signedBody, 'ES', 'https://other.test'),
        )
      ).status,
    ).toBe(403)
    expect(getDatabase).not.toHaveBeenCalled()
  })
  it('passes only the authenticated account to scoped reads and rejects malformed cursors', async () => {
    expect((await routes.mine(request())).status).toBe(200)
    expect(store.mine).toHaveBeenCalledWith(session.address, null)
    expect(
      (await routes.list(new Request(`${origin}/?cursor=not-a-cursor`))).status,
    ).toBe(400)
  })
  it('rejects client identity, chain IDs, countries and oversized signature bodies', async () => {
    for (const extra of [
      { address: session.address },
      { chainId: 1 },
      { country: 'ES' },
    ]) {
      expect(
        (await routes.pick(request('POST', { ...signedBody, ...extra })))
          .status,
      ).toBe(400)
    }
    expect(
      (
        await routes.pick(
          request('POST', {
            ...signedBody,
            signature: `0x${'ab'.repeat(7000)}`,
          }),
        )
      ).status,
    ).toBe(413)
    expect(store.submit).not.toHaveBeenCalled()
  })
})

it('allows only strictly before the exact server lock boundary', () => {
  const lockAtUtc = new Date('2030-06-01T14:00:00Z')
  const match = { status: 'open', lockAtUtc }
  expect(() =>
    assertPredictionOpen(match, new Date(lockAtUtc.getTime() - 1)),
  ).not.toThrow()
  expect(() => assertPredictionOpen(match, lockAtUtc)).toThrow(
    NAMES.predict.matchUnavailable,
  )
  expect(() =>
    assertPredictionOpen(match, new Date(lockAtUtc.getTime() + 1)),
  ).toThrow()
  for (const status of ['settled', 'voided'])
    expect(() =>
      assertPredictionOpen({ ...match, status }, new Date(0)),
    ).toThrow()
})
