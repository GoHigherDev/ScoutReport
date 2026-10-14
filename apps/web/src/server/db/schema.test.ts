// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  adminAuditLog,
  matches,
  picks,
  predictionPoints,
  profiles,
  siweNonces,
} from './schema'

describe('SR-44 off-chain schema', () => {
  it('indexes season and London-week totals without changing score uniqueness', () => {
    const config = getTableConfig(predictionPoints)
    expect(
      config.indexes.map(({ config }) => ({
        name: config.name,
        columns: config.columns.map((column) =>
          'name' in column ? column.name : undefined,
        ),
        unique: config.unique,
      })),
    ).toEqual([
      {
        name: 'prediction_points_season_address',
        columns: ['season_id', 'address'],
        unique: false,
      },
      {
        name: 'prediction_points_season_week_address',
        columns: ['season_id', 'week_start_utc', 'address'],
        unique: false,
      },
    ])
    expect(config.primaryKeys[0].columns.map((column) => column.name)).toEqual([
      'match_id',
      'address',
    ])
  })

  it('contains the off-chain match, pick and score tables', () => {
    expect(
      [
        profiles,
        siweNonces,
        matches,
        picks,
        predictionPoints,
        adminAuditLog,
      ].map((table) => getTableConfig(table).name),
    ).toEqual([
      'profiles',
      'siwe_nonces',
      'matches',
      'picks',
      'prediction_points',
      'admin_audit_log',
    ])
    expect(
      getTableConfig(matches).columns.map((column) => column.name),
    ).toEqual(
      expect.arrayContaining([
        'sport',
        'home_label',
        'away_label',
        'home_token_key',
        'away_token_key',
        'external_ref',
        'kickoff_utc',
        'lock_at_utc',
        'outcomes',
        'points_for_correct',
        'status',
        'result',
        'void_reason',
        'created_by',
        'settled_at',
        'settled_by',
        'voided_at',
        'voided_by',
      ]),
    )
    expect(
      getTableConfig(matches).columns.map((column) => column.name),
    ).not.toEqual(
      expect.arrayContaining([
        'match_id',
        'chain_id',
        'create_tx',
        'settle_tx',
      ]),
    )
  })

  it('uses one mutable pick per wallet/match and one score row per wallet/match', () => {
    expect(getTableConfig(picks).primaryKeys).toHaveLength(1)
    expect(getTableConfig(picks).columns.map((column) => column.name)).toEqual([
      'match_id',
      'address',
      'outcome',
      'created_at',
      'updated_at',
    ])
    expect(getTableConfig(predictionPoints).primaryKeys).toHaveLength(1)
    expect(
      getTableConfig(predictionPoints).columns.map((column) => column.name),
    ).toEqual([
      'match_id',
      'address',
      'points',
      'week_start_utc',
      'season_id',
      'credited_at',
    ])
  })

  it('uses UTC-aware timestamps, bounded points and a lowercase audit actor', () => {
    for (const column of [
      matches.kickoffUtc,
      matches.lockAtUtc,
      matches.updatedAt,
      picks.updatedAt,
      predictionPoints.weekStartUtc,
      predictionPoints.creditedAt,
      adminAuditLog.createdAt,
    ]) {
      expect(column.getSQLType()).toBe('timestamp with time zone')
    }
    expect(
      getTableConfig(matches).checks.map((constraint) => constraint.name),
    ).toContain('matches_points')
    expect(
      getTableConfig(adminAuditLog).checks.map((constraint) => constraint.name),
    ).toContain('admin_audit_log_actor_lowercase')
    expect(getTableConfig(adminAuditLog).indexes).toHaveLength(0)
  })
})
