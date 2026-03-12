/**
 * useEfficacyInsights — medication-vital correlation insights.
 *
 * Calls the EfficacyService to correlate vitals with dose logs,
 * then uses the AI endpoint to generate a natural-language insight
 * for any medication with a statistically meaningful change (|delta| >= 5).
 */
import { useQuery } from '@tanstack/react-query'
import { EfficacyService } from '@/shared/services/efficacy'
import { AIService } from '@/shared/services/ai'
import type { Vital } from '@/shared/services/vitals'
import { useAIConsent } from '@/shared/hooks/useAIConsent'
import { useSubscription } from '@/shared/hooks/useSubscription'

export interface EfficacyInsight {
  medicationId: string
  medicationName: string
  vitalLabel: string
  unit: string
  delta: number
  summary: string // AI-generated sentence
}

async function buildEfficacyInsights(vitals: Vital[]): Promise<EfficacyInsight[]> {
  const correlations = await EfficacyService.getCorrelations(vitals)
  const meaningful = correlations.filter((c) => c.delta != null && Math.abs(c.delta) >= 5)
  if (meaningful.length === 0) return []

  const prompt = `You are a data summarization assistant. Based on this medication tracking data, write ONE concise sentence (max 25 words) for each item describing the observed correlation between the medication start date and the vital change. Be factual, no medical advice. Do not imply causation. Do not give medical advice. Present data as observations only.

Data:
${meaningful.map((c) => `- ${c.medicationName}: ${c.vitalLabel} changed by ${c.delta} ${c.unit} (before avg: ${c.avgBeforeStart}, after avg: ${c.avgAfterStart})`).join('\n')}

Reply with a JSON array: [{"medicationId": "...", "summary": "..."}]`

  try {
    const response = await AIService.chat([{ role: 'user', content: prompt }])
    const json = JSON.parse(response) as Array<{ medicationId: string; summary: string }>
    return meaningful.map((c) => {
      const match = json.find((j) => j.medicationId === c.medicationId) ?? { summary: '' }
      return {
        medicationId: c.medicationId,
        medicationName: c.medicationName,
        vitalLabel: c.vitalLabel,
        unit: c.unit,
        delta: c.delta!,
        summary: match.summary || `After starting ${c.medicationName}, a change of ${Math.abs(c.delta!)} ${c.unit} was observed in your ${c.vitalLabel}.`,
      }
    })
  } catch {
    // AI unavailable — return plain-text fallback
    return meaningful.map((c) => ({
      medicationId: c.medicationId,
      medicationName: c.medicationName,
      vitalLabel: c.vitalLabel,
      unit: c.unit,
      delta: c.delta!,
      summary: `After starting ${c.medicationName}, a change of ${Math.abs(c.delta!)} ${c.unit} was observed in your ${c.vitalLabel}.`,
    }))
  }
}

export function useEfficacyInsights(vitals: Vital[]) {
  const { consented } = useAIConsent()
  const { canUseAi } = useSubscription()

  return useQuery({
    queryKey: ['efficacy-insights', vitals.length],
    queryFn: () => buildEfficacyInsights(vitals),
    enabled: vitals.length >= 5 && consented && canUseAi,
    staleTime: 30 * 60 * 1000, // 30 min
    retry: false,
  })
}
