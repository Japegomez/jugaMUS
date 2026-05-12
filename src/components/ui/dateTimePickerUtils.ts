export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDisplay(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Parse stored ISO-like local string to Date (no trailing Z). */
export function parseIsoToDate(iso: string): Date {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return new Date()
  return d
}

/** Format as `YYYY-MM-DDTHH:mm:00` in local timezone (matches previous contract). */
export function dateToLocalIsoString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
}

/** Value for HTML `datetime-local` input. */
export function toDatetimeLocalValue(iso: string): string {
  const d = parseIsoToDate(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function fromDatetimeLocalValue(s: string): string {
  if (!s.trim()) return dateToLocalIsoString(new Date())
  const d = new Date(s)
  if (isNaN(d.getTime())) return dateToLocalIsoString(new Date())
  return dateToLocalIsoString(d)
}

/** Start of local calendar day as UTC ISO (timestamptz-friendly). */
export function dateToStartOfLocalDayIso(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  return x.toISOString()
}

/** End of local calendar day as UTC ISO. */
export function dateToEndOfLocalDayIso(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  return x.toISOString()
}
