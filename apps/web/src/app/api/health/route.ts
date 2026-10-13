import { getAppChain, getDataChain, getPublicClient } from '@scoutreport/chain'
import { sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db'
import { handler } from '../../../server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const check = async (
  probe: () => Promise<unknown>,
): Promise<'ok' | 'error'> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve().then(probe),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Health check timed out')),
          5000,
        )
      }),
    ])
    return 'ok'
  } catch {
    return 'error'
  } finally {
    clearTimeout(timer)
  }
}

export const GET = handler({}, async () => {
  const [db, dataChainRpc, appChainRpc] = await Promise.all([
    check(() => getDatabase().execute(sql`select 1`)),
    check(() =>
      getPublicClient(getDataChain().id).getBlockNumber({ cacheTime: 0 }),
    ),
    check(() =>
      getPublicClient(getAppChain().id).getBlockNumber({ cacheTime: 0 }),
    ),
  ])
  return Response.json(
    { db, dataChainRpc, appChainRpc },
    { status: [db, dataChainRpc, appChainRpc].includes('error') ? 503 : 200 },
  )
})
