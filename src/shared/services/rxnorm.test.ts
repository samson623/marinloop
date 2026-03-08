import { vi, describe, it, expect, afterEach } from 'vitest'

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { supabase } from '@/shared/lib/supabase'

const mockInvoke = vi.mocked(supabase.functions.invoke)

afterEach(() => {
  vi.clearAllMocks()
})

function mockInvokeOk(data: unknown) {
  mockInvoke.mockResolvedValueOnce({ data, error: null } as never)
}

function mockInvokeError() {
  mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('invoke error') } as never)
}

function mockInvokeThrow(message = 'Network error') {
  mockInvoke.mockRejectedValueOnce(new Error(message))
}

function rxcuiResponse(rxnormId: string | undefined) {
  return {
    idGroup: rxnormId
      ? { rxnormId: [rxnormId], name: 'Metformin' }
      : { name: 'UnknownDrug' },
  }
}

function interactionResponse(overrides: {
  severity?: string
  description?: string
  drug1?: string
  drug2?: string
} = {}) {
  const {
    severity = 'high',
    description = 'Concurrent use may increase risk of adverse effects.',
    drug1 = 'warfarin',
    drug2 = 'aspirin',
  } = overrides
  return {
    fullInteractionTypeGroup: [
      {
        fullInteractionType: [
          {
            interactionPair: [
              {
                severity,
                description,
                interactionConcept: [
                  { minConceptItem: { name: drug1 } },
                  { minConceptItem: { name: drug2 } },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

import { lookupRxCUI, getDrugInteractions, getOpenFDALabel } from '@/shared/services/rxnorm'

describe('lookupRxCUI()', () => {
  it('returns the first RxCUI from a successful NIH RxNav response', async () => {
    mockInvokeOk(rxcuiResponse('6809'))

    const result = await lookupRxCUI('Metformin')

    expect(result).toBe('6809')
    expect(mockInvoke).toHaveBeenCalledWith(
      'drug-reference',
      expect.objectContaining({ body: expect.objectContaining({ action: 'lookupRxCUI' }) }),
    )
  })

  it('returns null when the drug is not found', async () => {
    mockInvokeOk(rxcuiResponse(undefined))

    const result = await lookupRxCUI('NotARealDrug')

    expect(result).toBeNull()
  })

  it('returns null when the invoke call returns an error', async () => {
    mockInvokeError()

    const result = await lookupRxCUI('Metformin')

    expect(result).toBeNull()
  })

  it('returns null on network failure', async () => {
    mockInvokeThrow('Failed to fetch')

    const result = await lookupRxCUI('Metformin')

    expect(result).toBeNull()
  })

  it('returns null for a whitespace-only drug name without making any network call', async () => {
    const result = await lookupRxCUI('   ')

    expect(result).toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})

describe('getDrugInteractions()', () => {
  it('parses a high-severity interaction and returns the structured result', async () => {
    mockInvokeOk(
      interactionResponse({ severity: 'High', description: 'Risk of bleeding.', drug1: 'warfarin', drug2: 'aspirin' }),
    )

    const result = await getDrugInteractions(['855332', '1191'])

    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('high')
    expect(result[0].description).toBe('Risk of bleeding.')
    expect(result[0].drug1).toBe('warfarin')
    expect(result[0].drug2).toBe('aspirin')
  })

  it('maps "contraindicated" severity to the "high" tier', async () => {
    mockInvokeOk(interactionResponse({ severity: 'Contraindicated' }))

    const result = await getDrugInteractions(['rxcui-a', 'rxcui-b'])

    expect(result[0].severity).toBe('high')
  })

  it('maps "moderate" severity correctly', async () => {
    mockInvokeOk(interactionResponse({ severity: 'Moderate' }))

    const result = await getDrugInteractions(['rxcui-a', 'rxcui-b'])

    expect(result[0].severity).toBe('moderate')
  })

  it('maps unknown severity string to "low"', async () => {
    mockInvokeOk(interactionResponse({ severity: 'minor' }))

    const result = await getDrugInteractions(['rxcui-a', 'rxcui-b'])

    expect(result[0].severity).toBe('low')
  })

  it('returns empty array when fewer than 2 RxCUIs are provided', async () => {
    const result = await getDrugInteractions(['6809'])

    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns empty array for empty rxcui list', async () => {
    const result = await getDrugInteractions([])

    expect(result).toEqual([])
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns empty array on invoke error', async () => {
    mockInvokeError()

    const result = await getDrugInteractions(['rxcui-a', 'rxcui-b'])

    expect(result).toEqual([])
  })

  it('returns empty array on network failure', async () => {
    mockInvokeThrow()

    const result = await getDrugInteractions(['rxcui-a', 'rxcui-b'])

    expect(result).toEqual([])
  })
})

describe('getOpenFDALabel()', () => {
  it('returns food interactions and contraindications from the label', async () => {
    mockInvokeOk({
      results: [
        {
          food_and_drug_interaction: ['Avoid grapefruit juice.'],
          contraindications: ['Do not use with MAO inhibitors.'],
        },
      ],
    })

    const result = await getOpenFDALabel('6809')

    expect(result.foodInteractions).toBe('Avoid grapefruit juice.')
    expect(result.contraindications).toBe('Do not use with MAO inhibitors.')
  })

  it('strips HTML tags from label text', async () => {
    mockInvokeOk({
      results: [
        {
          food_and_drug_interaction: ['<p>Avoid <b>grapefruit</b> juice.</p>'],
          contraindications: [],
        },
      ],
    })

    const result = await getOpenFDALabel('6809')

    expect(result.foodInteractions).toBe('Avoid grapefruit juice.')
  })

  it('returns empty object when rxcui is blank', async () => {
    const result = await getOpenFDALabel('')

    expect(result).toEqual({})
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('returns empty object on network failure', async () => {
    mockInvokeThrow()

    const result = await getOpenFDALabel('6809')

    expect(result).toEqual({})
  })

  it('returns empty object when the API response has no results', async () => {
    mockInvokeOk({ results: [] })

    const result = await getOpenFDALabel('6809')

    expect(result).toEqual({})
  })
})
