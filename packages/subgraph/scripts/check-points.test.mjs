import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkPoints } from './check-points.ts'

const alice = '0x0000000000000000000000000000000000000001'
const bob = '0x0000000000000000000000000000000000000002'
function mockGraph(rows, meta = { block: { number: 123 }, hasIndexingErrors: false }) {
  const calls = []
  const request = async (_url, options) => {
    const body = JSON.parse(options.body)
    calls.push(body)
    return Response.json({ data: body.query.includes('_meta') ? { _meta: meta } : { userPoints: rows } })
  }
  return { calls, request }
}

test('compares exact big integers at the indexed block, not live head', async () => {
  const total = '900719925474099312345'
  const graph = mockGraph([{ user: alice, total }, { user: bob, total: '2' }])
  const reads = []
  const result = await checkPoints('https://subgraph.invalid', async (user, block) => {
    reads.push([user, block])
    return user === alice ? BigInt(total) : 3n
  }, graph.request)
  assert.deepEqual(result, { checked: 2, mismatches: [bob], block: 123 })
  assert.deepEqual(reads, [[alice, 123n], [bob, 123n]])
  assert.match(graph.calls[1].query, /first: 50/)
  assert.match(graph.calls[1].query, /userPoints: userPoints_collection/)
  assert.deepEqual(graph.calls[1].variables, { block: 123 })
})

test('matching and empty leaderboards succeed', async () => {
  for (const rows of [[], [{ user: alice, total: '0' }]]) {
    const { request } = mockGraph(rows)
    const result = await checkPoints('https://subgraph.invalid', async () => 0n, request)
    assert.deepEqual(result.mismatches, [])
    assert.equal(result.checked, rows.length)
  }
})

test('unhealthy and malformed subgraph data fail before RPC work', async () => {
  const read = () => assert.fail('Must not read RPC')
  for (const rows of [
    undefined, [{ user: 'bad', total: '1' }], [{ user: alice, total: '-1' }],
    [{ user: alice, total: '1.5' }], [{ user: alice, total: 9007199254740992 }],
    [{ user: alice, total: '1' }, { user: alice, total: '1' }],
    Array.from({ length: 51 }, () => ({ user: alice, total: '0' })),
  ]) {
    await assert.rejects(checkPoints('https://subgraph.invalid', read, mockGraph(rows).request))
  }
  for (const meta of [null, { block: { number: 123 }, hasIndexingErrors: true },
    { block: { number: -1 }, hasIndexingErrors: false }]) {
    await assert.rejects(checkPoints('https://subgraph.invalid', read, mockGraph([], meta).request))
  }
  for (const response of [Response.json({ errors: [{ message: 'failed' }] }),
    new Response('', { status: 500 })]) {
    await assert.rejects(checkPoints('https://subgraph.invalid', read, async () => response))
  }
})

test('RPC failure rejects instead of reporting a successful comparison', async () => {
  await assert.rejects(checkPoints('https://subgraph.invalid', async () => {
    throw new Error('RPC unavailable')
  }, mockGraph([{ user: alice, total: '1' }]).request), /RPC unavailable/)
})
