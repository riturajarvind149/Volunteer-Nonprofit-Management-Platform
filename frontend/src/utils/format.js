export function formatDate(dateStr, options = {}) {
  if (!dateStr) return options.fallback ?? 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    })
  } catch {
    return dateStr
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
