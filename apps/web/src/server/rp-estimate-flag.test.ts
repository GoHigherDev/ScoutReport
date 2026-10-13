import { afterEach, describe, expect, it, vi } from 'vitest'
import { rpEstimateEnabled } from './rp-estimate-flag'

afterEach(() => vi.unstubAllEnvs())
const invalidValues = [
  undefined,
  '',
  'false',
  'FALSE',
  'TRUE',
  'True',
  '1',
  ' true ',
]
const environments = [
  { vercel: 'production', node: 'test', production: true },
  { vercel: 'production', node: 'production', production: true },
  { vercel: undefined, node: 'production', production: true },
  { vercel: '', node: 'production', production: true },
  { vercel: 'unknown', node: 'production', production: true },
  { vercel: 'development', node: 'production', production: true },
  { vercel: 'preview', node: 'production', production: false },
  { vercel: 'preview', node: 'test', production: false },
  { vercel: 'development', node: 'development', production: false },
  { vercel: undefined, node: 'development', production: false },
  { vercel: undefined, node: 'test', production: false },
]

describe.each(environments)(
  'VERCEL_ENV=$vercel, NODE_ENV=$node',
  ({ vercel, node, production }) => {
    function setEnvironment() {
      vi.stubEnv('VERCEL_ENV', vercel)
      vi.stubEnv('NODE_ENV', node)
    }

    it.each(invalidValues)(
      'defaults off for FEATURE_RP_ESTIMATE=%s even with legal sign-off',
      (value) => {
        setEnvironment()
        vi.stubEnv('FEATURE_RP_ESTIMATE', value)
        vi.stubEnv('RP_ESTIMATE_LEGAL_SIGNOFF', 'true')
        expect(rpEstimateEnabled()).toBe(false)
      },
    )

    it.each(invalidValues)(
      'requires exact legal sign-off only in production (sign-off=%s)',
      (value) => {
        setEnvironment()
        vi.stubEnv('FEATURE_RP_ESTIMATE', 'true')
        vi.stubEnv('RP_ESTIMATE_LEGAL_SIGNOFF', value)
        expect(rpEstimateEnabled()).toBe(!production)
      },
    )

    it('enables with both exact server-side opt-ins', () => {
      setEnvironment()
      vi.stubEnv('FEATURE_RP_ESTIMATE', 'true')
      vi.stubEnv('RP_ESTIMATE_LEGAL_SIGNOFF', 'true')
      expect(rpEstimateEnabled()).toBe(true)
    })
  },
)
