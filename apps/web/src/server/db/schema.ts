import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

const citext = customType<{ data: string }>({ dataType: () => 'citext' })
const time = (name: string) => timestamp(name, { withTimezone: true })

export const profiles = pgTable(
  'profiles',
  {
    address: text('address').primaryKey(),
    username: citext('username').unique(),
    showHoldings: boolean('show_holdings').notNull().default(false),
    claimedChainId: integer('claimed_chain_id'),
    claimedAt: time('claimed_at'),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'profiles_address_lowercase',
      sql`${table.address} ~ '^0x[0-9a-f]{40}$'`,
    ),
  ],
)

export const siweNonces = pgTable('siwe_nonces', {
  nonce: text('nonce').primaryKey(),
  createdAt: time('created_at').notNull().defaultNow(),
  expiresAt: time('expires_at').notNull(),
  usedAt: time('used_at'),
})

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorAddress: text('actor_address').notNull(),
    action: text('action').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (table) => [
    check(
      'admin_audit_log_actor_lowercase',
      sql`${table.actorAddress} ~ '^0x[0-9a-f]{40}$'`,
    ),
  ],
)
