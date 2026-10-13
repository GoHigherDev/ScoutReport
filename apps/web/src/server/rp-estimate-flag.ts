export function rpEstimateEnabled(): boolean {
  return process.env.FEATURE_RP_ESTIMATE === 'true'
}
