import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, isAddress, parseAbi, type Address } from 'viem'

type Row = { user: Address; total: string }
type GraphResult = {
  errors?: unknown[]
  data?: {
    _meta?: { block: { number: number }; hasIndexingErrors: boolean }
    userPoints?: Row[]
  }
}

export async function checkPoints(
  subgraphUrl: string,
  readPoints: (user: Address, block: bigint) => Promise<bigint>,
  request: typeof fetch = fetch,
): Promise<{ checked: number; mismatches: Address[]; block: number }> {
  async function query(query: string, variables: object = {}): Promise<GraphResult> {
    const response = await request(subgraphUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error('Subgraph request failed')
    const result = await response.json() as GraphResult
    if (result.errors?.length || !result.data) throw new Error('Subgraph query failed')
    return result
  }
  const meta = (await query('{ _meta { block { number } hasIndexingErrors } }')).data?._meta
  if (!meta || meta.hasIndexingErrors ||
      !Number.isSafeInteger(meta.block.number) || meta.block.number < 0) {
    throw new Error('Subgraph is not healthy')
  }
  const block = meta.block.number
  const rows = (await query(
    `query TopPoints($block: Int!) {
      userPoints: userPoints_collection(first: 50, orderBy: total, orderDirection: desc, block: { number: $block }) {
        user total
      }
    }`, { block },
  )).data?.userPoints
  if (!Array.isArray(rows) || rows.length > 50) throw new Error('Invalid points response')
  const seen = new Set<string>()
  for (const row of rows) {
    if (!isAddress(row.user) || typeof row.total !== 'string' ||
        !/^(0|[1-9][0-9]*)$/.test(row.total) ||
        seen.has(row.user.toLowerCase())) throw new Error('Invalid points row')
    seen.add(row.user.toLowerCase())
  }
  const mismatches: Address[] = []
  for (const row of rows) {
    if (await readPoints(row.user, BigInt(block)) !== BigInt(row.total)) {
      mismatches.push(row.user)
    }
  }
  return { checked: rows.length, mismatches, block }
}

export async function main(env = process.env): Promise<void> {
  const rpcUrl = env.RPC_URL_SPICY
  const subgraphUrl = env.SUBGRAPH_URL_PREDICTIONS
  for (const value of [rpcUrl, subgraphUrl]) {
    if (!value || !['http:', 'https:'].includes(new URL(value).protocol)) {
      throw new Error('Set RPC_URL_SPICY and SUBGRAPH_URL_PREDICTIONS')
    }
  }
  const deployment = JSON.parse(readFileSync(
    new URL('../../contracts/deployments/88882.json', import.meta.url), 'utf8',
  )) as { chainId: number; contracts: { ScoutReportPredictions: { address: Address } | null } }
  const address = deployment.contracts.ScoutReportPredictions?.address
  if (deployment.chainId !== 88882 || !address || !isAddress(address) ||
      /^0x0{40}$/i.test(address)) throw new Error('Predictions Spicy deployment is required')
  const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 0, timeout: 30_000 }) })
  if (await client.getChainId() !== 88882) throw new Error('RPC must use Spicy chain 88882')
  const abi = parseAbi(['function pointsOf(address) view returns (uint256)'])
  const result = await checkPoints(subgraphUrl!, (user, blockNumber) =>
    client.readContract({ address, abi, functionName: 'pointsOf', args: [user], blockNumber }),
  )
  console.log(JSON.stringify(result))
  if (result.mismatches.length) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Transport errors can contain credential-bearing URLs; do not print them.
    console.error('Points check failed. Check deployment, environment, endpoint health and historical RPC access privately.')
    process.exitCode = 1
  })
}
