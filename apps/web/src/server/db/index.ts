import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let database: ReturnType<typeof createDatabase> | undefined

const createDatabase = (url: string) =>
  drizzle(
    postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
      connection: { statement_timeout: 5000 },
    }),
    { schema },
  )

export const getDatabase = () => {
  if (!database) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required')
    database = createDatabase(url)
  }
  return database
}
