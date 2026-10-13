// @vitest-environment node
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  serializeErc6492Signature,
  zeroAddress,
  type Address,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { SIWE_STATEMENT } from '../copy/auth'
import { requireAdmin } from './admin'
import { createAuthRoutes } from './auth'
import { getVerifiedSession, readSession, SESSION_TTL } from './session'

const { nonceStore, getPublicClient } = vi.hoisted(() => ({
  nonceStore: { issue: vi.fn(), find: vi.fn(), consume: vi.fn() },
  getPublicClient: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('./siwe-nonces', () => ({ nonceStore }))
vi.mock('@scoutreport/chain', () => ({ getPublicClient }))

const origin = 'https://localhost'
const owner = privateKeyToAccount(generatePrivateKey())
const other = privateKeyToAccount(generatePrivateKey())
let anvil: ChildProcess
let contractAddress: Address
let client: ReturnType<typeof createPublicClient>
let verify: ReturnType<typeof vi.spyOn>
let getCode: ReturnType<typeof vi.spyOn>
let routes: ReturnType<typeof createAuthRoutes>
let rows: Map<
  string,
  { nonce: string; createdAt: Date; expiresAt: Date; usedAt: Date | null }
>

const request = (
  path: string,
  body?: string,
  cookie?: string,
  requestOrigin = origin,
) =>
  new Request(`${origin}/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: requestOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body,
  })
const cookieFrom = (response: Response) =>
  response.headers.get('Set-Cookie')!.split(';')[0]!

beforeAll(async () => {
  const contractsDir = fileURLToPath(
    new URL('../../../../packages/contracts/', import.meta.url),
  )
  execFileSync('forge', ['build'], { cwd: contractsDir, stdio: 'pipe' })
  const artifact = JSON.parse(
    readFileSync(
      `${contractsDir}/out/MockERC1271.sol/MockERC1271.json`,
      'utf8',
    ),
  )
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  anvil = spawn(
    'anvil',
    [
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--chain-id',
      '88888',
      '--silent',
    ],
    {
      stdio: 'ignore',
    },
  )
  const chain = defineChain({
    id: 88888,
    name: 'Local SIWE test',
    nativeCurrency: { name: 'Test', symbol: 'TEST', decimals: 18 },
    rpcUrls: { default: { http: [`http://127.0.0.1:${port}`] } },
  })
  client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0], { retryCount: 0 }),
  })
  await vi.waitFor(() => client.getChainId(), { timeout: 5000 })
  const wallet = createWalletClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  })
  const [deployer] = await wallet.getAddresses()
  const hash = await wallet.deployContract({
    account: deployer!,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [owner.address],
  })
  const receipt = await client.waitForTransactionReceipt({ hash })
  contractAddress = receipt.contractAddress!
}, 60_000)

afterAll(() => anvil?.kill())
beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', randomBytes(32).toString('hex'))
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
  vi.stubEnv('NODE_ENV', 'test')
  rows = new Map()
  nonceStore.issue.mockImplementation(async (nonce, expiresAt, now) => {
    rows.set(nonce, { nonce, createdAt: now, expiresAt, usedAt: null })
  })
  nonceStore.find.mockImplementation(async (nonce) => rows.get(nonce))
  nonceStore.consume.mockImplementation(async (nonce, now) => {
    const row = rows.get(nonce)
    if (!row || row.usedAt || row.expiresAt <= now) return false
    row.usedAt = now
    return true
  })
  getPublicClient.mockReturnValue(client)
  verify = vi.spyOn(client, 'verifySiweMessage')
  getCode = vi.spyOn(client, 'getCode')
  routes = createAuthRoutes({
    rateLimiter: { consume: () => ({ allowed: true, retryAfter: 0 }) },
    rateLimitKey: () => 'trusted-test-key',
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

async function challenge(
  address: Address = owner.address,
  overrides: Record<string, unknown> = {},
) {
  const response = await routes.nonce(request('nonce'))
  expect(response.status).toBe(200)
  const { nonce, expiresAt } = await response.json()
  const message = createSiweMessage({
    domain: 'localhost',
    uri: origin,
    address,
    version: '1',
    chainId: 88888,
    nonce,
    issuedAt: new Date(),
    expirationTime: new Date(expiresAt),
    statement: SIWE_STATEMENT,
    ...overrides,
  })
  return { nonce, message, cookie: cookieFrom(response), response }
}
async function sign(
  data: Awaited<ReturnType<typeof challenge>>,
  signer = owner,
) {
  const signature = await signer.signMessage({ message: data.message })
  return JSON.stringify({ message: data.message, signature })
}

describe('SIWE auth routes with local signature verification', () => {
  it('issues random, browser-bound nonces with a ten-minute expiry', async () => {
    const first = await challenge()
    const second = await challenge()
    expect(first.nonce).toMatch(/^[a-f0-9]{64}$/)
    expect(second.nonce).not.toBe(first.nonce)
    const row = rows.get(first.nonce)!
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(600_000)
    expect(
      await getVerifiedSession(request('me', undefined, first.cookie)),
    ).toBeNull()
    expect(first.response.headers.get('Cache-Control')).toBe('no-store')
  })

  it.each([88888, 88882])(
    'verifies an EOA and exposes a verified admin-compatible session on %s',
    async (chainId) => {
      const data = await challenge(owner.address, { chainId })
      const response = await routes.verify(
        request('verify', await sign(data), data.cookie),
      )
      expect(response.status).toBe(200)
      expect(getPublicClient).toHaveBeenCalledWith(chainId)
      expect(verify).toHaveBeenCalledOnce()
      expect(rows.get(data.nonce)!.usedAt).toBeInstanceOf(Date)
      const cookie = response.headers.get('Set-Cookie')!
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Secure')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).toContain('Max-Age=604800')
      expect(cookie).not.toContain(owner.address)
      const sessionRequest = request('me', undefined, cookieFrom(response))
      const session = await getVerifiedSession(sessionRequest)
      expect(session).toEqual({
        address: owner.address,
        chainId,
        isContract: false,
        issuedAt: expect.any(Number),
      })
      vi.stubEnv('ADMIN_ADDRESSES', owner.address)
      expect(() => requireAdmin(session)).not.toThrow()
      expect(await (await routes.me(sessionRequest)).json()).toEqual({
        session,
      })
      const logout = await routes.logout(
        request('logout', '{}', cookieFrom(response)),
      )
      expect(logout.status).toBe(200)
      expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0')
      expect(
        await getVerifiedSession(request('me', undefined, cookieFrom(logout))),
      ).toBeNull()
    },
  )

  it.each([false, true])(
    'verifies the ERC-1271 contract, including an ERC-6492 wrapped signature: %s',
    async (wrapped) => {
      const data = await challenge(contractAddress)
      const signature = await owner.signMessage({ message: data.message })
      const response = await routes.verify(
        request(
          'verify',
          JSON.stringify({
            message: data.message,
            signature: wrapped
              ? serializeErc6492Signature({
                  address: zeroAddress,
                  data: '0x',
                  signature,
                })
              : signature,
          }),
          data.cookie,
        ),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        address: contractAddress,
        chainId: 88888,
        isContract: true,
      })
      expect(getCode).toHaveBeenCalledWith({ address: contractAddress })
      expect(getPublicClient).toHaveBeenCalledWith(88888)
    },
  )

  it('rejects a signature not authorised by the ERC-1271 owner', async () => {
    const data = await challenge(contractAddress)
    expect(
      (
        await routes.verify(
          request('verify', await sign(data, other), data.cookie),
        )
      ).status,
    ).toBe(401)
    expect(rows.get(data.nonce)!.usedAt).toBeNull()
  })

  it('rejects replay before RPC work', async () => {
    const data = await challenge()
    const body = await sign(data)
    expect(
      (await routes.verify(request('verify', body, data.cookie))).status,
    ).toBe(200)
    verify.mockClear()
    getCode.mockClear()
    expect(
      (await routes.verify(request('verify', body, data.cookie))).status,
    ).toBe(401)
    expect(verify).not.toHaveBeenCalled()
    expect(getCode).not.toHaveBeenCalled()
  })

  it('allows only one concurrent consumption', async () => {
    const data = await challenge()
    const body = await sign(data)
    const responses = await Promise.all([
      routes.verify(request('verify', body, data.cookie)),
      routes.verify(request('verify', body, data.cookie)),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ])
  })

  it.each([
    { domain: 'other.localhost' },
    { uri: 'https://other.localhost' },
    { chainId: 1 },
    { statement: 'tampered' },
    { issuedAt: new Date(Date.now() + 60_000) },
    {
      issuedAt: new Date(Date.now() - 700_000),
      expirationTime: new Date(Date.now() - 100_000),
    },
    { expirationTime: new Date(Date.now() + 1_200_000) },
    { notBefore: new Date(Date.now() + 60_000) },
  ])(
    'rejects invalid message fields before DB reads and RPC: %j',
    async (overrides) => {
      const data = await challenge(owner.address, overrides)
      expect(
        (await routes.verify(request('verify', await sign(data), data.cookie)))
          .status,
      ).toBe(401)
      expect(nonceStore.find).not.toHaveBeenCalled()
      expect(getPublicClient).not.toHaveBeenCalled()
    },
  )

  it('rejects an expired database nonce before RPC', async () => {
    const data = await challenge()
    rows.get(data.nonce)!.expiresAt = new Date(Date.now() - 1)
    expect(
      (await routes.verify(request('verify', await sign(data), data.cookie)))
        .status,
    ).toBe(401)
    expect(getPublicClient).not.toHaveBeenCalled()
  })

  it('rejects a nonce that expires during signature verification', async () => {
    const data = await challenge()
    verify.mockImplementationOnce(async () => {
      rows.get(data.nonce)!.expiresAt = new Date(Date.now() - 1)
      return true
    })
    const response = await routes.verify(
      request('verify', await sign(data), data.cookie),
    )
    expect(response.status).toBe(401)
    expect(response.headers.has('Set-Cookie')).toBe(false)
  })

  it('rejects tampering and does not consume the nonce', async () => {
    const data = await challenge()
    const body = JSON.parse(await sign(data))
    body.message = body.message.replace(owner.address, other.address)
    expect(
      (
        await routes.verify(
          request('verify', JSON.stringify(body), data.cookie),
        )
      ).status,
    ).toBe(401)
    expect(rows.get(data.nonce)!.usedAt).toBeNull()
  })

  it('requires the issuing browser cookie and same-origin POSTs', async () => {
    const data = await challenge()
    const body = await sign(data)
    expect((await routes.verify(request('verify', body))).status).toBe(401)
    expect(
      (
        await routes.verify(
          request('verify', body, data.cookie, 'https://other.localhost'),
        )
      ).status,
    ).toBe(401)
    expect(
      (
        await routes.logout(
          request('logout', '{}', data.cookie, 'https://other.localhost'),
        )
      ).status,
    ).toBe(401)
    expect(nonceStore.find).not.toHaveBeenCalled()
    expect(getPublicClient).not.toHaveBeenCalled()
  })

  it.each([
    'not json',
    '{}',
    '{"message":"bad","signature":"bad"}',
    'x'.repeat(16_385),
  ])(
    'rejects malformed or oversized bodies without paid work',
    async (body) => {
      const response = await routes.verify(request('verify', body))
      expect([400, 413]).toContain(response.status)
      expect(nonceStore.find).not.toHaveBeenCalled()
      expect(getPublicClient).not.toHaveBeenCalled()
    },
  )

  it.each(['nonce', 'verify'] as const)(
    'applies the shared limiter before any %s work',
    async (route) => {
      const consume = vi.fn(() => ({ allowed: false, retryAfter: 9 }))
      const limited = createAuthRoutes({
        rateLimiter: { consume },
        rateLimitKey: () => 'trusted-test-key',
      })
      const response = await limited[route](
        request(route, route === 'verify' ? 'invalid' : undefined),
      )
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('9')
      expect(consume).toHaveBeenCalledWith('trusted-test-key')
      expect(nonceStore.issue).not.toHaveBeenCalled()
      expect(nonceStore.find).not.toHaveBeenCalled()
      expect(getPublicClient).not.toHaveBeenCalled()
    },
  )

  it.each(['nonce', 'verify'] as const)(
    'fails closed in production without a shared limiter: %s',
    async (route) => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(
        (
          await createAuthRoutes()[route](
            request(route, route === 'verify' ? '{}' : undefined),
          )
        ).status,
      ).toBe(500)
      expect(nonceStore.issue).not.toHaveBeenCalled()
      expect(nonceStore.find).not.toHaveBeenCalled()
      expect(getPublicClient).not.toHaveBeenCalled()
    },
  )

  it.each(['', 'short'])(
    'fails closed without a strong session secret',
    async (secret) => {
      vi.stubEnv('SESSION_SECRET', secret)
      expect((await routes.nonce(request('nonce'))).status).toBe(500)
      expect((await routes.me(request('me'))).status).toBe(500)
      expect(nonceStore.issue).not.toHaveBeenCalled()
    },
  )

  it('redacts provider errors and does not consume the nonce', async () => {
    const data = await challenge()
    verify.mockRejectedValueOnce(new Error('private RPC URL and signature'))
    const response = await routes.verify(
      request('verify', await sign(data), data.cookie),
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    })
    expect(rows.get(data.nonce)!.usedAt).toBeNull()
  })

  it('rejects tampered, expired and future-dated session cookies', async () => {
    expect(
      await getVerifiedSession(
        request('me', undefined, '__Host-scoutreport-session=tampered'),
      ),
    ).toBeNull()
    for (const issuedAt of [
      Date.now() - SESSION_TTL * 1000,
      Date.now() + 60_000,
    ]) {
      const response = new Response()
      const session = await readSession(request('me'), response)
      Object.assign(session, {
        address: owner.address,
        chainId: 88888,
        isContract: false,
        issuedAt,
      })
      await session.save()
      expect(
        await getVerifiedSession(
          request('me', undefined, cookieFrom(response)),
        ),
      ).toBeNull()
    }
  })
})
