/** Format cents to yuan display string */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null || isNaN(cents)) return '--'
  return (cents / 100).toFixed(2)
}

/** Convert yuan (number) to cents (integer) */
export function toCents(yuan: number): number {
  return Math.round(yuan * 100)
}

/** Convert cents (integer) to yuan (number) */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

/** Default page size for list views */
export const DEFAULT_PAGE_SIZE = 20

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${mi}`
}
