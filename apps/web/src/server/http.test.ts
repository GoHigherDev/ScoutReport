// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { handler, HttpError, MemoryRateLimiter } from './http'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const request = (body: string, method = 'POST') =>
  new Request('http://localhost/api/example', { method, body })

describe('HTTP handler', () => {
  it('parses typed JSON and returns uncached JSON', async () => {
    const route = handler(
      { schema: z.object({ value: z.number() }) },
      (input) => ({
        doubled: input.value * 2,
      }),
    )
    const response = await route(request('{"value":3}'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ doubled: 6 })
  })

  it.each(['not json', '{"value":"wrong"}'])(
    'rejects invalid input %s',
    async (body) => {
      const run = vi.fn()
      const route = handler({ schema: z.object({ value: z.number() }) }, run)
      const response = await route(request(body))
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' })
      expect(run).not.toHaveBeenCalled()
    },
  )

  it('preserves typed errors and redacts unexpected errors', async () => {
    const forbidden = handler({}, () => {
      throw new HttpError(403, 'FORBIDDEN', 'Admin access is required')
    })
    const response = await forbidden(new Request('http://localhost'))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      code: 'FORBIDDEN',
      message: 'Admin access is required',
    })
    const failure = handler({}, () => {
      throw new Error('private connection details')
    })
    const failed = await failure(new Request('http://localhost'))
    expect(failed.status).toBe(500)
    expect(await failed.text()).not.toContain('private connection details')
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'GET'])(
    'limits write and auth routes before parsing: %s',
    async (method) => {
      const run = vi.fn()
      const consume = vi
        .fn()
        .mockResolvedValue({ allowed: false, retryAfter: 12 })
      const route = handler(
        {
          auth: method === 'GET',
          rateLimiter: { consume },
          rateLimitKey: () => 'trusted-key',
          schema: z.object({ value: z.number() }),
        },
        run,
      )
      const response = await route(new Request('http://localhost', { method }))
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('12')
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      })
      expect(consume).toHaveBeenCalledWith('trusted-key')
      expect(run).not.toHaveBeenCalled()
    },
  )

  it('does not limit ordinary reads', async () => {
    const consume = vi.fn()
    const route = handler({ rateLimiter: { consume } }, () => ({ ok: true }))
    expect((await route(new Request('http://localhost'))).status).toBe(200)
    expect(consume).not.toHaveBeenCalled()
  })

  it('fails closed for production writes without a shared limiter and trusted key', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const run = vi.fn()
    const route = handler({}, run)
    expect((await route(request('{}'))).status).toBe(500)
    expect(run).not.toHaveBeenCalled()
  })

  it('supports explicit response status codes without caching', async () => {
    const route = handler({}, () =>
      Response.json({ ok: false }, { status: 503 }),
    )
    const response = await route(new Request('http://localhost'))
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('in-memory rate limiter', () => {
  it('isolates keys, enforces the limit and expires short-lived keys', () => {
    vi.useFakeTimers()
    const limiter = new MemoryRateLimiter(2, 1000, 2)
    try {
      expect(limiter.consume('a').allowed).toBe(true)
      expect(limiter.consume('a').allowed).toBe(true)
      expect(limiter.consume('a')).toEqual({ allowed: false, retryAfter: 1 })
      expect(limiter.consume('b').allowed).toBe(true)
      expect(limiter.consume('c').allowed).toBe(false)
      vi.advanceTimersByTime(1000)
      expect(limiter.consume('c').allowed).toBe(true)
      expect(limiter.consume('a').allowed).toBe(true)
    } finally {
      limiter.dispose()
    }
  })

  it('removes idle keys on the timer without another request', () => {
    vi.useFakeTimers()
    const limiter = new MemoryRateLimiter(1, 1000)
    const entries = (limiter as unknown as { entries: Map<string, unknown> })
      .entries
    limiter.consume('short-lived')
    expect(entries.size).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(entries.size).toBe(0)
    limiter.dispose()
  })

  it('rejects invalid settings', () => {
    expect(() => new MemoryRateLimiter(0)).toThrow('must be positive')
  })
})
