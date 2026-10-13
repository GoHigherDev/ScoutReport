import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStakingLogClient } from './clients.ts'

afterEach(() => vi.unstubAllGlobals())

describe('staking log transport (offline)', () => {
  it.each([-32062, -32701])(
    'uses PublicNode only and makes no retry or fallback for error %i',
    async (code) => {
      const fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code, message: 'Block range is too large' },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      const client = getStakingLogClient()
      expect(getStakingLogClient()).toBe(client)
      await expect(
        client.request({
          method: 'eth_getLogs',
          params: [{ fromBlock: '0x0', toBlock: '0xc34f' }],
        }),
      ).rejects.toThrow()
      expect(fetch).toHaveBeenCalledOnce()
      expect(fetch.mock.calls[0][0]).toBe('https://chiliz-rpc.publicnode.com/')
    },
  )
})
