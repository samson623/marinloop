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
import { useAIConsent } from '@/shared/components/AIConsentModal'

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

  const prompt = `You are a clinical data analyst. Based on this medication efficacy data, write ONE concise sentence (max 25 words) for each item describing the correlation between starting the medication and the vital change. Be factual, no medical advice.

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
        summary: match.summary || `Since starting ${c.medicationName}, your ${c.vitalLabel} changed by ${Math.abs(c.delta!)} ${c.unit}.`,
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
      summary: `Since starting ${c.medicationName}, your ${c.vitalLabel} ${c.delta! < 0 ? 'decreased' : 'increased'} by ${Math.abs(c.delta!)} ${c.unit}.`,
    }))
  }
}

export function useEfficacyInsights(vitals: Vital[]) {
  const { consented } = useAIConsent()

  return useQuery({
    queryKey: ['efficacy-insights', vitals.length],
    queryFn: () => buildEfficacyInsights(vitals),
    enabled: vitals.length >= 5 && consented,
    staleTime: 30 * 60 * 1000, // 30 min
    retry: false,
  })
}
