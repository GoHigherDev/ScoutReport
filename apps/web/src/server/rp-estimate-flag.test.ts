import { afterEach, expect, it, vi } from 'vitest'
import { rpEstimateEnabled } from './rp-estimate-flag'

afterEach(() => vi.unstubAllEnvs())
it.each([undefined, '', 'false', 'TRUE', '1'])(
  'defaults off for FEATURE_RP_ESTIMATE=%s',
  (value) => {
    vi.stubEnv('FEATURE_RP_ESTIMATE', value)
    expect(rpEstimateEnabled()).toBe(false)
  },
)
it('enables only an explicit server-side true', () => {
  vi.stubEnv('FEATURE_RP_ESTIMATE', 'true')
  expect(rpEstimateEnabled()).toBe(true)
})
