import { describe, it, expect, vi } from 'vitest'

import { buildRateLimitHeaders, runQuotaTrackedRequest } from '../../../supabase/functions/_shared/quota-tracker'

describe('runQuotaTrackedRequest', () => {
  const baseHeaders = { 'Content-Type': 'application/json' }

  it('does not increment usage for invalid body', async () => {
    const incrementUsage = vi.fn(async () => 6)

    const result = await runQuotaTrackedRequest({
      limit: 50,
      currentUsage: 5,
      resetAt: 12345,
      retryAfterSeconds: 999,
      baseHeaders,
      limitReachedMessage: 'limit reached',
      validate: async () => ({
        ok: false,
        response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: baseHeaders,
        }),
      }),
      callProvider: async () => ({ ok: true, data: { ok: true } }),
      incrementUsage,
    })

    expect(result.ok).toBe(false)
    expect(incrementUsage).not.toHaveBeenCalled()
    expect(await result.response?.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('does not increment usage when provider returns 429/5xx', async () => {
    const incrementUsage = vi.fn(async () => 6)

    const result = await runQuotaTrackedRequest({
      limit: 50,
      currentUsage: 5,
      resetAt: 12345,
      retryAfterSeconds: 999,
      baseHeaders,
      limitReachedMessage: 'limit reached',
      validate: async () => ({ ok: true, data: undefined }),
      callProvider: async () => ({
        ok: false,
        response: new Response(JSON.stringify({ error: 'Request failed' }), {
          status: 503,
          headers: baseHeaders,
        }),
      }),
      incrementUsage,
    })

    expect(result.ok).toBe(false)
    expect(incrementUsage).not.toHaveBeenCalled()
    expect(result.response?.status).toBe(503)
  })

  it('increments usage on success and returns updated rate-limit headers', async () => {
    const result = await runQuotaTrackedRequest({
      limit: 50,
      currentUsage: 5,
      resetAt: 12345,
      retryAfterSeconds: 999,
      baseHeaders,
      limitReachedMessage: 'limit reached',
      validate: async () => ({ ok: true, data: undefined }),
      callProvider: async () => ({ ok: true, data: { ok: true } }),
      incrementUsage: async () => 6,
    })

    expect(result.ok).toBe(true)
    expect(result.newUsage).toBe(6)

    const headers = buildRateLimitHeaders(50, result.newUsage!, 12345)
    expect(headers).toEqual({
      'X-RateLimit-Limit': '50',
      'X-RateLimit-Remaining': '44',
      'X-RateLimit-Reset': '12345',
    })
  })
})
