// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { PgDialect } from 'drizzle-orm/pg-core'
import { adminAuditLog, profiles, siweNonces } from './schema'

describe('initial schema', () => {
  it('contains only the three scaffold tables and minimal profile fields', () => {
    expect(
      [profiles, siweNonces, adminAuditLog].map(
        (table) => getTableConfig(table).name,
      ),
    ).toEqual(['profiles', 'siwe_nonces', 'admin_audit_log'])
    expect(
      getTableConfig(profiles).columns.map((column) => column.name),
    ).toEqual([
      'address',
      'username',
      'show_holdings',
      'claimed_chain_id',
      'claimed_at',
      'updated_at',
    ])
    expect(profiles.address.primary).toBe(true)
    expect(profiles.username.getSQLType()).toBe('citext')
    expect(profiles.username.isUnique).toBe(true)
    expect(profiles.showHoldings.default).toBe(false)
    expect(profiles.showHoldings.notNull).toBe(true)
  })

  it('enforces valid lowercase profile and audit addresses in Postgres', () => {
    const dialect = new PgDialect()
    for (const table of [profiles, adminAuditLog]) {
      const [constraint] = getTableConfig(table).checks
      expect(dialect.sqlToQuery(constraint.value).sql).toContain(
        "~ '^0x[0-9a-f]{40}$'",
      )
    }
  })

  it('uses timezone-aware timestamps and explicit nonce expiry', () => {
    for (const column of [
      profiles.claimedAt,
      profiles.updatedAt,
      siweNonces.createdAt,
      siweNonces.expiresAt,
      siweNonces.usedAt,
      adminAuditLog.createdAt,
    ]) {
      expect(column.getSQLType()).toBe('timestamp with time zone')
    }
    expect(siweNonces.nonce.primary).toBe(true)
    expect(siweNonces.expiresAt.notNull).toBe(true)
    expect(adminAuditLog.payload.getSQLType()).toBe('jsonb')
  })
})
