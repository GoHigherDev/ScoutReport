// @vitest-environment node
import { drizzle } from 'drizzle-orm/pg-proxy'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nonceStore } from './siwe-nonces'

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('./db', () => ({ getDatabase }))

let queries: { sql: string; params: unknown[] }[]
let returnedRows: unknown[][]
const now = new Date('2026-10-13T12:00:00.000Z')
const expiresAt = new Date(now.getTime() + 600_000)

beforeEach(() => {
  queries = []
  returnedRows = []
  getDatabase.mockReturnValue(
    drizzle(async (sql, params) => {
      queries.push({ sql, params })
      return { rows: returnedRows }
    }),
  )
})

describe('SIWE nonce persistence', () => {
  it('disposes of expired rows before issuing a ten-minute challenge', async () => {
    await nonceStore.issue('testnonce', expiresAt, now)
    expect(queries).toHaveLength(2)
    expect(queries[0]!.sql).toMatch(
      /^delete from "siwe_nonces" where "siwe_nonces"."expires_at" <= \$1/,
    )
    expect(queries[0]!.params).toEqual([now.toISOString()])
    expect(queries[1]!.sql).toMatch(/^insert into "siwe_nonces"/)
    expect(queries[1]!.params).toEqual(['testnonce', expiresAt.toISOString()])
  })

  it('reads one nonce with its timestamp and use state', async () => {
    returnedRows = [
      ['testnonce', now.toISOString(), expiresAt.toISOString(), null],
    ]
    expect(await nonceStore.find('testnonce')).toEqual({
      nonce: 'testnonce',
      createdAt: now,
      expiresAt,
      usedAt: null,
    })
    expect(queries[0]!.sql).toContain('"siwe_nonces"."nonce" = $1')
    expect(queries[0]!.params).toEqual(['testnonce', 1])
  })

  it.each([true, false])(
    'consumes only an unused, unexpired row atomically: %s',
    async (success) => {
      returnedRows = success ? [['testnonce']] : []
      expect(await nonceStore.consume('testnonce', now)).toBe(success)
      expect(queries).toHaveLength(1)
      expect(queries[0]!.sql).toMatch(
        /^update "siwe_nonces" set "used_at" = \$1 where/,
      )
      expect(queries[0]!.sql).toContain('"siwe_nonces"."nonce" = $2')
      expect(queries[0]!.sql).toContain('"siwe_nonces"."used_at" is null')
      expect(queries[0]!.sql).toContain('"siwe_nonces"."expires_at" > $3')
      expect(queries[0]!.sql).toContain('returning "nonce"')
      expect(queries[0]!.params).toEqual([
        now.toISOString(),
        'testnonce',
        now.toISOString(),
      ])
    },
  )
})
