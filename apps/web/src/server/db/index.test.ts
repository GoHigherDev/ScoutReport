// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { postgres, drizzle, database } = vi.hoisted(() => {
  const database = { execute: vi.fn() }
  return {
    postgres: vi.fn(() => 'client'),
    drizzle: vi.fn(() => database),
    database,
  }
})

vi.mock('server-only', () => ({}))
vi.mock('postgres', () => ({ default: postgres }))
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllEnvs())

describe('database connection', () => {
  it('requires no configuration or connection until first use', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const { getDatabase } = await import('./index')
    expect(postgres).not.toHaveBeenCalled()
    expect(() => getDatabase()).toThrow('DATABASE_URL is required')
    expect(postgres).not.toHaveBeenCalled()
  })

  it('creates one bounded, lazy connection with pooler-compatible settings', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/scaffold_test')
    const { getDatabase } = await import('./index')
    expect(getDatabase()).toBe(database)
    expect(getDatabase()).toBe(database)
    expect(postgres).toHaveBeenCalledExactlyOnceWith(
      'postgresql://localhost/scaffold_test',
      {
        max: 5,
        idle_timeout: 20,
        connect_timeout: 5,
        prepare: false,
        connection: { statement_timeout: 5000 },
      },
    )
    expect(drizzle).toHaveBeenCalledOnce()
  })
})
