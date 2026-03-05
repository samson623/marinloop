export function getSupplyInfo(supply: number, total: number, dosesPerDay: number) {
  const pct = total > 0 ? (supply / total) * 100 : 0
  const days = dosesPerDay > 0 ? Math.floor(supply / dosesPerDay) : 0
  const color = pct < 20 ? 'var(--color-red)' : pct < 40 ? 'var(--color-amber)' : 'var(--color-green)'
  return { pct, days, color }
}
