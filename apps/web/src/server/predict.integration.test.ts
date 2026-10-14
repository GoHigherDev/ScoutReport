// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto'
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
    await client`INSERT INTO predict_rate_limits (address, count, expires_at) VALUES (${address}, 1, now() + interval '1 minute')`
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
})
