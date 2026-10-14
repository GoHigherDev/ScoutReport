import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSiweMessage } from 'viem/siwe'
import { NAMES } from '../copy/names'
import { signIn } from './sign-in'

const { getAccount, signMessage, config } = vi.hoisted(() => ({
  getAccount: vi.fn(),
  signMessage: vi.fn(),
  config: {},
}))
vi.mock('@wagmi/core', () => ({ getAccount, signMessage }))
vi.mock('@scoutreport/chain', () => ({ getDataChain: () => ({ id: 88888 }) }))
vi.mock('./config', () => ({ getWalletConfig: () => config }))

const address = '0x52908400098527886E0F7030069857D2E4169EE7'
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  getAccount.mockReturnValue({ address })
  signMessage.mockResolvedValue('0xabcd')
  fetchMock
    .mockResolvedValueOnce(
      Response.json({
        nonce: 'abcdefgh12345678',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ address, chainId: 88888, isContract: true }),
    )
})
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('signIn', () => {
  it('signs the approved plain-text message on DATA_CHAIN without switching or sending transactions', async () => {
    expect(await signIn()).toMatchObject({ address, chainId: 88888 })
    const [calledConfig, { message, account }] = signMessage.mock.calls[0]!
    expect(calledConfig).toBe(config)
    expect(account).toBe(address)
    expect(parseSiweMessage(message)).toMatchObject({
      domain: window.location.host,
      uri: window.location.origin,
      address,
      chainId: 88888,
      version: '1',
      nonce: 'abcdefgh12345678',
      statement: NAMES.auth.statement,
      issuedAt: expect.any(Date),
      expirationTime: expect.any(Date),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/nonce', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/verify', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature: '0xabcd' }),
    })
  })

  it('does no work when disconnected', async () => {
    getAccount.mockReturnValue({})
    await expect(signIn()).rejects.toThrow(NAMES.auth.sessionRequired)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(signMessage).not.toHaveBeenCalled()
  })

  it('does not sign when nonce issuance fails', async () => {
    fetchMock.mockReset().mockResolvedValue(Response.json({}, { status: 429 }))
    await expect(signIn()).rejects.toThrow(NAMES.auth.unexpectedError)
    expect(signMessage).not.toHaveBeenCalled()
  })

  it('does not verify when signing is rejected', async () => {
    signMessage.mockRejectedValueOnce(new Error('rejected'))
    await expect(signIn()).rejects.toThrow('rejected')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not report a session when verification fails', async () => {
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(
        Response.json({
          nonce: 'abcdefgh12345678',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
    await expect(signIn()).rejects.toThrow(NAMES.auth.sessionRequired)
  })
})
