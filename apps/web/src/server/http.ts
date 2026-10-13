import { z } from 'zod'

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORISED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export type RateLimitResult = { allowed: boolean; retryAfter: number }
export interface RateLimiter {
  consume(key: string): RateLimitResult | Promise<RateLimitResult>
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<
    string,
    { count: number; expiresAt: number }
  >()
  private readonly timer: ReturnType<typeof setInterval>

  constructor(
    private readonly limit = 20,
    private readonly windowMs = 60_000,
    private readonly maxKeys = 10_000,
  ) {
    if (limit <= 0 || windowMs <= 0 || maxKeys <= 0) {
      throw new Error('Rate limit settings must be positive')
    }
    this.timer = setInterval(() => this.prune(), windowMs)
    this.timer.unref?.()
  }

  private prune() {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key)
    }
  }

  consume(key: string): RateLimitResult {
    const now = Date.now()
    this.prune()
    let entry = this.entries.get(key)
    if (!entry) {
      if (this.entries.size >= this.maxKeys) {
        return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) }
      }
      entry = { count: 0, expiresAt: now + this.windowMs }
      this.entries.set(key, entry)
    }
    entry.count += 1
    return {
      allowed: entry.count <= this.limit,
      retryAfter: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
    }
  }

  dispose() {
    clearInterval(this.timer)
    this.entries.clear()
  }
}

const devLimiter = new MemoryRateLimiter()
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

type HandlerOptions<T> = {
  schema?: z.ZodType<T>
  maxBodyBytes?: number
  auth?: boolean
  rateLimiter?: RateLimiter
  rateLimitKey?: (request: Request) => string | Promise<string>
}

export const handler =
  <T = undefined, R = unknown>(
    options: HandlerOptions<T>,
    run: (input: T, request: Request) => R | Promise<R>,
  ) =>
  async (request: Request): Promise<Response> => {
    try {
      if (options.auth || writeMethods.has(request.method)) {
        // Production must inject a shared limiter and a trusted identity resolver.
        if (
          process.env.NODE_ENV === 'production' &&
          (!options.rateLimiter || !options.rateLimitKey)
        ) {
          throw new Error('Production rate limiting is not configured')
        }
        const key = options.rateLimitKey
          ? await options.rateLimitKey(request)
          : 'development'
        const result = await (options.rateLimiter ?? devLimiter).consume(key)
        if (!result.allowed) {
          return Response.json(
            { code: 'RATE_LIMITED', message: 'Too many requests' },
            {
              status: 429,
              headers: {
                'Retry-After': String(result.retryAfter),
                'Cache-Control': 'no-store',
              },
            },
          )
        }
      }

      let input: T = undefined as T
      if (options.schema) {
        let body: unknown
        try {
          if (options.maxBodyBytes !== undefined) {
            const limit = options.maxBodyBytes
            if (Number(request.headers.get('Content-Length')) > limit) {
              throw new HttpError(
                413,
                'INVALID_REQUEST',
                'Invalid request body',
              )
            }
            const reader = request.body?.getReader()
            const chunks: Uint8Array[] = []
            let size = 0
            if (reader) {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                size += value.byteLength
                if (size > limit) {
                  await reader.cancel()
                  throw new HttpError(
                    413,
                    'INVALID_REQUEST',
                    'Invalid request body',
                  )
                }
                chunks.push(value)
              }
            }
            const bytes = new Uint8Array(size)
            let offset = 0
            for (const chunk of chunks) {
              bytes.set(chunk, offset)
              offset += chunk.byteLength
            }
            body = JSON.parse(
              new TextDecoder('utf-8', { fatal: true }).decode(bytes),
            )
          } else {
            body = await request.json()
          }
        } catch (error) {
          if (error instanceof HttpError) throw error
          throw new HttpError(400, 'INVALID_REQUEST', 'Invalid JSON body')
        }
        const parsed = options.schema.safeParse(body)
        if (!parsed.success) {
          throw new HttpError(400, 'INVALID_REQUEST', 'Invalid request body')
        }
        input = parsed.data
      }
      const result = await run(input, request)
      if (result instanceof Response) {
        result.headers.set('Cache-Control', 'no-store')
        return result
      }
      return Response.json(result, {
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch (error) {
      const known = error instanceof HttpError
      return Response.json(
        {
          code: known ? error.code : 'INTERNAL_ERROR',
          message: known ? error.message : 'An unexpected error occurred',
        },
        {
          status: known ? error.status : 500,
          headers: { 'Cache-Control': 'no-store' },
        },
      )
    }
  }
