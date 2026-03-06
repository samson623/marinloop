/** NIH RxNav + OpenFDA Drug Safety Service
 * Uses free APIs — no API key required.
 * RxNav docs: https://rxnav.nlm.nih.gov/RxNormAPIs.html
 */

export interface DrugInteraction {
  severity: 'high' | 'moderate' | 'low'
  description: string
  drug1: string
  drug2: string
}

export interface OpenFDALabelData {
  foodInteractions?: string
  contraindications?: string
}

function cleanText(text: string | undefined): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

/** Normalize a drug name to an RxCUI code using NIH RxNav. */
export async function lookupRxCUI(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(trimmed)}&search=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as {
      idGroup?: {
        rxnormId?: string[]
        name?: string
      }
    }
    const rxnormId = data?.idGroup?.rxnormId?.[0]
    return rxnormId ?? null
  } catch {
    return null
  }
}

/** Check for drug-drug interactions between a list of RxCUI codes. */
export async function getDrugInteractions(rxcuis: string[]): Promise<DrugInteraction[]> {
  const valid = rxcuis.filter(Boolean)
  if (valid.length < 2) return []

  try {
    const joined = valid.join('+')
    const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${joined}`
    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json() as {
      fullInteractionTypeGroup?: Array<{
        fullInteractionType?: Array<{
          interactionPair?: Array<{
            severity?: string
            description?: string
            interactionConcept?: Array<{
              minConceptItem?: { name?: string }
            }>
          }>
        }>
      }>
    }

    const interactions: DrugInteraction[] = []

    for (const group of data.fullInteractionTypeGroup ?? []) {
      for (const type of group.fullInteractionType ?? []) {
        for (const pair of type.interactionPair ?? []) {
          const sev = (pair.severity ?? '').toLowerCase()
          const severity: DrugInteraction['severity'] =
            sev.includes('high') || sev.includes('contraindicated')
              ? 'high'
              : sev.includes('moderate')
              ? 'moderate'
              : 'low'
          const drug1 = pair.interactionConcept?.[0]?.minConceptItem?.name ?? ''
          const drug2 = pair.interactionConcept?.[1]?.minConceptItem?.name ?? ''
          const description = pair.description ?? ''
          if (description) {
            interactions.push({ severity, description, drug1, drug2 })
          }
        }
      }
    }

    // Deduplicate by description
    const seen = new Set<string>()
    return interactions.filter((i) => {
      if (seen.has(i.description)) return false
      seen.add(i.description)
      return true
    })
  } catch {
    return []
  }
}

/** Fetch food interactions and contraindications for a drug from OpenFDA label endpoint. */
export async function getOpenFDALabel(rxcui: string): Promise<OpenFDALabelData> {
  if (!rxcui) return {}

  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.rxcui:"${encodeURIComponent(rxcui)}"&limit=1`
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = await res.json() as {
      results?: Array<{
        food_and_drug_interaction?: string[]
        contraindications?: string[]
      }>
    }
    const label = data.results?.[0]
    if (!label) return {}
    return {
      foodInteractions: cleanText(label.food_and_drug_interaction?.[0]),
      contraindications: cleanText(label.contraindications?.[0]),
    }
  } catch {
    return {}
  }
}
