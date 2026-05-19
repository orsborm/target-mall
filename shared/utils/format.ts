/** Format cents to yuan display string.
 *  Guards against null, undefined, NaN, and Infinity so corrupted pricing
 *  data from the API never renders as "NaN" or "Infinity" in the UI. */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '--'
  if (typeof cents !== 'number' || isNaN(cents) || !isFinite(cents)) return '--'
  return (cents / 100).toFixed(2)
}

/** Convert yuan (number) to cents (integer).
 *  Returns 0 for invalid inputs (NaN, Infinity) instead of propagating
 *  garbage into the pricing pipeline. */
export function toCents(yuan: number): number {
  if (typeof yuan !== 'number' || isNaN(yuan) || !isFinite(yuan)) return 0
  return Math.round(yuan * 100)
}

/** Convert cents (integer) to yuan (number).
 *  Returns 0 for invalid inputs — see toCents rationale. */
export function fromCents(cents: number): number {
  if (typeof cents !== 'number' || isNaN(cents) || !isFinite(cents)) return 0
  return Math.round(cents) / 100
}

/** Default page size for list views */
export const DEFAULT_PAGE_SIZE = 20

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  // Return empty string for invalid dates instead of echoing back the
  // unparseable input — callers can now distinguish valid dates trivially.
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${mi}`
}
