import { useQuery } from '@tanstack/react-query'
import { useAdherenceHistory } from '@/shared/hooks/useAdherenceHistory'
import { useMedications } from '@/shared/hooks/useMedications'
import { AIService } from '@/shared/services/ai'
import type { ChatMessage } from '@/shared/services/ai'
import { useAIConsent } from '@/shared/hooks/useAIConsent'
import { useSubscription } from '@/shared/hooks/useSubscription'

export interface InsightCard {
  id: string
  type: 'pattern' | 'praise' | 'suggestion'
  title: string
  body: string
}

const STALE_TIME = 6 * 60 * 60 * 1000 // 6 hours

interface RawInsight {
  type: unknown
  title: unknown
  body: unknown
}

function isValidType(value: unknown): value is InsightCard['type'] {
  return value === 'pattern' || value === 'praise' || value === 'suggestion'
}

function stableId(type: string, title: string): string {
  const raw = `${type}:${title}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return `insight-${hash.toString(36)}`
}

function parseInsights(raw: string): InsightCard[] {
  try {
    // Strip markdown code fences if the model wraps the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed: unknown = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []

    const cards: InsightCard[] = []
    for (const item of parsed as RawInsight[]) {
      if (
        typeof item !== 'object' ||
        item === null ||
        !isValidType(item.type) ||
        typeof item.title !== 'string' ||
        typeof item.body !== 'string'
      ) {
        continue
      }
      cards.push({
        id: stableId(item.type, item.title),
        type: item.type,
        title: item.title,
        body: item.body,
      })
    }
    return cards.slice(0, 3)
  } catch {
    return []
  }
}

export function useAdherenceInsights(): {
  insights: InsightCard[]
  isLoading: boolean
  isError: boolean
} {
  const { consented } = useAIConsent()
  const { canUseAi } = useSubscription()
  const { adherence, isLoading: adherenceLoading } = useAdherenceHistory(30)
  const { meds, isLoading: medsLoading } = useMedications()

  const dataReady = !adherenceLoading && !medsLoading

  // Count days where at least one dose was expected (t > 0)
  const activeDays = dataReady
    ? Object.values(adherence).filter(v => v.t > 0).length
    : 0

  const enabled = dataReady && activeDays >= 7 && consented && canUseAi

  const { data, isLoading: queryLoading, isError } = useQuery<InsightCard[]>({
    queryKey: ['adherence-insights'],
    queryFn: async (): Promise<InsightCard[]> => {
      try {
        // Build adherence summary lines sorted by date
        const summaryLines = Object.entries(adherence)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, { t, d }]) => `${date}: ${d}/${t}`)
          .join(', ')

        const medNames = meds.map(m => m.name).join(', ')

        const messages: ChatMessage[] = [
          {
            role: 'system',
            content:
              "You are a helpful medication adherence coach. Analyze the user's medication adherence data and return ONLY a valid JSON array of insight objects. Each object must have: type ('pattern'|'praise'|'suggestion'), title (short, max 8 words), and body (1-2 sentences, encouraging and actionable). Return between 1 and 3 insights. Do not include any text outside the JSON array.",
          },
          {
            role: 'user',
            content: `Last 30 days adherence: ${summaryLines}\nMedications: ${medNames}`,
          },
        ]

        const raw = await AIService.chat(messages)
        return parseInsights(raw)
      } catch {
        return []
      }
    },
    staleTime: STALE_TIME,
    enabled,
  })

  return {
    insights: data ?? [],
    isLoading: adherenceLoading || medsLoading || queryLoading,
    isError,
  }
}
