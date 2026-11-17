import './MonthlyBars.css'

/**
 * Small vertical bar chart for a month-by-month series, e.g. hours or registrations
 * over the last six months. `rows` is [{ month: 'Jan', year: 2026, value: 12 }].
 */
function MonthlyBars({ rows, format = (v) => String(v), unit, label }) {
  const max = Math.max(0, ...rows.map((r) => Number(r.value) || 0))
  const summary = rows.map((r) => `${r.month} ${r.year}: ${format(r.value)}${unit ? ` ${unit}` : ''}`).join(', ')

  return (
    <figure className="month-bars">
      <div className="month-bars-plot" role="img" aria-label={`${label}. ${summary}`}>
        {rows.map((r) => {
          const value = Number(r.value) || 0
          const height = max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0
          return (
            <div key={`${r.year}-${r.month}`} className="month-bar">
              <span className="month-bar-value" aria-hidden="true">{value > 0 ? format(value) : ''}</span>
              <span className="month-bar-track" aria-hidden="true">
                <span className="month-bar-fill" style={{ height: `${height}%` }} />
              </span>
              <span className="month-bar-label" aria-hidden="true">{r.month}</span>
            </div>
          )
        })}
      </div>
      {max === 0 && <figcaption className="month-bars-empty">Nothing recorded in these months yet.</figcaption>}
    </figure>
  )
}

export default MonthlyBars
