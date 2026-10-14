import 'server-only'
import { getIronSession, type SessionOptions } from 'iron-session'
import { z } from 'zod'
import { addressSchema, toStoredAddress } from './address'

export const SESSION_TTL = 7 * 24 * 60 * 60
const verifiedSessionSchema = z.object({
  address: addressSchema.transform(toStoredAddress),
  chainId: z.union([z.literal(88888), z.literal(88882)]),
  isContract: z.boolean(),
  issuedAt: z.number().int().nonnegative(),
})
export type VerifiedSession = z.infer<typeof verifiedSessionSchema>
type SessionData = Partial<VerifiedSession> & { nonce?: string }

const sessionOptions = (): SessionOptions => {
  const password = process.env.SESSION_SECRET
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters')
  }
  return {
    password,
    cookieName: '__Host-scoutreport-session',
    ttl: SESSION_TTL,
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL,
    },
  }
}

export const readSession = (request: Request, response: Response) =>
  getIronSession<SessionData>(request, response, sessionOptions())

export const getVerifiedSession = async (
  request: Request,
): Promise<VerifiedSession | null> => {
  const session = await readSession(request, new Response())
  const parsed = verifiedSessionSchema.safeParse(session)
  const now = Date.now()
  if (
    !parsed.success ||
    parsed.data.issuedAt > now ||
    now >= parsed.data.issuedAt + SESSION_TTL * 1000
  ) {
    return null
  }
  return parsed.data
}
