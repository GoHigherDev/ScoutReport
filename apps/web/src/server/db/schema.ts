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
  uniqueIndex,
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
    uniqueIndex('admin_audit_log_match_transaction')
      .on(
        sql`(${table.payload}->>'chainId')`,
        table.action,
        sql`lower(${table.payload}->>'txHash')`,
      )
      .where(
        sql`${table.action} IN ('matches.createMatch', 'matches.settle', 'matches.voidMatch', 'matches.creditPoints') AND ${table.payload}->>'txHash' IS NOT NULL`,
      ),
  ],
)

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey(),
    matchId: text('match_id').notNull().unique(),
    sport: text('sport').$type<'football' | 'cs2'>().notNull(),
    sides: jsonb('sides')
      .$type<{ name: string; tokenKey: string | null }[]>()
      .notNull(),
    kickoff: time('kickoff').notNull(),
    lockTime: time('lock_time').notNull(),
    outcomes: jsonb('outcomes').$type<string[]>().notNull(),
    pointsForCorrect: integer('points_for_correct').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
  },
  (table) => [
    check('matches_match_id', sql`${table.matchId} ~ '^0x[0-9a-f]{64}$'`),
    check('matches_sport', sql`${table.sport} IN ('football', 'cs2')`),
    check('matches_lock_time', sql`${table.lockTime} <= ${table.kickoff}`),
    check('matches_points', sql`${table.pointsForCorrect} BETWEEN 1 AND 100`),
    check(
      'matches_sides',
      sql`(jsonb_typeof(${table.sides}) = 'array' AND jsonb_array_length(${table.sides}) = 2 AND jsonb_typeof(${table.sides}->0->'name') = 'string' AND length(trim(${table.sides}->0->>'name')) > 0 AND jsonb_typeof(${table.sides}->1->'name') = 'string' AND length(trim(${table.sides}->1->>'name')) > 0 AND jsonb_typeof(${table.sides}->0->'tokenKey') IN ('string', 'null') AND jsonb_typeof(${table.sides}->1->'tokenKey') IN ('string', 'null')) IS TRUE`,
    ),
    check(
      'matches_outcomes',
      sql`(jsonb_typeof(${table.outcomes}) = 'array' AND jsonb_array_length(${table.outcomes}) BETWEEN 2 AND 3 AND jsonb_typeof(${table.outcomes}->0) = 'string' AND jsonb_typeof(${table.outcomes}->1) = 'string' AND length(trim(${table.outcomes}->>0)) > 0 AND length(trim(${table.outcomes}->>1)) > 0 AND ${table.outcomes}->>0 <> ${table.outcomes}->>1 AND (jsonb_array_length(${table.outcomes}) = 2 OR (jsonb_typeof(${table.outcomes}->2) = 'string' AND length(trim(${table.outcomes}->>2)) > 0 AND ${table.outcomes}->>2 <> ${table.outcomes}->>0 AND ${table.outcomes}->>2 <> ${table.outcomes}->>1))) IS TRUE`,
    ),
  ],
)
