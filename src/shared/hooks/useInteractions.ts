import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lookupRxCUI, getDrugInteractions } from '@/shared/services/rxnorm'
import type { DrugInteraction } from '@/shared/services/rxnorm'

type MedRef = { id: string; name: string; rxcui?: string | null }

/** Resolve the RxCUI for a single medication name, with 24h cache. */
export function useRxCUI(name: string) {
  return useQuery({
    queryKey: ['rxcui', name.trim().toLowerCase()],
    queryFn: () => lookupRxCUI(name),
    enabled: name.trim().length > 2,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}

/** Check drug-drug interactions for a list of medications, with 1h cache.
 *  Pass `newMedName` to also check against a medication being added (before it's saved).
 */
export function useInteractions(meds: MedRef[], newMedName?: string): {
  interactions: DrugInteraction[]
  isLoading: boolean
} {
  const queryClient = useQueryClient()

  // Collect all names to resolve (existing saved meds + optional new one)
  const names = [
    ...meds.map((m) => ({ id: m.id, name: m.name, rxcui: m.rxcui })),
    ...(newMedName?.trim() && newMedName.trim().length > 2
      ? [{ id: '__new__', name: newMedName.trim(), rxcui: undefined }]
      : []),
  ]

  // Resolve RxCUIs: use stored rxcui when available, otherwise look up by name
  const resolveRxcuis = async (): Promise<string[]> => {
    const results: string[] = []
    for (const med of names) {
      if (med.rxcui) {
        results.push(med.rxcui)
      } else {
        const cacheKey = ['rxcui', med.name.trim().toLowerCase()]
        let cached = queryClient.getQueryData<string | null>(cacheKey)
        if (cached === undefined) {
          cached = await queryClient.fetchQuery({
            queryKey: cacheKey,
            queryFn: () => lookupRxCUI(med.name),
            staleTime: 24 * 60 * 60 * 1000,
          })
        }
        if (cached) results.push(cached)
      }
    }
    return results.filter(Boolean)
  }

  const sortedNames = [...names.map((m) => m.name)].sort().join('|')

  const { data, isLoading } = useQuery({
    queryKey: ['interactions', sortedNames],
    queryFn: async () => {
      const rxcuis = await resolveRxcuis()
      return getDrugInteractions(rxcuis)
    },
    enabled: names.length >= 2,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  return { interactions: data ?? [], isLoading }
}
