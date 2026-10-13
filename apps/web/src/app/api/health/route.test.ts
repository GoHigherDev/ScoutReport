// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execute, getBlockNumber, getPublicClient, getDatabase } = vi.hoisted(
  () => {
    const execute = vi.fn()
    const getBlockNumber = vi.fn()
    return {
      execute,
      getBlockNumber,
      getPublicClient: vi.fn(() => ({ getBlockNumber })),
      getDatabase: vi.fn(() => ({ execute })),
    }
  },
)

vi.mock('@scoutreport/chain', () => ({
  getAppChain: () => ({ id: 88882 }),
  getDataChain: () => ({ id: 88888 }),
  getPublicClient,
}))
vi.mock('../../../server/db', () => ({ getDatabase }))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  execute.mockResolvedValue([])
  getBlockNumber.mockResolvedValue(1n)
})
afterEach(() => vi.useRealTimers())

const request = () => new Request('http://localhost/api/health')

describe('health endpoint', () => {
  it('checks DB and both configured chains without live services', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      db: 'ok',
      dataChainRpc: 'ok',
      appChainRpc: 'ok',
    })
    expect(execute).toHaveBeenCalledOnce()
    expect(getPublicClient).toHaveBeenCalledWith(88888)
    expect(getPublicClient).toHaveBeenCalledWith(88882)
    expect(getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 })
  })

  it('reports partial failure without disclosing connection details', async () => {
    execute.mockRejectedValue(new Error('secret DB URL'))
    getBlockNumber.mockRejectedValueOnce(new Error('private RPC URL'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      db: 'error',
      dataChainRpc: 'error',
      appChainRpc: 'ok',
    })
  })

  it('catches synchronous configuration errors', async () => {
    getDatabase.mockImplementationOnce(() => {
      throw new Error('missing DATABASE_URL')
    })
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect((await response.json()).db).toBe('error')
  })

  it('bounds the wait for an unresponsive dependency', async () => {
    vi.useFakeTimers()
    execute.mockImplementationOnce(() => new Promise(() => {}))
    const pending = GET(request())
    await vi.advanceTimersByTimeAsync(5000)
    const response = await pending
    expect(response.status).toBe(503)
    expect((await response.json()).db).toBe('error')
  })
})
