import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  getAppChain,
  getPredictionsAddress,
  getPublicClient,
  SCOUTREPORT_ABIS,
} from '@scoutreport/chain'
import { desc, eq } from 'drizzle-orm'
import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { z } from 'zod'
import {
  londonToUtc,
  matchInputSchema,
  type AdminMatch,
} from '../lib/admin-matches'
import { requireAdmin } from './admin'
import { toStoredAddress } from './address'
import { getDatabase } from './db'
import { adminAuditLog, matches } from './db/schema'
import { handler, HttpError, type RateLimiter } from './http'
import { getVerifiedSession } from './session'

type AuditRow = typeof adminAuditLog.$inferInsert
export interface MatchStore {
  list(): Promise<AdminMatch[]>
  find(matchId: string): Promise<AdminMatch | undefined>
  create(match: AdminMatch, audit: AuditRow): Promise<void>
  audit(audit: AuditRow): Promise<void>
}

const serialise = (row: typeof matches.$inferSelect): AdminMatch => ({
  id: row.id,
  matchId: row.matchId as Hex,
  sport: row.sport,
  sides: row.sides,
  kickoff: row.kickoff.toISOString(),
  lockTime: row.lockTime.toISOString(),
  outcomes: row.outcomes,
  pointsForCorrect: row.pointsForCorrect,
})

const matchStore: MatchStore = {
  async list() {
    return (
      await getDatabase()
        .select()
        .from(matches)
        .orderBy(desc(matches.createdAt), desc(matches.id))
        .limit(100)
    ).map(serialise)
  },
  async find(matchId) {
    const [row] = await getDatabase()
      .select()
      .from(matches)
      .where(eq(matches.matchId, matchId))
      .limit(1)
    return row ? serialise(row) : undefined
  },
  async create(match, audit) {
    await getDatabase().transaction(async (transaction) => {
      await transaction.insert(matches).values({
        ...match,
        kickoff: new Date(match.kickoff),
        lockTime: new Date(match.lockTime),
      })
      await transaction.insert(adminAuditLog).values(audit)
    })
  },
  async audit(audit) {
    await getDatabase()
      .insert(adminAuditLog)
      .values(audit)
      .onConflictDoNothing()
  },
}

const hashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((value) => value.toLowerCase() as Hex)
const auditInputSchema = z
  .object({
    matchId: hashSchema,
    action: z.enum(['createMatch', 'settle', 'voidMatch', 'creditPoints']),
    txHash: hashSchema,
  })
  .strict()
type AuditInput = z.infer<typeof auditInputSchema>
type AuditClient = Pick<
  PublicClient,
  'getTransaction' | 'getTransactionReceipt' | 'readContract' | 'getChainId'
>

function invalid(): never {
  throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request body')
}

const assertOrigin = (request: Request) => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (!configured) invalid()
  let origin: string
  try {
    const url = new URL(configured)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (configured !== url.origin && configured !== `${url.origin}/`) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      invalid()
    origin = url.origin
  } catch {
    return invalid()
  }
  if (request.headers.get('Origin') !== origin) invalid()
}

const verifyAudit = async (
  input: AuditInput,
  match: AdminMatch,
  actor: string,
  address: Address,
  client: AuditClient,
): Promise<Record<string, unknown>> => {
  const abi = SCOUTREPORT_ABIS[0]
  if ((await client.getChainId()) !== 88882) invalid()
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash: input.txHash }),
    client.getTransactionReceipt({ hash: input.txHash }),
  ])
  if (
    !['success', 'reverted'].includes(receipt.status) ||
    receipt.transactionHash.toLowerCase() !== input.txHash ||
    transaction.hash.toLowerCase() !== input.txHash ||
    transaction.chainId !== 88882 ||
    transaction.blockHash !== receipt.blockHash ||
    transaction.from.toLowerCase() !== actor ||
    receipt.from.toLowerCase() !== actor ||
    transaction.to?.toLowerCase() !== address.toLowerCase() ||
    receipt.to?.toLowerCase() !== address.toLowerCase() ||
    transaction.value !== 0n
  )
    invalid()
  const call = decodeFunctionData({ abi, data: transaction.input })
  const args = call.args as readonly unknown[] | undefined
  if (
    call.functionName !== input.action ||
    !args ||
    args[0] !== input.matchId ||
    encodeFunctionData({
      abi,
      functionName: call.functionName,
      args: call.args,
    }).toLowerCase() !== transaction.input.toLowerCase()
  )
    invalid()
  const lockTime = BigInt(Date.parse(match.lockTime) / 1000)
  if (
    input.action === 'createMatch' &&
    (args[1] !== lockTime ||
      args[2] !== match.outcomes.length ||
      args[3] !== match.pointsForCorrect)
  )
    invalid()
  if (
    input.action === 'settle' &&
    (typeof args[1] !== 'number' ||
      args[1] < 0 ||
      args[1] >= match.outcomes.length)
  )
    invalid()
  const details: Record<string, unknown> = { receiptStatus: receipt.status }
  if (input.action === 'settle') details.result = args[1]
  if (input.action === 'creditPoints') details.maxCount = String(args[1])
  // Reverted calls have no lifecycle event or newly created on-chain state,
  // but their verified, mined attempt still belongs in the audit trail.
  if (receipt.status === 'reverted') return details
  const expectedEvent = {
    createMatch: 'MatchCreated',
    settle: 'MatchSettled',
    voidMatch: 'MatchVoided',
    creditPoints: 'PointsCredited',
  }[input.action]
  const events: Record<string, unknown>[] = []
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
        strict: true,
      })
      const event = decoded.args as unknown as Record<string, unknown>
      if (
        decoded.eventName === expectedEvent &&
        event.matchId === input.matchId
      )
        events.push(event)
    } catch {
      // Other contract events are not proof of the requested action.
    }
  }
  if (events.length !== 1) invalid()
  const event = events[0]
  if (
    input.action === 'createMatch' &&
    (event.lockTime !== lockTime ||
      event.outcomeCount !== match.outcomes.length ||
      event.pointsForCorrect !== match.pointsForCorrect)
  )
    invalid()
  if (input.action === 'settle') {
    if (event.result !== args[1]) invalid()
    details.result = event.result
  }
  if (input.action === 'creditPoints') {
    if (
      typeof event.from !== 'number' ||
      typeof event.to !== 'number' ||
      event.from < 0 ||
      event.to < event.from ||
      typeof args[1] !== 'bigint' ||
      BigInt(event.to - event.from) > args[1]
    )
      invalid()
    details.from = event.from
    details.to = event.to
    details.maxCount = String(args[1])
  }
  const state = (await client.readContract({
    address,
    abi,
    functionName: 'getMatch',
    args: [input.matchId],
    blockNumber: receipt.blockNumber,
  })) as {
    lockTime: bigint
    outcomeCount: number
    pointsForCorrect: number
    status: number
    result: number
  }
  if (
    state.lockTime !== lockTime ||
    state.outcomeCount !== match.outcomes.length ||
    state.pointsForCorrect !== match.pointsForCorrect ||
    state.status === 0 ||
    ((input.action === 'settle' || input.action === 'creditPoints') &&
      (state.status !== 2 ||
        state.result < 0 ||
        state.result >= match.outcomes.length)) ||
    (input.action === 'settle' && state.result !== args[1]) ||
    (input.action === 'voidMatch' && state.status !== 3)
  )
    invalid()
  if (input.action === 'creditPoints') details.result = state.result
  return details
}

type Dependencies = {
  store?: MatchStore
  getSession?: typeof getVerifiedSession
  getClient?: (chainId: number) => AuditClient
  appChain?: typeof getAppChain
  predictionsAddress?: typeof getPredictionsAddress
  rateLimiter?: RateLimiter
  rateLimitKey?: (request: Request) => string | Promise<string>
}

export function createMatchRoutes(dependencies: Dependencies = {}) {
  const store = dependencies.store ?? matchStore
  const authenticate = async (request: Request) => {
    const session = await (dependencies.getSession ?? getVerifiedSession)(
      request,
    )
    requireAdmin(session)
    return toStoredAddress(session!.address)
  }
  const options = {
    auth: true,
    rateLimiter: dependencies.rateLimiter,
    rateLimitKey: dependencies.rateLimitKey,
  }
  return {
    GET: handler(options, async (_, request) => {
      await authenticate(request)
      return { matches: await store.list() }
    }),
    POST: handler(
      { ...options, schema: matchInputSchema, maxBodyBytes: 16_384 },
      async (input, request) => {
        const actor = await authenticate(request)
        assertOrigin(request)
        const id = randomUUID()
        const match: AdminMatch = {
          ...input,
          id,
          matchId: keccak256(toBytes(`scoutreport:${id}`)),
          kickoff: londonToUtc(input.kickoff),
          lockTime: londonToUtc(input.lockTime ?? input.kickoff),
        }
        await store.create(match, {
          actorAddress: actor,
          action: 'matches.metadata.create',
          payload: { matchId: match.matchId, txHash: null },
        })
        return { match }
      },
    ),
    audit: handler(
      { ...options, schema: auditInputSchema, maxBodyBytes: 2_048 },
      async (input, request) => {
        const actor = await authenticate(request)
        assertOrigin(request)
        if ((dependencies.appChain ?? getAppChain)().id !== 88882) invalid()
        const address = (
          dependencies.predictionsAddress ?? getPredictionsAddress
        )()
        if (!address) invalid()
        const match = await store.find(input.matchId)
        if (!match) invalid()
        let details: Record<string, unknown>
        try {
          details = await verifyAudit(
            input,
            match,
            actor,
            address,
            (dependencies.getClient ?? getPublicClient)(88882),
          )
        } catch {
          return invalid()
        }
        await store.audit({
          actorAddress: actor,
          action: `matches.${input.action}`,
          payload: {
            matchId: input.matchId,
            txHash: input.txHash,
            chainId: 88882,
            ...details,
          },
        })
        return { ok: true }
      },
    ),
  }
}
