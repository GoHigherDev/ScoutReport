import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { MAX_POINTS_PER_CORRECT } from '../../lib/admin-match-constants'

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

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sport: text('sport').$type<'football' | 'cs2'>().notNull(),
    homeLabel: text('home_label').notNull(),
    awayLabel: text('away_label').notNull(),
    homeTokenKey: text('home_token_key'),
    awayTokenKey: text('away_token_key'),
    externalRef: text('external_ref'),
    kickoffUtc: time('kickoff_utc').notNull(),
    lockAtUtc: time('lock_at_utc').notNull(),
    outcomes: jsonb('outcomes').$type<string[]>().notNull(),
    pointsForCorrect: integer('points_for_correct').notNull(),
    status: text('status')
      .$type<'open' | 'settled' | 'voided'>()
      .notNull()
      .default('open'),
    result: text('result'),
    voidReason: text('void_reason'),
    createdBy: text('created_by').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
    settledAt: time('settled_at'),
    settledBy: text('settled_by'),
    voidedAt: time('voided_at'),
    voidedBy: text('voided_by'),
  },
  (table) => [
    check('matches_sport', sql`${table.sport} IN ('football', 'cs2')`),
    check('matches_lock_at', sql`${table.lockAtUtc} <= ${table.kickoffUtc}`),
    check(
      'matches_points',
      sql`${table.pointsForCorrect} BETWEEN 1 AND ${sql.raw(String(MAX_POINTS_PER_CORRECT))}`,
    ),
    check(
      'matches_outcomes',
      sql`CASE WHEN jsonb_typeof(${table.outcomes}) = 'array' THEN (jsonb_array_length(${table.outcomes}) BETWEEN 2 AND 3 AND jsonb_typeof(${table.outcomes}->0) = 'string' AND jsonb_typeof(${table.outcomes}->1) = 'string' AND length(trim(${table.outcomes}->>0)) > 0 AND length(trim(${table.outcomes}->>1)) > 0 AND ${table.outcomes}->>0 <> ${table.outcomes}->>1 AND (jsonb_array_length(${table.outcomes}) = 2 OR (jsonb_typeof(${table.outcomes}->2) = 'string' AND length(trim(${table.outcomes}->>2)) > 0 AND ${table.outcomes}->>2 <> ${table.outcomes}->>0 AND ${table.outcomes}->>2 <> ${table.outcomes}->>1))) ELSE false END`,
    ),
    check(
      'matches_status',
      sql`${table.status} IN ('open', 'settled', 'voided')`,
    ),
    check(
      'matches_status_result',
      sql`(${table.status} = 'settled' AND ${table.result} IS NOT NULL AND ${table.outcomes} ? ${table.result} OR ${table.status} <> 'settled' AND ${table.result} IS NULL)`,
    ),
    check(
      'matches_void_reason',
      sql`(${table.status} = 'voided' AND ${table.voidReason} IS NOT NULL AND length(trim(${table.voidReason})) > 0 OR ${table.status} <> 'voided' AND ${table.voidReason} IS NULL)`,
    ),
    check(
      'matches_created_by_lowercase',
      sql`${table.createdBy} ~ '^0x[0-9a-f]{40}$'`,
    ),
    uniqueIndex('matches_id_created').on(table.createdAt, table.id),
  ],
)

export const picks = pgTable(
  'picks',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    outcome: text('outcome').notNull(),
    createdAt: time('created_at').notNull().defaultNow(),
    updatedAt: time('updated_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.address] }),
    check(
      'picks_address_lowercase',
      sql`${table.address} ~ '^0x[0-9a-f]{40}$'`,
    ),
  ],
)

export const predictionPoints = pgTable(
  'prediction_points',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    points: integer('points').notNull(),
    weekStartUtc: time('week_start_utc').notNull(),
    seasonId: text('season_id').notNull(),
    creditedAt: time('credited_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.address] }),
    check(
      'prediction_points_address_lowercase',
      sql`${table.address} ~ '^0x[0-9a-f]{40}$'`,
    ),
    check('prediction_points_positive', sql`${table.points} > 0`),
  ],
)
