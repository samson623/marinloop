export interface MedLookupResult {
  name: string
  dosage: string
  instructions: string
  warnings: string
}

function cleanText(text: string | undefined): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

/** Check if string looks like hyphenated NDC (e.g. 0378-4117-01) */
function isHyphenatedNdc(s: string): boolean {
  return /^\d{4,5}-\d{3,4}-\d{1,2}$/.test(s.replace(/\s/g, ''))
}

/** Convert barcode to possible NDC search terms. */
function upcToNdcVariants(barcode: string): string[] {
  const digits = barcode.replace(/\D/g, '')
  if (digits.length < 10) return []

  // Pass through hyphenated NDC as-is
  if (isHyphenatedNdc(barcode)) {
    const normalized = barcode.replace(/\s/g, '')
    return [normalized]
  }

  // UPC-A = 12 digits: strip leading digit and check digit → 10-digit NDC
  // 11 digits: use first 10. 10 digits: use as-is.
  let ndc10: string
  if (digits.length >= 12) {
    ndc10 = digits.slice(1, 11)
  } else if (digits.length === 11) {
    ndc10 = digits.slice(0, 10)
  } else {
    ndc10 = digits.slice(0, 10)
  }

  const variants = [
    `${ndc10.slice(0, 4)}-${ndc10.slice(4, 8)}-${ndc10.slice(8, 10)}`,
    `${ndc10.slice(0, 5)}-${ndc10.slice(5, 8)}-${ndc10.slice(8, 10)}`,
    `${ndc10.slice(0, 5)}-${ndc10.slice(5, 9)}-${ndc10.slice(9, 10)}`,
  ]

  // 11-digit zero-padded variants (5-4-2)
  const ndc11 = digits.length >= 11 ? digits.slice(0, 11) : ndc10 + '0'
  if (ndc11.length >= 11) {
    variants.push(
      `${ndc11.slice(0, 5)}-${ndc11.slice(5, 9)}-${ndc11.slice(9, 11)}`
    )
  }

  return [...new Set(variants)]
}

function extractFromNdcResult(product: {
  brand_name?: string
  generic_name?: string
  active_ingredients?: Array<{ strength: string }>
  route?: string[]
  dosage_form?: string
  pharm_class?: string[]
}): MedLookupResult {
  const name = product.brand_name || product.generic_name || ''
  const strength = product.active_ingredients
    ?.map((i) => i.strength)
    .join(', ') || ''
  const route = product.route?.[0] || ''
  const dosageForm = product.dosage_form || ''
  return {
    name,
    dosage: strength,
    instructions: [dosageForm, route].filter(Boolean).join(' — '),
    warnings: product.pharm_class?.join(', ') || '',
  }
}

export async function lookupByBarcode(barcode: string): Promise<MedLookupResult | null> {
  const digits = barcode.replace(/\D/g, '')

  // Strategy 1: Search by UPC directly (openfda.upc if available)
  if (digits.length >= 11) {
    try {
      const upcRes = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=openfda.upc:"${digits}"&limit=1`
      )
      if (upcRes.ok) {
        const data = await upcRes.json()
        const product = data.results?.[0]
        if (product) return extractFromNdcResult(product)
      }
    } catch {
      // continue to next strategy
    }
  }

  const ndcVariants = upcToNdcVariants(barcode)
  if (ndcVariants.length === 0) return null

  // Strategy 2: packaging.package_ndc
  for (const ndc of ndcVariants) {
    try {
      const ndcRes = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=packaging.package_ndc:"${ndc}"&limit=1`
      )
      if (ndcRes.ok) {
        const data = await ndcRes.json()
        const product = data.results?.[0]
        if (product) return extractFromNdcResult(product)
      }
    } catch {
      // try next
    }
  }

  // Strategy 3: product_ndc (without package segment)
  for (const ndc of ndcVariants) {
    const productNdc = ndc.split('-').slice(0, 2).join('-')
    try {
      const res = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=product_ndc:"${productNdc}"&limit=1`
      )
      if (res.ok) {
        const data = await res.json()
        const product = data.results?.[0]
        if (product) return extractFromNdcResult(product)
      }
    } catch {
      // try next
    }
  }

  // Strategy 4: drug/label endpoint for richer data
  for (const ndc of ndcVariants) {
    try {
      const labelRes = await fetch(
        `https://api.fda.gov/drug/label.json?search=openfda.package_ndc:"${ndc}"&limit=1`
      )
      if (labelRes.ok) {
        const data = await labelRes.json()
        const label = data.results?.[0]
        if (label) {
          return {
            name: cleanText(label.openfda?.brand_name?.[0] || label.openfda?.generic_name?.[0]),
            dosage: cleanText(label.dosage_and_administration?.[0]),
            instructions: cleanText(label.indications_and_usage?.[0]),
            warnings: cleanText(label.warnings?.[0] || label.warnings_and_cautions?.[0]),
          }
        }
      }
    } catch {
      // try next
    }
  }

  return null
}
