export function buildRateLimitHeaders(limit: number, requestCount: number, resetAt: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, limit - requestCount)),
    'X-RateLimit-Reset': String(resetAt),
  }
}

interface SuccessResult<T> {
  ok: true
  data: T
}

interface FailureResult {
  ok: false
  response: Response
}

export type StepResult<T> = SuccessResult<T> | FailureResult

interface QuotaTrackedRequestArgs<T> {
  limit: number
  currentUsage: number
  resetAt: number
  retryAfterSeconds: number
  baseHeaders: Record<string, string>
  limitReachedMessage: string
  validate: () => Promise<StepResult<void>>
  callProvider: () => Promise<StepResult<T>>
  incrementUsage: () => Promise<number>
}

export interface QuotaTrackedRequestResult<T> {
  ok: boolean
  response?: Response
  data?: T
  newUsage?: number
}

export async function runQuotaTrackedRequest<T>(
  args: QuotaTrackedRequestArgs<T>,
): Promise<QuotaTrackedRequestResult<T>> {
  const {
    limit,
    currentUsage,
    resetAt,
    retryAfterSeconds,
    baseHeaders,
    limitReachedMessage,
    validate,
    callProvider,
    incrementUsage,
  } = args

  if (currentUsage >= limit) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: limitReachedMessage }),
        {
          status: 429,
          headers: {
            ...baseHeaders,
            ...buildRateLimitHeaders(limit, currentUsage, resetAt),
            'Retry-After': String(retryAfterSeconds),
          },
        },
      ),
    }
  }

  const validation = await validate()
  if (!validation.ok) {
    return { ok: false, response: validation.response }
  }

  const provider = await callProvider()
  if (!provider.ok) {
    return { ok: false, response: provider.response }
  }

  const newUsage = await incrementUsage()
  return {
    ok: true,
    data: provider.data,
    newUsage,
  }
}
