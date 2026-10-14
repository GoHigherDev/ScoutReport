import 'server-only'

export const PREDICT_TERMS_VERSION = '0.3'

// Draft, for counsel to confirm. GB is blocked because country alone cannot
// distinguish Northern Ireland; sanctioned regions use whole-country blocks.
export const DRAFT_BLOCKED_COUNTRIES = [
  'US',
  'AU',
  'NL',
  'IT',
  'FR',
  'BE',
  'GB',
  'AF',
  'BY',
  'MM',
  'CF',
  'CN',
  'CU',
  'CD',
  'HT',
  'IR',
  'IQ',
  'LB',
  'LY',
  'KP',
  'RU',
  'SO',
  'SS',
  'SD',
  'SY',
  'UA',
  'VE',
  'YE',
  'ZW',
] as const

export const blockedPredictCountries = (): ReadonlySet<string> => {
  const configured = process.env.PREDICT_BLOCKED_COUNTRIES
  if (configured === undefined) return new Set(DRAFT_BLOCKED_COUNTRIES)
  const countries = configured.split(',').map((value) => value.trim())
  if (
    !countries.length ||
    countries.some((value) => !/^[A-Z]{2}$/.test(value))
  ) {
    throw new Error('PREDICT_BLOCKED_COUNTRIES must contain country codes')
  }
  return new Set(countries)
}

export const trustedPredictCountry = (request: Request): string | null => {
  // Vercel must overwrite this header; direct/non-Vercel ingress is not trusted.
  if (process.env.VERCEL !== '1') return null
  const country = request.headers.get('x-vercel-ip-country')
  return country && /^[A-Z]{2}$/.test(country) && country !== 'XX'
    ? country
    : null
}
