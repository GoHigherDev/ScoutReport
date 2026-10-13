import { describe, expect, it } from 'vitest'
import {
  estimateRp,
  RP_CALIBRATIONS,
  RP_POLICY,
  usableCalibration,
  type RpCalibration,
  type RpSnapshot,
} from './rp-model'

const now = Date.parse('2026-10-13T12:00:00Z')
// Synthetic calibration only: these numbers are not measured RP or production defaults.
const calibration: RpCalibration = {
  tokenKey: 'test',
  theta: 1234,
  distinctWallets: 5,
  reportDays: 7,
  reports: 10,
  holdoutError: 0.25,
  windowStart: '2026-09-29T00:00:00Z',
  windowEnd: '2026-10-13T00:00:00Z',
  calibratedAt: '2026-10-13T01:00:00Z',
  blockNumber: 20n,
  poolStake: 100_000_000n,
  maxPoolDrift: 0.1,
  residuals: [-0.2, -0.1, -0.08, -0.05, -0.01, 0.01, 0.05, 0.08, 0.1, 0.2],
}
const snapshot: RpSnapshot = {
  stake: 2_000_000n,
  poolStake: 100_000_000n,
  decimals: 6,
  blockNumber: 15n,
  blockHash: 'synthetic',
  boundary: Date.parse('2026-10-13T00:00:00Z'),
  readAt: now - 3600_000,
  upgraded: false,
}
const input = {
  enabled: true,
  eligibility: 'declared-socios' as const,
  tokenKey: 'test',
  held: 3_000_000n,
  staked: 2_000_000n,
  decimals: 6,
  calibration,
  snapshot,
  now,
}

describe('RP model', () => {
  it('ships no pool parameter or real calibration', () => {
    expect(RP_CALIBRATIONS).toEqual([])
    expect(RP_POLICY).toEqual({
      minWallets: 5,
      minReportDays: 7,
      maxHoldoutError: 0.25,
      windowDays: 14,
      staleAfterMs: 86400_000,
    })
  })
  it.each([
    { distinctWallets: 4 },
    { reportDays: 6 },
    { holdoutError: 0.251 },
    { theta: Number.NaN },
    { theta: 0 },
    { residuals: [] },
    { calibratedAt: '2026-10-14T00:00:00Z' },
    { windowStart: '2026-09-28T00:00:00Z' },
  ])('rejects insufficient or invalid calibration %j', (change) => {
    expect(usableCalibration({ ...calibration, ...change }, now)).toBe(false)
    expect(
      estimateRp({ ...input, calibration: { ...calibration, ...change } }),
    ).toEqual({ state: 'empty' })
  })
  it('gates disabled, undeclared and uncalibrated estimates', () => {
    expect(estimateRp({ ...input, enabled: false })).toEqual({ state: 'empty' })
    expect(estimateRp({ ...input, eligibility: 'unknown' })).toEqual({
      state: 'undeclared',
    })
    expect(estimateRp({ ...input, calibration: undefined })).toEqual({
      state: 'empty',
    })
  })
  it('uses six-decimal S/T × theta, two significant figures, and held plus staked as the per-token denominator', () => {
    const result = estimateRp(input)
    expect(result.state).toBe('estimate')
    if (result.state !== 'estimate') throw new Error('Expected an estimate')
    expect(result.perToken).toEqual({
      kind: 'estimate',
      central: 4.9,
      low: 4.4,
      high: 5.6,
    })
    expect(result).not.toHaveProperty('total')
    expect(result.perToken.low).toBeLessThanOrEqual(result.perToken.central)
    expect(result.perToken.high).toBeGreaterThanOrEqual(result.perToken.central)
    expect(result.widened).toBe(false)
  })
  it.each([
    { held: 999_999n, staked: 0n },
    { staked: 999_999n },
    { snapshot: { ...snapshot, stake: 999_999n } },
  ])(
    'does not estimate holdings or active stake below one whole token %#',
    (change) => {
      expect(estimateRp({ ...input, ...change })).toEqual({
        state: 'ineligible',
      })
    },
  )
  it.each([
    { snapshot: undefined },
    { snapshot: { ...snapshot, upgraded: true } },
    { snapshot: { ...snapshot, decimals: 18 } },
    { snapshot: { ...snapshot, poolStake: 0n } },
    { snapshot: { ...snapshot, boundary: 0 } },
    { snapshot: { ...snapshot, readAt: Number.NaN } },
    { snapshot: { ...snapshot, readAt: now + 1 } },
  ])('hides failed, upgraded or inconsistent snapshots %#', (change) => {
    expect(estimateRp({ ...input, ...change })).toEqual({
      state: 'unavailable',
    })
  })
  it.each([{ eligibility: 'external' as const }, { tokenKey: 'CHZ' }])(
    'gives external wallets and CHZ only zero, never eligible %j',
    (change) => {
      const result = estimateRp({
        ...input,
        ...change,
        calibration: undefined,
        snapshot: undefined,
      })
      expect(result).toEqual({
        state: 'estimate',
        eligible: false,
        widened: false,
        perToken: { kind: 'estimate', central: 0, low: 0, high: 0 },
      })
    },
  )
  it('widens from P10/P90 to P5/P95 for stale calibration/reads or supplied/pool drift', () => {
    const normal = estimateRp(input)
    const stale = estimateRp({
      ...input,
      calibration: {
        ...calibration,
        calibratedAt: '2026-10-12T00:00:00Z',
        windowEnd: '2026-10-12T00:00:00Z',
      },
    })
    const drift = estimateRp({
      ...input,
      calibration: { ...calibration, poolStake: 80_000_000n },
    })
    const alert = estimateRp({
      ...input,
      calibration: { ...calibration, driftAlert: true },
    })
    const staleRead = estimateRp({
      ...input,
      snapshot: { ...snapshot, readAt: now - RP_POLICY.staleAfterMs },
    })
    for (const result of [stale, drift, alert, staleRead]) {
      expect(result.state).toBe('estimate')
      if (result.state !== 'estimate' || normal.state !== 'estimate')
        throw new Error('Expected estimates')
      expect(result.widened).toBe(true)
      expect(result.perToken.low).toBeLessThan(normal.perToken.low)
      expect(result.perToken.high).toBeGreaterThan(normal.perToken.high)
      expect(result.perToken.central).toBe(normal.perToken.central)
    }
  })
  it('uses multiplicative holdout log residuals with small-sample inflation', () => {
    const residuals = Array.from({ length: 10 }, (_, index) =>
      index < 5 ? Math.log(0.8) : Math.log(1.2),
    )
    const result = estimateRp({
      ...input,
      calibration: { ...calibration, residuals },
    })
    expect(result.state).toBe('estimate')
    if (result.state !== 'estimate') throw new Error('Expected an estimate')
    expect(result.perToken.low).toBe(
      Number(((24.68 * 0.8 ** Math.sqrt(1.2)) / 5).toPrecision(2)),
    )
    expect(result.perToken.high).toBe(
      Number(((24.68 * 1.2 ** Math.sqrt(1.2)) / 5).toPrecision(2)),
    )
    const scaled = estimateRp({
      ...input,
      calibration: { ...calibration, theta: 12340, residuals },
    })
    if (scaled.state !== 'estimate') throw new Error('Expected an estimate')
    expect(scaled.perToken.low).toBe(result.perToken.low * 10)
    expect(scaled.perToken.high).toBe(result.perToken.high * 10)
  })
  it('hides exponential overflow and indeterminate quantiles', () => {
    for (const residuals of [
      Array<number>(10).fill(1000),
      [-Number.MAX_VALUE, ...Array<number>(9).fill(Number.MAX_VALUE)],
    ]) {
      expect(
        estimateRp({ ...input, calibration: { ...calibration, residuals } }),
      ).toEqual({ state: 'unavailable' })
    }
    expect(
      estimateRp({
        ...input,
        calibration: {
          ...calibration,
          theta: Number.MAX_VALUE,
          residuals: Array<number>(10).fill(0),
        },
        snapshot: { ...snapshot, stake: snapshot.poolStake },
      }),
    ).toEqual({ state: 'unavailable' })
  })
})
