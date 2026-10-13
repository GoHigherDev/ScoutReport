// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin } from './admin'
import { toChecksumAddress, toStoredAddress } from './address'

vi.mock('server-only', () => ({}))

const address = '0x52908400098527886E0F7030069857D2E4169EE7'

afterEach(() => vi.unstubAllEnvs())

describe('address boundaries', () => {
  it('stores lowercase and formats checksummed addresses at the edge', () => {
    expect(toStoredAddress(address)).toBe(address.toLowerCase())
    expect(toChecksumAddress(address.toLowerCase())).toBe(address)
  })

  it('rejects malformed addresses', () => {
    expect(() => toStoredAddress('not an address')).toThrow()
  })
})

describe('admin guard', () => {
  it('matches trimmed comma-separated addresses case-insensitively', () => {
    vi.stubEnv('ADMIN_ADDRESSES', ` , ${address.toLowerCase()}, `)
    expect(() => requireAdmin({ address })).not.toThrow()
  })

  it.each([null, undefined])('requires a verified session: %s', (session) => {
    expect(() => requireAdmin(session)).toThrow(
      expect.objectContaining({ status: 401, code: 'UNAUTHORISED' }),
    )
  })

  it('denies a missing allowlist, non-admin or malformed address', () => {
    vi.stubEnv('ADMIN_ADDRESSES', '')
    expect(() => requireAdmin({ address })).toThrow(
      expect.objectContaining({ status: 403, code: 'FORBIDDEN' }),
    )
    vi.stubEnv('ADMIN_ADDRESSES', address)
    expect(() =>
      requireAdmin({ address: '0x0000000000000000000000000000000000000001' }),
    ).toThrow()
    expect(() => requireAdmin({ address: 'bad' })).toThrow()
  })
})
