import { pathToFileURL } from 'node:url'
import { createPublicClient, http, type PublicClient } from 'viem'
import { chiliz } from '../../src/chains.ts'

export type Capture = {
  client: PublicClient
  blockNumber: bigint
  record: <T>(label: string, read: () => Promise<T>) => Promise<T | undefined>
}

export type Probe = (capture: Capture) => Promise<void>

export const runCapture = async (client: PublicClient, probes: Probe[]) => {
  const reads: Record<string, unknown> = {}
  const record: Capture['record'] = async (label, read) => {
    try {
      const value = await read()
      reads[label] = { status: 'ok', value }
      return value
    } catch {
      // RPC errors can contain credential-bearing URLs; never print them.
      reads[label] = { status: 'failed', value: 'UNKNOWN' }
      return undefined
    }
  }
  const chainId = await record('chainId', () => client.getChainId())
  if (chainId !== chiliz.id) {
    return { reads, blocked: 'Mainnet 88888 not confirmed; no probes run.' }
  }
  const blockNumber = await record('blockNumber', () => client.getBlockNumber())
  if (blockNumber === undefined) {
    return { reads, blocked: 'No capture block; no probes run.' }
  }
  await record('block', async () => {
    const block = await client.getBlock({ blockNumber })
    return { hash: block.hash, timestamp: block.timestamp }
  })
  for (const probe of probes) await probe({ client, blockNumber, record })
  return { reads, blocked: null }
}

export const cli = async (url: string, probes: Probe[]) => {
  if (!process.argv[1] || pathToFileURL(process.argv[1]).href !== url) return
  const client = createPublicClient({
    chain: chiliz,
    transport: http(process.env.RPC_URL_MAINNET || 'https://rpc.chiliz.com', {
      timeout: 5_000,
      retryCount: 0,
      batch: true,
    }),
  })
  const result = await runCapture(client, probes)
  console.log(
    JSON.stringify(
      { capturedAt: new Date().toISOString(), ...result },
      (_, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      2,
    ),
  )
  if (
    result.blocked ||
    Object.values(result.reads).some(
      (read) => (read as { status: string }).status === 'failed',
    )
  )
    process.exitCode = 1
}
