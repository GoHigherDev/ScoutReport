export const RP_POLICY = {
  minWallets: 5,
  minReportDays: 7,
  maxHoldoutError: 0.25,
  windowDays: 14,
  staleAfterMs: 24 * 60 * 60 * 1000,
} as const

export type RpCalibration = Readonly<{
  tokenKey: string
  theta: number
  distinctWallets: number
  reportDays: number
  reports: number
  holdoutError: number
  windowStart: string
  windowEnd: string
  calibratedAt: string
  blockNumber: bigint
  poolStake: bigint
  maxPoolDrift: number
  driftAlert?: boolean
  // Holdout log residuals: ln(actual RP / predicted RP).
  residuals: readonly number[]
}>

// No real calibration has been supplied. Policy thresholds are never RP rates.
export const RP_CALIBRATIONS: readonly RpCalibration[] = []

export type RpField = Readonly<{
  kind: 'estimate'
  central: number
  low: number
  high: number
}>

export type RpSnapshot = {
  stake: bigint
  poolStake: bigint
  decimals: number
  blockNumber: bigint
  blockHash: string
  boundary: number
  readAt: number
  upgraded: boolean
}

export type RpResult =
  | { state: 'empty' | 'undeclared' | 'ineligible' | 'unavailable' }
  | {
      state: 'estimate'
      perToken: RpField
      widened: boolean
      calibration?: RpCalibration
      snapshot?: RpSnapshot
      eligible: boolean
    }

export function usableCalibration(calibration: RpCalibration, now: number) {
  const start = Date.parse(calibration.windowStart)
  const end = Date.parse(calibration.windowEnd)
  const calibrated = Date.parse(calibration.calibratedAt)
  return (
    Number.isInteger(calibration.distinctWallets) &&
    Number.isInteger(calibration.reportDays) &&
    Number.isInteger(calibration.reports) &&
    calibration.distinctWallets >= RP_POLICY.minWallets &&
    calibration.reportDays >= RP_POLICY.minReportDays &&
    calibration.reportDays <= RP_POLICY.windowDays &&
    calibration.reports >=
      Math.max(calibration.distinctWallets, calibration.reportDays) &&
    Number.isFinite(calibration.holdoutError) &&
    calibration.holdoutError >= 0 &&
    calibration.holdoutError <= RP_POLICY.maxHoldoutError &&
    Number.isFinite(calibration.theta) &&
    calibration.theta > 0 &&
    calibration.poolStake > 0n &&
    Number.isFinite(calibration.maxPoolDrift) &&
    calibration.maxPoolDrift >= 0 &&
    calibration.blockNumber >= 0n &&
    start < end &&
    end - start <= RP_POLICY.windowDays * 86400_000 &&
    end <= calibrated &&
    calibrated <= now &&
    calibration.residuals.length >= calibration.reports &&
    calibration.residuals.every(Number.isFinite)
  )
}

export const round2sf = (value: number) =>
  value === 0 ? 0 : Number(value.toPrecision(2))

function field(central: number, low: number, high: number): RpField {
  return {
    kind: 'estimate',
    central: round2sf(central),
    low: round2sf(Math.max(0, Math.min(low, central))),
    high: round2sf(Math.max(high, central)),
  }
}

function quantile(sorted: readonly number[], fraction: number) {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  return (
    sorted[lower] +
    (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower)
  )
}

export function estimateRp(input: {
  enabled: boolean
  eligibility: 'declared-socios' | 'external' | 'unknown'
  tokenKey: string
  held: bigint
  staked: bigint
  decimals: number
  calibration?: RpCalibration
  snapshot?: RpSnapshot
  now: number
}): RpResult {
  if (!input.enabled) return { state: 'empty' }
  if (input.eligibility === 'unknown') return { state: 'undeclared' }
  if (
    input.eligibility === 'external' ||
    input.tokenKey.toUpperCase() === 'CHZ'
  ) {
    return {
      state: 'estimate',
      perToken: field(0, 0, 0),
      widened: false,
      eligible: false,
    }
  }
  if (
    !Number.isInteger(input.decimals) ||
    input.decimals < 0 ||
    input.decimals > 255
  )
    return { state: 'unavailable' }
  const whole = 10n ** BigInt(input.decimals)
  const holdings = input.held + input.staked
  if (holdings < whole || input.staked < whole) return { state: 'ineligible' }
  const calibration = input.calibration
  if (
    !calibration ||
    calibration.tokenKey !== input.tokenKey ||
    !usableCalibration(calibration, input.now)
  )
    return { state: 'empty' }
  const snapshot = input.snapshot
  if (
    !snapshot ||
    snapshot.upgraded ||
    snapshot.poolStake <= 0n ||
    snapshot.decimals !== input.decimals ||
    snapshot.stake < 0n ||
    snapshot.stake > snapshot.poolStake ||
    !Number.isFinite(snapshot.readAt) ||
    snapshot.readAt > input.now ||
    snapshot.boundary !== Math.floor(input.now / 86400_000) * 86400_000
  )
    return { state: 'unavailable' }
  if (snapshot.stake < whole) return { state: 'ineligible' }
  const central =
    (Number(snapshot.stake) / Number(snapshot.poolStake)) * calibration.theta
  const heldTokens = Number(holdings) / Number(whole)
  if (!Number.isFinite(central) || !Number.isFinite(heldTokens))
    return { state: 'unavailable' }
  const drift = Math.abs(
    Number(snapshot.poolStake) / Number(calibration.poolStake) - 1,
  )
  const widened =
    input.now - Date.parse(calibration.calibratedAt) >=
      RP_POLICY.staleAfterMs ||
    input.now - snapshot.readAt >= RP_POLICY.staleAfterMs ||
    calibration.driftAlert === true ||
    drift > calibration.maxPoolDrift
  const residuals = [...calibration.residuals].sort((a, b) => a - b)
  const inflation = Math.sqrt(1 + 1 / calibration.distinctWallets)
  const low =
    central * Math.exp(quantile(residuals, widened ? 0.05 : 0.1) * inflation)
  const high =
    central * Math.exp(quantile(residuals, widened ? 0.95 : 0.9) * inflation)
  if (
    ![
      central,
      low,
      high,
      central / heldTokens,
      low / heldTokens,
      high / heldTokens,
    ].every(
      (value) => Number.isFinite(value) && Number.isFinite(round2sf(value)),
    )
  )
    return { state: 'unavailable' }
  return {
    state: 'estimate',
    eligible: true,
    widened,
    calibration,
    snapshot,
    perToken: field(central / heldTokens, low / heldTokens, high / heldTokens),
  }
}
