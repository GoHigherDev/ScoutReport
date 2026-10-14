import 'server-only'
import { and, eq, isNull, gt, lte } from 'drizzle-orm'
import { getDatabase } from './db'
import { siweNonces } from './db/schema'

export const nonceStore = {
  async issue(nonce: string, expiresAt: Date, now: Date, address?: string) {
    const db = getDatabase()
    await db.delete(siweNonces).where(lte(siweNonces.expiresAt, now))
    await db
      .insert(siweNonces)
      .values({ nonce, expiresAt, ...(address ? { address } : {}) })
  },
  async find(nonce: string) {
    const [row] = await getDatabase()
      .select()
      .from(siweNonces)
      .where(eq(siweNonces.nonce, nonce))
      .limit(1)
    return row
  },
  async consume(nonce: string, now: Date, address?: string) {
    const rows = await getDatabase()
      .update(siweNonces)
      .set({ usedAt: now, ...(address ? { address } : {}) })
      .where(
        and(
          eq(siweNonces.nonce, nonce),
          isNull(siweNonces.usedAt),
          gt(siweNonces.expiresAt, now),
        ),
      )
      .returning({ nonce: siweNonces.nonce })
    return rows.length === 1
  },
}
