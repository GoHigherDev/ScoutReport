import 'server-only'

export const PREDICT_TERMS_VERSION = '0.3'

const isoCountries = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
    'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
    'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' '),
)

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
    countries.some((value) => !isoCountries.has(value))
  ) {
    throw new Error('PREDICT_BLOCKED_COUNTRIES must contain country codes')
  }
  return new Set(countries)
}

export const trustedPredictCountry = (request: Request): string | null => {
  // Vercel must overwrite this header; direct/non-Vercel ingress is not trusted.
  if (process.env.VERCEL !== '1') return null
  const country = request.headers.get('x-vercel-ip-country')
  return country && isoCountries.has(country) ? country : null
}
