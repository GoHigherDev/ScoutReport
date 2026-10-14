// @vitest-environment node
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { recoverTypedDataAddress } from 'viem'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createPredictAcceptanceRoutes, erasePredictData } from './predict'
import { PREDICT_TERMS_VERSION } from './predict-config'
import { readSession } from './session'
import { pickTypedData } from '../lib/predict'
import { NAMES } from '../copy/names'
import {
  createPredictionRoutes,
  predictionStore,
  verifyPickSignature,
} from './predictions'

vi.mock('server-only', () => ({}))
const url = process.env.PREDICT_TEST_DATABASE_URL
const origin = 'https://scoutreport.test'

// Use a dedicated disposable database: these tests apply real migrations.
describe.skipIf(!url)('Predict PostgreSQL guardrails and erasure', () => {
  const client = postgres(url!, { max: 1 })
  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', url!)
    vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('hex'))
    vi.stubEnv('PREDICT_ERASURE_SECRET', randomBytes(32).toString('hex'))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('PREDICT_BLOCKED_COUNTRIES', undefined)
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(
        new URL('../../../../drizzle', import.meta.url),
      ),
    })
  })
  afterAll(async () => {
    await client.end()
    vi.unstubAllEnvs()
  })

  async function authenticatedRequest(address: string) {
    const response = new Response()
    const session = await readSession(new Request(origin), response)
    Object.assign(session, {
      address,
      chainId: 88882,
      isContract: false,
      issuedAt: Date.now(),
    })
    await session.save()
    const cookie = response.headers.get('Set-Cookie')!.split(';')[0]
    return (body: unknown) =>
      new Request(`${origin}/api/predict/age-confirmation`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: origin,
          'x-vercel-ip-country': 'ES',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
  }

  it('creates btree address indexes for wallet-only erasure and an expiry index for cleanup', async () => {
    const indexes = await client`
      SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'picks_address', 'prediction_points_address', 'siwe_nonces_address',
          'predict_nonces_address', 'predict_rate_limits_expiry'
        )
    `
    expect(indexes).toHaveLength(5)
    for (const row of indexes) {
      expect(row.indexdef).toContain(
        `USING btree (${row.tablename === 'predict_rate_limits' ? 'expires_at' : 'address'})`,
      )
    }
  })

  async function fixture() {
    const account = privateKeyToAccount(generatePrivateKey())
    const address = account.address.toLowerCase()
    const other =
      privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    const matchId = randomUUID()
    const typedData = {
      domain: { name: 'Erasure test', version: '1', chainId: 88882 },
      types: {
        Pick: [
          { name: 'matchId', type: 'string' },
          { name: 'outcome', type: 'string' },
        ],
      },
      primaryType: 'Pick' as const,
      message: { matchId, outcome: 'HOME' },
    }
    const signature = await account.signTypedData(typedData)
    await client`
      INSERT INTO matches (id, sport, home_label, away_label, kickoff_utc, lock_at_utc, outcomes, points_for_correct, created_by)
      VALUES (${matchId}, 'football', 'First side', 'Second side', now() + interval '1 day', now() + interval '1 day',
        '["HOME","AWAY"]', 1, ${address})
    `
    await client`INSERT INTO picks (match_id, address, outcome, signature) VALUES (${matchId}, ${address}, 'HOME', ${signature})`
    await client`INSERT INTO prediction_points (match_id, address, points, week_start_utc, season_id) VALUES (${matchId}, ${address}, 1, now(), 'test')`
    await client`INSERT INTO predict_age_confirmations (address) VALUES (${address}), (${other})`
    await client`INSERT INTO predict_terms_acceptances (address, version, country, country_check) VALUES (${address}, ${PREDICT_TERMS_VERSION}, 'ES', 'allowed')`
    await client`INSERT INTO predict_nonces (nonce, address, expires_at) VALUES (${randomUUID()}, ${address}, now() + interval '10 minutes')`
    await client`INSERT INTO siwe_nonces (nonce, address, expires_at) VALUES (${randomUUID()}, ${address}, now() + interval '10 minutes')`
    await client`INSERT INTO predict_rate_limits (address, count, expires_at) VALUES
      (${address}, 1, now() + interval '1 minute'),
      (${'read:' + address}, 1, now() + interval '1 minute')`
    await client`INSERT INTO prediction_audit (address, match_id, outcome, signature) VALUES (${address}, ${matchId}, 'HOME', ${signature})`
    await client`INSERT INTO admin_audit_log (actor_address, action, payload) VALUES (${address}, 'matches.create', ${JSON.stringify({ after: { createdBy: account.address }, signature })}::jsonb)`
    await client`INSERT INTO admin_audit_log (actor_address, action, payload) VALUES (${other}, 'matches.edit', ${JSON.stringify({ before: { createdBy: account.address } })}::jsonb)`
    return { address, other, matchId, typedData, signature }
  }

  it('removes all Predict records and recoverable signatures; keeps only pseudonymised audit rows', async () => {
    const { address, other, matchId, typedData, signature } = await fixture()
    expect(
      (
        await recoverTypedDataAddress({ ...typedData, signature })
      ).toLowerCase(),
    ).toBe(address)
    await erasePredictData(address)
    expect(
      await client`SELECT * FROM predict_rate_limits WHERE address = ${'read:' + address}`,
    ).toHaveLength(0)
    for (const table of [
      'picks',
      'prediction_points',
      'predict_age_confirmations',
      'predict_terms_acceptances',
      'predict_nonces',
      'siwe_nonces',
      'predict_rate_limits',
    ]) {
      const rows =
        await client`SELECT * FROM ${client(table)} WHERE address = ${address}`
      expect(rows, table).toHaveLength(0)
    }
    const audit =
      await client`SELECT * FROM prediction_audit WHERE match_id = ${matchId}`
    expect(audit).toHaveLength(1)
    expect(audit[0].address).toMatch(/^erased:[0-9a-f]{64}$/)
    expect(audit[0].signature).toBeNull()
    const admin = await client`SELECT * FROM admin_audit_log`
    for (const row of [...admin, ...audit]) {
      expect(JSON.stringify(row).toLowerCase()).not.toContain(address)
      expect(JSON.stringify(row)).not.toContain(signature)
    }
    const [match] =
      await client`SELECT created_by FROM matches WHERE id = ${matchId}`
    expect(match.created_by).toBe(audit[0].address)
    expect(
      await client`SELECT * FROM predict_age_confirmations WHERE address = ${other}`,
    ).toHaveLength(1)
    await erasePredictData(address)
    expect(
      await client`SELECT * FROM prediction_audit WHERE match_id = ${matchId}`,
    ).toEqual(audit)
    await expect(
      client`UPDATE prediction_audit SET outcome = 'AWAY' WHERE match_id = ${matchId}`,
    ).rejects.toThrow('append-only')
    await expect(
      client`DELETE FROM prediction_audit WHERE match_id = ${matchId}`,
    ).rejects.toThrow('append-only')
    await expect(client`TRUNCATE prediction_audit`).rejects.toThrow(
      'append-only',
    )
    await expect(
      client`UPDATE admin_audit_log SET action = 'changed'`,
    ).rejects.toThrow('append-only')
    await expect(client`TRUNCATE admin_audit_log`).rejects.toThrow(
      'append-only',
    )
  })

  it('rolls back deletions and audit changes together if erasure fails', async () => {
    const { address, matchId, signature } = await fixture()
    await client.unsafe(`
      CREATE FUNCTION sr41_test_erase_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test erasure failure'; END; $$;
      CREATE TRIGGER sr41_test_erase_failure BEFORE UPDATE ON prediction_audit
      FOR EACH ROW EXECUTE FUNCTION sr41_test_erase_failure();
    `)
    try {
      await expect(erasePredictData(address)).rejects.toThrow()
      expect(
        await client`SELECT * FROM picks WHERE address = ${address}`,
      ).toHaveLength(1)
      expect(
        await client`SELECT * FROM predict_terms_acceptances WHERE address = ${address}`,
      ).toHaveLength(1)
      expect(
        await client`SELECT * FROM predict_nonces WHERE address = ${address}`,
      ).toHaveLength(1)
      const [audit] =
        await client`SELECT * FROM prediction_audit WHERE match_id = ${matchId}`
      expect(audit.address).toBe(address)
      expect(audit.signature).toBe(signature)
    } finally {
      await client.unsafe(
        'DROP TRIGGER sr41_test_erase_failure ON prediction_audit; DROP FUNCTION sr41_test_erase_failure()',
      )
      await erasePredictData(address)
    }
  })

  it('waits for concurrent match writers before scanning their identifying audit rows', async () => {
    const { address, other, matchId, signature } = await fixture()
    const auditId = randomUUID()
    let erasure: Promise<void> | undefined
    await client.begin(async (writer) => {
      await writer`SELECT id FROM matches WHERE id = ${matchId} FOR UPDATE`
      erasure = erasePredictData(address)
      const deadline = Date.now() + 5000
      let waiting = false
      while (Date.now() < deadline) {
        await writer`SELECT pg_stat_clear_snapshot()`
        const [status] = await writer`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid()
              AND query LIKE '%erase_predict_data%'
          ) AS waiting
        `
        if (status.waiting) {
          waiting = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(waiting).toBe(true)
      await writer`
        INSERT INTO admin_audit_log (id, actor_address, action, payload)
        VALUES (${auditId}, ${other}, 'matches.edit',
          ${JSON.stringify({ before: { createdBy: address }, signature })}::jsonb)
      `
    })
    await erasure
    const [audit] =
      await client`SELECT payload FROM admin_audit_log WHERE id = ${auditId}`
    expect(
      typeof audit.payload === 'string'
        ? JSON.parse(audit.payload)
        : audit.payload,
    ).toEqual({ erased: true })
    expect(
      await client`SELECT * FROM prediction_points WHERE address = ${address}`,
    ).toHaveLength(0)
  }, 10_000)

  it('authenticates a real encrypted session and enforces a shared database rate limit', async () => {
    const address =
      privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    const request = await authenticatedRequest(address)
    const routes = createPredictAcceptanceRoutes()
    expect((await routes.confirmAge(request({ confirmed: true }))).status).toBe(
      200,
    )
    expect(
      (await routes.acceptTerms(request({ version: PREDICT_TERMS_VERSION })))
        .status,
    ).toBe(200)
    const [record] =
      await client`SELECT * FROM predict_terms_acceptances WHERE address = ${address}`
    expect(record.country).toBe('ES')
    expect(record.country_check).toBe('allowed')
    expect(Number.isFinite(new Date(record.accepted_at).getTime())).toBe(true)
    for (let count = 2; count < 20; count++) {
      expect(
        (await routes.confirmAge(request({ confirmed: true }))).status,
      ).toBe(200)
    }
    const limited = await createPredictAcceptanceRoutes().confirmAge(
      request({ confirmed: true }),
    )
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBeTruthy()
    await client`UPDATE predict_rate_limits SET expires_at = now() - interval '1 second' WHERE address = ${address}`
    expect((await routes.confirmAge(request({ confirmed: true }))).status).toBe(
      200,
    )
    await erasePredictData(address)
  })

  it('cleans at most 100 old limits per eligible request, skips locks and preserves active/recent limits', async () => {
    const address =
      privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    const expired = Array.from(
      { length: 105 },
      () => `0x${randomBytes(20).toString('hex')}`,
    )
    const recent = `0x${randomBytes(20).toString('hex')}`
    const active = `0x${randomBytes(20).toString('hex')}`
    await client`
      INSERT INTO predict_rate_limits (address, count, expires_at)
      SELECT unnest(${expired}::text[]), 20, now() - interval '2 hours'
    `
    await client`
      INSERT INTO predict_rate_limits (address, count, expires_at) VALUES
        (${address}, 99, now() - interval '2 hours'),
        (${recent}, 20, now() - interval '30 minutes'),
        (${active}, 20, now() + interval '1 minute')
    `
    const preserved = await client`
      SELECT * FROM predict_rate_limits WHERE address IN (${recent}, ${active}) ORDER BY address
    `
    const request = await authenticatedRequest(address)
    const routes = createPredictAcceptanceRoutes()
    try {
      await client.begin(async (locker) => {
        await locker`SELECT address FROM predict_rate_limits WHERE address = ${expired[0]} FOR UPDATE`
        expect(
          (await routes.confirmAge(request({ confirmed: true }))).status,
        ).toBe(200)
        const remaining = await locker`
          SELECT address FROM predict_rate_limits WHERE address = ANY(${expired}::text[])
        `
        expect(remaining).toHaveLength(5)
        expect(remaining.map((row) => row.address)).toContain(expired[0])
      })
      const [current] =
        await client`SELECT count FROM predict_rate_limits WHERE address = ${address}`
      expect(current.count).toBe(1)
      expect(
        (await routes.acceptTerms(request({ version: PREDICT_TERMS_VERSION })))
          .status,
      ).toBe(200)
      expect(
        await client`SELECT address FROM predict_rate_limits WHERE address = ANY(${expired}::text[])`,
      ).toHaveLength(0)
      expect(
        await client`
        SELECT * FROM predict_rate_limits WHERE address IN (${recent}, ${active}) ORDER BY address
      `,
      ).toEqual(preserved)
    } finally {
      await client`DELETE FROM predict_rate_limits WHERE address = ANY(${[...expired, recent, active]}::text[])`
      await erasePredictData(address)
    }
  })

  async function pickFixture() {
    const account = privateKeyToAccount(generatePrivateKey())
    const address = account.address.toLowerCase()
    const creator =
      privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    const matchId = randomUUID()
    await client`
      INSERT INTO matches (id, sport, home_label, away_label, kickoff_utc, lock_at_utc, outcomes, points_for_correct, created_by)
      VALUES (${matchId}, 'football', 'SR-45 first', 'SR-45 second', clock_timestamp() + interval '1 day',
        clock_timestamp() + interval '1 hour', '["HOME","AWAY"]', 5, ${creator})
    `
    const session = {
      address,
      chainId: 88882 as const,
      isContract: false,
      issuedAt: Date.now(),
    }
    const request = new Request(`${origin}/api/predict/picks`, {
      method: 'POST',
      headers: { Origin: origin, 'x-vercel-ip-country': 'ES' },
    })
    await client`INSERT INTO predict_age_confirmations (address) VALUES (${address})`
    await client`INSERT INTO predict_terms_acceptances (address, version, country, country_check)
      VALUES (${address}, ${PREDICT_TERMS_VERSION}, 'ES', 'allowed')`
    async function signed(outcome = 'HOME') {
      const selection = { matchId, outcome }
      const { nonce } = await predictionStore.issueNonce(
        selection,
        session,
        request,
      )
      const message = { ...selection, nonce }
      const signature = await account.signTypedData(
        pickTypedData(origin, session.chainId, message),
      )
      return { ...message, signature }
    }
    return { account, address, matchId, session, request, signed }
  }

  it('shares independent read and write budgets across route instances and accounts', async () => {
    const f = await pickFixture()
    const authenticated = await authenticatedRequest(f.address)
    const reads = ['list', 'mine', 'eligibility'] as const
    for (let count = 0; count < 20; count++) {
      const routes = createPredictionRoutes()
      expect((await routes[reads[count % 3]](authenticated({}))).status).toBe(
        200,
      )
    }
    for (const route of reads) {
      expect(
        (await createPredictionRoutes()[route](authenticated({}))).status,
      ).toBe(429)
    }
    const acceptance = createPredictAcceptanceRoutes()
    expect(
      (await acceptance.confirmAge(authenticated({ confirmed: true }))).status,
    ).toBe(200)
    expect(
      (
        await acceptance.acceptTerms(
          authenticated({ version: PREDICT_TERMS_VERSION }),
        )
      ).status,
    ).toBe(200)
    const nonceResponse = await createPredictionRoutes().nonce(
      authenticated({ matchId: f.matchId, outcome: 'HOME' }),
    )
    expect(nonceResponse.status).toBe(200)
    const { nonce } = await nonceResponse.json()
    const message = { matchId: f.matchId, outcome: 'HOME', nonce }
    const signature = await f.account.signTypedData(
      pickTypedData(origin, 88882, message),
    )
    expect(
      (
        await createPredictionRoutes().pick(
          authenticated({ ...message, signature }),
        )
      ).status,
    ).toBe(200)
    for (let count = 4; count < 20; count++) {
      expect(
        (await acceptance.confirmAge(authenticated({ confirmed: true })))
          .status,
      ).toBe(200)
    }
    expect(
      (await acceptance.confirmAge(authenticated({ confirmed: true }))).status,
    ).toBe(429)
    await client`UPDATE predict_rate_limits SET expires_at = clock_timestamp() - interval '1 second'
      WHERE address = ${'read:' + f.address}`
    expect(
      (await createPredictionRoutes().mine(authenticated({}))).status,
    ).toBe(200)
    expect(
      (await createPredictionRoutes().nonce(authenticated(message))).status,
    ).toBe(429)
    const other = await pickFixture()
    const otherRequest = await authenticatedRequest(other.address)
    expect((await createPredictionRoutes().list(otherRequest({}))).status).toBe(
      200,
    )
    expect(
      (await acceptance.confirmAge(otherRequest({ confirmed: true }))).status,
    ).toBe(200)
    await directErasure(f.address)
    expect(
      await client`SELECT * FROM predict_rate_limits WHERE address IN (${f.address}, ${'read:' + f.address})`,
    ).toHaveLength(0)
    await erasePredictData(other.address)
  })

  it('rejects invalid preflight data without invoking a verifier or consuming the nonce', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    const verify = vi.fn(async () => true)
    for (const [input, status] of [
      [{ ...pick, matchId: randomUUID() }, 409],
      [{ ...pick, nonce: randomBytes(32).toString('hex') }, 409],
      [{ ...pick, outcome: 'INVALID' }, 400],
    ] as const) {
      await expect(
        predictionStore.submit(input, f.session, f.request, verify),
      ).rejects.toMatchObject({ status })
    }
    const other = await pickFixture()
    await expect(
      predictionStore.submit(pick, other.session, f.request, verify),
    ).rejects.toMatchObject({ status: 409 })
    await client`UPDATE predict_nonces SET expires_at = clock_timestamp() WHERE nonce = ${pick.nonce}`
    await expect(
      predictionStore.submit(pick, f.session, f.request, verify),
    ).rejects.toMatchObject({ status: 409 })
    const replacement = await f.signed()
    await client`UPDATE matches SET lock_at_utc = clock_timestamp() WHERE id = ${f.matchId}`
    await expect(
      predictionStore.submit(replacement, f.session, f.request, verify),
    ).rejects.toMatchObject({ status: 409 })
    await client`UPDATE matches SET status = 'settled', result = 'HOME' WHERE id = ${f.matchId}`
    await expect(
      predictionStore.submit(replacement, f.session, f.request, verify),
    ).rejects.toMatchObject({ status: 409 })
    expect(verify).not.toHaveBeenCalled()
    await erasePredictData(f.address)
    await erasePredictData(other.address)
  })

  it('maps verifier failures safely without consuming a nonce or recording a pick', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    const authenticated = await authenticatedRequest(f.address)
    const routes = createPredictionRoutes({
      verifySignature: async () => {
        throw new Error('Internal RPC diagnostic must not reach the client')
      },
    })
    const response = await routes.pick(authenticated(pick))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      code: 'INVALID_REQUEST',
      message: NAMES.predict.invalidSignature,
    })
    expect(
      await client`SELECT * FROM predict_nonces WHERE nonce = ${pick.nonce}`,
    ).toHaveLength(1)
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM prediction_audit WHERE address = ${f.address}`,
    ).toHaveLength(0)
    await erasePredictData(f.address)
  })

  function pausedVerifier() {
    let entered!: () => void
    let resume!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const released = new Promise<void>((resolve) => {
      resume = resolve
    })
    return {
      started,
      resume,
      verify: async () => {
        entered()
        await released
        return true
      },
    }
  }

  async function within<T>(promise: Promise<T>): Promise<T> {
    let timer!: ReturnType<typeof setTimeout>
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Operation blocked by verification')),
            3000,
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  it('does not block another wallet picking or settlement while signature verification is paused', async () => {
    const f = await pickFixture()
    const other = await pickFixture()
    const pick = await f.signed()
    const selection = { matchId: f.matchId, outcome: 'AWAY' }
    const { nonce } = await predictionStore.issueNonce(
      selection,
      other.session,
      other.request,
    )
    const message = { ...selection, nonce }
    const signature = await other.account.signTypedData(
      pickTypedData(origin, 88882, message),
    )
    const paused = pausedVerifier()
    const pending = predictionStore.submit(
      pick,
      f.session,
      f.request,
      paused.verify,
    )
    void pending.catch(() => {})
    try {
      await within(paused.started)
      await within(
        predictionStore.submit(
          { ...message, signature },
          other.session,
          other.request,
          verifyPickSignature,
        ),
      )
      await within(
        client.begin(async (tx) => {
          await tx`SELECT id FROM matches WHERE id = ${f.matchId} FOR UPDATE`
          await tx`UPDATE matches SET status = 'settled', result = 'AWAY', lock_at_utc = clock_timestamp()
          WHERE id = ${f.matchId}`
        }),
      )
    } finally {
      paused.resume()
    }
    await expect(pending).rejects.toMatchObject({ status: 409 })
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM predict_nonces WHERE nonce = ${pick.nonce}`,
    ).toHaveLength(1)
    await erasePredictData(f.address)
    await erasePredictData(other.address)
  }, 10_000)

  it.each(['erasure', 'replay', 'expiry', 'eligibility', 'outcome'] as const)(
    'revalidates %s after slow verification',
    async (change) => {
      const f = await pickFixture()
      const pick = await f.signed()
      const paused = pausedVerifier()
      const pending = predictionStore.submit(
        pick,
        f.session,
        f.request,
        paused.verify,
      )
      void pending.catch(() => {})
      try {
        await within(paused.started)
        if (change === 'erasure') await within(directErasure(f.address))
        if (change === 'replay')
          await within(
            predictionStore.submit(
              pick,
              f.session,
              f.request,
              verifyPickSignature,
            ),
          )
        if (change === 'expiry')
          await client`UPDATE predict_nonces SET expires_at = clock_timestamp() WHERE nonce = ${pick.nonce}`
        if (change === 'eligibility')
          await client`DELETE FROM predict_terms_acceptances WHERE address = ${f.address}`
        if (change === 'outcome')
          await client`UPDATE matches SET outcomes = '["AWAY","DRAW"]' WHERE id = ${f.matchId}`
      } finally {
        paused.resume()
      }
      await expect(pending).rejects.toMatchObject({
        status:
          change === 'eligibility' ? 403 : change === 'outcome' ? 400 : 409,
      })
      expect(
        await client`SELECT * FROM prediction_audit WHERE address = ${f.address}`,
      ).toHaveLength(change === 'replay' ? 1 : 0)
      await erasePredictData(f.address)
    },
    10_000,
  )

  it('stores real EIP-712 signatures on picks and append-only audit, changes picks, and rejects atomic replay', async () => {
    const f = await pickFixture()
    const first = await f.signed()
    await predictionStore.submit(
      first,
      f.session,
      f.request,
      verifyPickSignature,
    )
    const second = await f.signed('AWAY')
    const attempts = await Promise.allSettled([
      predictionStore.submit(second, f.session, f.request, verifyPickSignature),
      predictionStore.submit(second, f.session, f.request, verifyPickSignature),
    ])
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    const [pick] =
      await client`SELECT * FROM picks WHERE address = ${f.address}`
    expect(pick.outcome).toBe('AWAY')
    expect(pick.signature).toBe(second.signature)
    const audit =
      await client`SELECT * FROM prediction_audit WHERE address = ${f.address} ORDER BY created_at`
    expect(audit.map((row) => row.signature)).toEqual([
      first.signature,
      second.signature,
    ])
    expect(
      await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(0)
    await erasePredictData(f.address)
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    const erased =
      await client`SELECT * FROM prediction_audit WHERE match_id = ${f.matchId}`
    expect(
      erased.every(
        (row) => row.signature === null && row.address.startsWith('erased:'),
      ),
    ).toBe(true)
  })

  it('verifies signatures against configured origin even when the ingress request host differs', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    const ingress = new Request(
      'http://internal-ingress.invalid/api/predict/picks',
      {
        method: 'POST',
        headers: f.request.headers,
      },
    )
    await predictionStore.submit(pick, f.session, ingress, verifyPickSignature)
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(1)
    await erasePredictData(f.address)
  })

  it('rolls back nonce consumption, pick and audit on invalid signatures or audit failure', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    const wrong = privateKeyToAccount(generatePrivateKey())
    const invalid = {
      ...pick,
      signature: await wrong.signTypedData(pickTypedData(origin, 88882, pick)),
    }
    await expect(
      predictionStore.submit(
        invalid,
        f.session,
        f.request,
        verifyPickSignature,
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(
      await client`SELECT * FROM predict_nonces WHERE nonce = ${pick.nonce}`,
    ).toHaveLength(1)
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    await client.unsafe(`
      CREATE FUNCTION sr45_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'SR-45 test audit failure'; END; $$;
      CREATE TRIGGER sr45_test_audit_failure BEFORE INSERT ON prediction_audit
      FOR EACH ROW EXECUTE FUNCTION sr45_test_audit_failure();
    `)
    try {
      await expect(
        predictionStore.submit(pick, f.session, f.request, verifyPickSignature),
      ).rejects.toMatchObject({
        cause: { message: 'SR-45 test audit failure' },
      })
      expect(
        await client`SELECT * FROM predict_nonces WHERE nonce = ${pick.nonce}`,
      ).toHaveLength(1)
      expect(
        await client`SELECT * FROM picks WHERE address = ${f.address}`,
      ).toHaveLength(0)
      expect(
        await client`SELECT * FROM prediction_audit WHERE address = ${f.address}`,
      ).toHaveLength(0)
    } finally {
      await client.unsafe(
        'DROP TRIGGER sr45_test_audit_failure ON prediction_audit; DROP FUNCTION sr45_test_audit_failure()',
      )
    }
    await predictionStore.submit(
      pick,
      f.session,
      f.request,
      verifyPickSignature,
    )
    await erasePredictData(f.address)
  })

  it('rejects expired/replaced challenges and a locked match using database time, not browser time', async () => {
    const f = await pickFixture()
    const first = await f.signed()
    const second = await f.signed('AWAY')
    expect(
      await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(1)
    await expect(
      predictionStore.submit(first, f.session, f.request, verifyPickSignature),
    ).rejects.toMatchObject({ status: 409 })
    await client`UPDATE predict_nonces SET expires_at = clock_timestamp() WHERE nonce = ${second.nonce}`
    await expect(
      predictionStore.submit(second, f.session, f.request, verifyPickSignature),
    ).rejects.toMatchObject({ status: 409 })
    const third = await f.signed()
    await client`UPDATE matches SET lock_at_utc = clock_timestamp() WHERE id = ${f.matchId}`
    await expect(
      predictionStore.submit(third, f.session, f.request, verifyPickSignature),
    ).rejects.toMatchObject({ status: 409 })
    expect(
      await client`SELECT * FROM predict_nonces WHERE nonce = ${third.nonce}`,
    ).toHaveLength(1)
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    await erasePredictData(f.address)
  })

  it('rechecks the deadline after verification before recording server timestamps', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    await client`UPDATE matches SET lock_at_utc = clock_timestamp() + interval '100 milliseconds' WHERE id = ${f.matchId}`
    const slowVerifier = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return true
    }
    await expect(
      predictionStore.submit(pick, f.session, f.request, slowVerifier),
    ).rejects.toMatchObject({ status: 409 })
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM predict_nonces WHERE nonce = ${pick.nonce}`,
    ).toHaveLength(1)
    await erasePredictData(f.address)
  })

  async function waitForBlockedQuery(
    locker: postgres.TransactionSql,
    fragment: string,
  ) {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      await locker`SELECT pg_stat_clear_snapshot()`
      const [row] = await locker`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid()
            AND query ILIKE ${`%${fragment}%`}) AS waiting
      `
      if (row.waiting) return
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error(`No blocked ${fragment} query`)
  }

  async function directErasure(address: string) {
    const eraser = postgres(url!, { max: 1 })
    const pseudonym = `erased:${createHmac('sha256', process.env.PREDICT_ERASURE_SECRET!).update(address).digest('hex')}`
    try {
      await eraser`SELECT erase_predict_data(${address}, ${pseudonym})`
    } finally {
      await eraser.end()
    }
  }

  it('rechecks current eligibility AFTER the match lock and rolls back challenge consumption', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    let attempt!: Promise<unknown>
    await client.begin(async (locker) => {
      await locker`SELECT id FROM matches WHERE id = ${f.matchId} FOR UPDATE`
      attempt = predictionStore.submit(
        pick,
        f.session,
        f.request,
        verifyPickSignature,
      )
      // Attach rejection handler before releasing the competing transaction.
      void attempt.catch(() => {})
      await waitForBlockedQuery(locker, 'matches')
      await locker`DELETE FROM predict_terms_acceptances WHERE address = ${f.address}`
    })
    await expect(attempt).rejects.toMatchObject({ status: 403 })
    expect(
      await client`SELECT * FROM predict_nonces WHERE nonce = ${pick.nonce}`,
    ).toHaveLength(1)
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    await erasePredictData(f.address)
  }, 10_000)

  it('serialises direct database erasure with a first pick even when erasure cannot initially see its match', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    let attempt!: Promise<unknown>
    let erasure!: Promise<void>
    await client.begin(async (locker) => {
      await locker`SELECT id FROM matches WHERE id = ${f.matchId} FOR UPDATE`
      attempt = predictionStore.submit(
        pick,
        f.session,
        f.request,
        verifyPickSignature,
      )
      await waitForBlockedQuery(locker, 'matches')
      erasure = directErasure(f.address)
      await waitForBlockedQuery(locker, 'erase_predict_data')
    })
    await attempt
    await erasure
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(0)
    const audit =
      await client`SELECT * FROM prediction_audit WHERE match_id = ${f.matchId}`
    expect(audit).toHaveLength(1)
    expect(audit[0].signature).toBeNull()
    expect(audit[0].address).toMatch(/^erased:/)
    await expect(
      predictionStore.submit(pick, f.session, f.request, verifyPickSignature),
    ).rejects.toMatchObject({ status: 409 })
  }, 10_000)

  it('serialises direct erasure with challenge issuance so no newly issued nonce survives', async () => {
    const f = await pickFixture()
    let issuance!: ReturnType<typeof predictionStore.issueNonce>
    let erasure!: Promise<void>
    await client.begin(async (locker) => {
      await locker`SELECT id FROM matches WHERE id = ${f.matchId} FOR UPDATE`
      issuance = predictionStore.issueNonce(
        { matchId: f.matchId, outcome: 'HOME' },
        f.session,
        f.request,
      )
      await waitForBlockedQuery(locker, 'matches')
      erasure = directErasure(f.address)
      await waitForBlockedQuery(locker, 'erase_predict_data')
    })
    await issuance
    await erasure
    expect(
      await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM predict_terms_acceptances WHERE address = ${f.address}`,
    ).toHaveLength(0)
    await expect(
      predictionStore.issueNonce(
        { matchId: f.matchId, outcome: 'HOME' },
        f.session,
        f.request,
      ),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(0)
  }, 10_000)

  it('rejects queued first picks and nonce issuance when direct erasure wins the wallet lock', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    let submission!: ReturnType<typeof predictionStore.submit>
    let issuance!: ReturnType<typeof predictionStore.issueNonce>
    const pseudonym = `erased:${createHmac('sha256', process.env.PREDICT_ERASURE_SECRET!).update(f.address).digest('hex')}`
    await client.begin(async (eraser) => {
      await eraser`SELECT erase_predict_data(${f.address}, ${pseudonym})`
      submission = predictionStore.submit(
        pick,
        f.session,
        f.request,
        verifyPickSignature,
      )
      issuance = predictionStore.issueNonce(
        { matchId: f.matchId, outcome: 'HOME' },
        f.session,
        f.request,
      )
      void submission.catch(() => {})
      void issuance.catch(() => {})
      await waitForBlockedQuery(eraser, 'pg_advisory_xact_lock')
    })
    await expect(submission).rejects.toMatchObject({ status: 409 })
    await expect(issuance).rejects.toMatchObject({ status: 403 })
    expect(
      await client`SELECT * FROM picks WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM prediction_audit WHERE address = ${f.address}`,
    ).toHaveLength(0)
    expect(
      await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(0)
  }, 10_000)

  it('uses a real SIWE session and shared limiter for routes, and exposes own points including voids', async () => {
    const f = await pickFixture()
    const authenticated = await authenticatedRequest(f.address)
    const routes = createPredictionRoutes()
    const pick = await f.signed()
    expect((await routes.pick(authenticated(pick))).status).toBe(200)
    const [saved] =
      await client`SELECT updated_at FROM picks WHERE address = ${f.address}`
    const [match] =
      await client`SELECT lock_at_utc FROM matches WHERE id = ${f.matchId}`
    expect(new Date(saved.updated_at).getTime()).toBeLessThan(
      new Date(match.lock_at_utc).getTime(),
    )
    await client`UPDATE matches SET status = 'settled', result = 'HOME' WHERE id = ${f.matchId}`
    await client`INSERT INTO prediction_points (match_id, address, points, week_start_utc, season_id)
      VALUES (${f.matchId}, ${f.address}, 5, now(), 'test')`
    const mine = await (await routes.mine(authenticated({}))).json()
    expect(mine).toMatchObject({
      totalPoints: 5,
      matches: [
        expect.objectContaining({
          id: f.matchId,
          outcome: 'HOME',
          result: 'HOME',
          points: 5,
          status: 'settled',
        }),
      ],
    })
    await client`UPDATE matches SET status = 'voided', result = NULL, void_reason = 'Abandoned' WHERE id = ${f.matchId}`
    const voided = await (await routes.mine(authenticated({}))).json()
    expect(voided).toMatchObject({
      totalPoints: 0,
      matches: [
        expect.objectContaining({
          status: 'voided',
          points: 0,
          voidReason: 'Abandoned',
        }),
      ],
    })
    const [limit] =
      await client`SELECT count FROM predict_rate_limits WHERE address = ${f.address}`
    expect(limit.count).toBe(1)
    const [readLimit] =
      await client`SELECT count FROM predict_rate_limits WHERE address = ${'read:' + f.address}`
    expect(readLimit.count).toBe(2)
    const other =
      privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    expect((await predictionStore.mine(other, null)).matches).toHaveLength(0)
    await erasePredictData(f.address)
  })

  it('bounds challenge retention and removes no more than 100 expired challenges per issuance', async () => {
    const f = await pickFixture()
    const expired = Array.from({ length: 105 }, () =>
      randomBytes(32).toString('hex'),
    )
    await client`INSERT INTO predict_nonces (nonce, address, expires_at)
      SELECT unnest(${expired}::text[]), ${privateKeyToAccount(generatePrivateKey()).address.toLowerCase()}, now() - interval '1 hour'`
    await f.signed()
    const remaining =
      await client`SELECT nonce FROM predict_nonces WHERE nonce = ANY(${expired}::text[])`
    expect(remaining).toHaveLength(5)
    await f.signed()
    expect(
      await client`SELECT nonce FROM predict_nonces WHERE address = ${f.address}`,
    ).toHaveLength(1)
    await client`DELETE FROM predict_nonces WHERE nonce = ANY(${expired}::text[])`
    await erasePredictData(f.address)
  })

  it('issues challenges concurrently without deadlock when two wallets replace expired nonces', async () => {
    const first = await pickFixture()
    const second = await pickFixture()
    await client`INSERT INTO predict_nonces (nonce, address, expires_at) VALUES
      (${randomBytes(32).toString('hex')}, ${first.address}, now() - interval '1 hour'),
      (${randomBytes(32).toString('hex')}, ${second.address}, now() - interval '1 hour')`
    // Pause both own-wallet deletions after they take row locks, so each
    // expiry cleanup must skip the other transaction's locked expired row.
    await client.unsafe(`
      CREATE FUNCTION sr45_nonce_cleanup_barrier() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.address IN ('${first.address}', '${second.address}') THEN
          PERFORM pg_advisory_xact_lock(hashtextextended(OLD.address, 46));
        END IF;
        RETURN OLD;
      END; $$;
      CREATE TRIGGER sr45_nonce_cleanup_barrier AFTER DELETE ON predict_nonces
      FOR EACH ROW EXECUTE FUNCTION sr45_nonce_cleanup_barrier();
    `)
    const attempts: ReturnType<typeof predictionStore.issueNonce>[] = []
    try {
      await client.begin(async (barrier) => {
        await barrier`SELECT pg_advisory_xact_lock(hashtextextended(${first.address}, 46))`
        await barrier`SELECT pg_advisory_xact_lock(hashtextextended(${second.address}, 46))`
        for (const f of [first, second]) {
          const attempt = predictionStore.issueNonce(
            { matchId: f.matchId, outcome: 'HOME' },
            f.session,
            f.request,
          )
          void attempt.catch(() => {})
          attempts.push(attempt)
        }
        const deadline = Date.now() + 5000
        let waiting = 0
        while (Date.now() < deadline) {
          await barrier`SELECT pg_stat_clear_snapshot()`
          const [row] = await barrier`
            SELECT count(*)::int AS waiting FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND wait_event = 'advisory'
              AND pid <> pg_backend_pid()
              AND query ILIKE '%delete%predict_nonces%'
          `
          waiting = row.waiting
          if (waiting === 2) break
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        expect(waiting).toBe(2)
      })
      const issued = await Promise.all(attempts)
      expect(issued).toHaveLength(2)
      expect(issued[0].nonce).not.toBe(issued[1].nonce)
      for (const f of [first, second]) {
        const rows =
          await client`SELECT * FROM predict_nonces WHERE address = ${f.address}`
        expect(rows).toHaveLength(1)
        expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThan(
          Date.now(),
        )
      }
    } finally {
      await Promise.allSettled(attempts)
      await client.unsafe(
        'DROP TRIGGER sr45_nonce_cleanup_barrier ON predict_nonces; DROP FUNCTION sr45_nonce_cleanup_barrier()',
      )
      await erasePredictData(first.address)
      await erasePredictData(second.address)
    }
  }, 10_000)

  it('paginates bounded PostgreSQL match reads and exposes server-derived status and only own picks', async () => {
    const f = await pickFixture()
    const pick = await f.signed()
    await predictionStore.submit(
      pick,
      f.session,
      f.request,
      verifyPickSignature,
    )
    const rows = await predictionStore.list(f.address, null)
    expect(rows.matches.length).toBeLessThanOrEqual(50)
    // Read just this fixture using a timestamp cursor immediately before it.
    const [fixture] =
      await client`SELECT kickoff_utc FROM matches WHERE id = ${f.matchId}`
    const cursor = {
      kickoff: new Date(
        new Date(fixture.kickoff_utc).getTime() - 1,
      ).toISOString(),
      id: randomUUID(),
    }
    expect(
      (await predictionStore.list(f.address, cursor)).matches.find(
        (match) => match.id === f.matchId,
      ),
    ).toMatchObject({ status: 'upcoming', outcome: 'HOME' })
    await client`UPDATE matches SET lock_at_utc = clock_timestamp() WHERE id = ${f.matchId}`
    expect(
      (await predictionStore.list(f.address, cursor)).matches.find(
        (match) => match.id === f.matchId,
      ),
    ).toMatchObject({ status: 'locked' })
    const other =
      privateKeyToAccount(generatePrivateKey()).address.toLowerCase()
    expect(
      (await predictionStore.list(other, cursor)).matches.find(
        (match) => match.id === f.matchId,
      )?.outcome,
    ).toBeNull()
    const ids = Array.from({ length: 55 }, () => randomUUID())
    await client`INSERT INTO matches (id, sport, home_label, away_label, kickoff_utc, lock_at_utc, outcomes, points_for_correct, created_by)
      SELECT unnest(${ids}::uuid[]), 'football', 'Paged first', 'Paged second',
        '2060-01-01'::timestamptz, '2060-01-01'::timestamptz, '["HOME","AWAY"]'::jsonb, 5, ${other}`
    try {
      const first = await predictionStore.list(f.address, {
        kickoff: '2059-01-01T00:00:00.000Z',
        id: randomUUID(),
      })
      expect(first.matches).toHaveLength(50)
      const [kickoff, id] = first.nextCursor!.split(',')
      const second = await predictionStore.list(f.address, { kickoff, id })
      expect(second.matches).toHaveLength(5)
      expect(second.nextCursor).toBeNull()
      expect(
        new Set([...first.matches, ...second.matches].map((match) => match.id))
          .size,
      ).toBe(55)
    } finally {
      await client`DELETE FROM matches WHERE id = ANY(${ids}::uuid[])`
      await erasePredictData(f.address)
    }
  })
})
