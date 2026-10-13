import 'server-only'
import { randomBytes } from 'node:crypto'
import { getPublicClient } from '@scoutreport/chain'
import { isErc6492Signature } from 'viem'
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe'
import { z } from 'zod'
import { SIWE_STATEMENT } from '../copy/auth'
import { toChecksumAddress } from './address'
import { handler, HttpError, type RateLimiter } from './http'
import { getVerifiedSession, readSession } from './session'
import { nonceStore } from './siwe-nonces'

const NONCE_TTL = 10 * 60 * 1000
const invalid = () =>
  new HttpError(401, 'UNAUTHORISED', 'A session is required')
const verifySchema = z
  .object({
    message: z.string().min(1).max(4096),
    signature: z
      .string()
      .regex(/^0x(?:[0-9a-fA-F]{2})+$/)
      .max(8192),
  })
  .strict()

const authOrigin = () => {
  const value = process.env.NEXT_PUBLIC_SITE_URL
  if (!value) throw new Error('NEXT_PUBLIC_SITE_URL is required')
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (value !== url.origin && value !== `${url.origin}/`) ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  ) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be a trusted origin')
  }
  return url
}

const requireSameOrigin = (request: Request, origin: string) => {
  if (request.headers.get('Origin') !== origin) throw invalid()
}

type AuthOptions = {
  rateLimiter?: RateLimiter
  rateLimitKey?: (request: Request) => string | Promise<string>
}

// Deployment wiring must supply the shared limiter and trusted key resolver.
export const createAuthRoutes = (options: AuthOptions = {}) => {
  const limited = { ...options, auth: true }
  return {
    nonce: handler(limited, async (_, request) => {
      authOrigin()
      const response = Response.json({})
      const session = await readSession(request, response)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + NONCE_TTL)
      const nonce = randomBytes(32).toString('hex')
      await nonceStore.issue(nonce, expiresAt, now)
      session.nonce = nonce
      await session.save()
      return Response.json(
        { nonce, expiresAt: expiresAt.toISOString() },
        { headers: response.headers },
      )
    }),
    verify: handler(
      { ...limited, schema: verifySchema, maxBodyBytes: 16_384 },
      async ({ message, signature }, request) => {
        const origin = authOrigin()
        requireSameOrigin(request, origin.origin)
        const response = Response.json({})
        const session = await readSession(request, response)
        let parsed: ReturnType<typeof parseSiweMessage>
        try {
          parsed = parseSiweMessage(message)
        } catch {
          throw invalid()
        }
        const now = new Date()
        if (
          !parsed.address ||
          !parsed.nonce ||
          !/^[a-zA-Z0-9]{8,128}$/.test(parsed.nonce) ||
          parsed.nonce !== session.nonce ||
          ![88888, 88882].includes(parsed.chainId ?? 0) ||
          parsed.version !== '1' ||
          parsed.uri !== origin.origin ||
          (parsed.scheme !== undefined &&
            parsed.scheme !== origin.protocol.slice(0, -1)) ||
          parsed.statement !== SIWE_STATEMENT ||
          !parsed.issuedAt ||
          !Number.isFinite(parsed.issuedAt.getTime()) ||
          parsed.issuedAt > now ||
          !parsed.expirationTime ||
          !Number.isFinite(parsed.expirationTime.getTime()) ||
          parsed.expirationTime <= parsed.issuedAt ||
          parsed.expirationTime.getTime() - parsed.issuedAt.getTime() >
            NONCE_TTL ||
          !validateSiweMessage({
            message: parsed,
            domain: origin.host,
            time: now,
          })
        ) {
          throw invalid()
        }
        const row = await nonceStore.find(parsed.nonce)
        if (
          !row ||
          row.usedAt ||
          row.expiresAt <= now ||
          parsed.issuedAt < row.createdAt ||
          parsed.expirationTime > row.expiresAt
        ) {
          throw invalid()
        }
        const address = toChecksumAddress(parsed.address) as `0x${string}`
        const client = getPublicClient(parsed.chainId!)
        const code = await client.getCode({ address })
        const isContract =
          (!!code && code !== '0x') ||
          isErc6492Signature(signature as `0x${string}`)
        const valid = await client.verifySiweMessage({
          message,
          signature: signature as `0x${string}`,
          domain: origin.host,
          nonce: parsed.nonce,
          time: now,
        })
        if (!valid || !(await nonceStore.consume(parsed.nonce, new Date()))) {
          throw invalid()
        }
        delete session.nonce
        Object.assign(session, {
          address,
          chainId: parsed.chainId,
          isContract,
          issuedAt: Date.now(),
        })
        await session.save()
        return Response.json(
          {
            address,
            chainId: session.chainId,
            isContract,
            issuedAt: session.issuedAt,
          },
          { headers: response.headers },
        )
      },
    ),
    me: handler(limited, async (_, request) => ({
      session: await getVerifiedSession(request),
    })),
    logout: handler(limited, async (_, request) => {
      requireSameOrigin(request, authOrigin().origin)
      const response = Response.json({ ok: true })
      const session = await readSession(request, response)
      session.destroy()
      return response
    }),
  }
}

export const authRoutes = createAuthRoutes()
