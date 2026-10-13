import 'server-only'
import { HttpError } from './http'
import { addressSchema } from './address'

export type AdminSession = { address: string }

// The caller must supply a verified session, never a request body.
export const requireAdmin = (
  session: AdminSession | null | undefined,
): void => {
  if (!session)
    throw new HttpError(401, 'UNAUTHORISED', 'A session is required')

  const address = addressSchema.safeParse(session.address)
  const allowlist = (process.env.ADMIN_ADDRESSES ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (!address.success || !allowlist.includes(address.data.toLowerCase())) {
    throw new HttpError(403, 'FORBIDDEN', 'Admin access is required')
  }
}
