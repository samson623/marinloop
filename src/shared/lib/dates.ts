/**
 * Date helpers using local timezone.
 * All functions return YYYY-MM-DD or HH:MM in the user's local timezone.
 */

/** YYYY-MM-DD in user's local timezone */
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD for a given Date in local timezone */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** HH:MM from ISO timestamp in local timezone */
export function toLocalTimeString(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Local date string (YYYY-MM-DD) from ISO timestamp */
export function isoToLocalDate(iso: string): string {
  return toLocalDateString(new Date(iso))
}

/** Local date n days from today (for dOff replacement) */
export function dateOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toLocalDateString(d)
}
