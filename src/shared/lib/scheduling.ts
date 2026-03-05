/**
 * Generates evenly spaced dose times across a 24-hour period.
 * @param count - number of doses per day
 * @param baseTime - optional "HH:MM" anchor for first dose (default "08:00")
 */
export function generateEvenlySpacedTimes(count: number, baseTime?: string): string[] {
  const base = baseTime ?? '08:00'
  const [h] = base.split(':').map(Number)
  const interval = Math.floor(24 / count)
  return Array.from({ length: count }, (_, i) => {
    const hr = (h + i * interval) % 24
    return `${String(hr).padStart(2, '0')}:00`
  })
}
