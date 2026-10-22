// The API returns DATE columns either as 'YYYY-MM-DD' or as an ISO timestamp.
// Plain dates are parsed as local dates so they don't shift a day in negative UTC offsets.
export function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value)
  return isNaN(date.getTime()) ? null : date
}

export function formatDate(value, options = {}) {
  const { fallback = '—', ...intlOptions } = options
  const date = parseDate(value)
  if (!date) return fallback
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...intlOptions })
}

export function dateParts(value) {
  const date = parseDate(value)
  if (!date) return null
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.getDate(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

export function formatTime(startTime, endTime) {
  if (!startTime) return ''
  const fmt = (t) => {
    const [h, m] = t.split(':')
    const d = new Date()
    d.setHours(Number(h), Number(m))
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return endTime ? `${fmt(startTime)} – ${fmt(endTime)}` : fmt(startTime)
}

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function isUpcoming(value) {
  const date = parseDate(value)
  return Boolean(date) && date >= startOfToday()
}

// 'YYYY-MM-DD' for <input type="date">
export function toInputDate(value) {
  const date = parseDate(value)
  if (!date) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatHours(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function compareByDate(a, b, key = 'event_date') {
  return (parseDate(a[key])?.getTime() ?? Infinity) - (parseDate(b[key])?.getTime() ?? Infinity)
}

export function spotsLabel(opportunity) {
  if (opportunity.spots_remaining == null) return null
  const left = Number(opportunity.spots_remaining)
  if (left <= 0) return 'Full'
  return `${left} of ${opportunity.capacity} spots left`
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}
