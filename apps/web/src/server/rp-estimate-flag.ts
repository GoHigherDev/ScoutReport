export function rpEstimateEnabled(): boolean {
  const production =
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.VERCEL_ENV !== 'preview')
  return (
    process.env.FEATURE_RP_ESTIMATE === 'true' &&
    (!production || process.env.RP_ESTIMATE_LEGAL_SIGNOFF === 'true')
  )
}
