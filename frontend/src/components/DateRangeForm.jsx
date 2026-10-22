import { useState } from 'react'

function DateRangeForm({ label, value, onApply, disabled }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const isApplied = Boolean(value.from_date || value.to_date)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (draft.from_date && draft.to_date && draft.from_date > draft.to_date) {
      setError('The start date must be on or before the end date.')
      return
    }
    setError('')
    onApply({ ...draft })
  }

  const handleClear = () => {
    const empty = { from_date: '', to_date: '' }
    setDraft(empty)
    setError('')
    onApply(empty)
  }

  return (
    <form className="date-range" onSubmit={handleSubmit} noValidate aria-label={label}>
      <span className="date-range-label">{label}</span>
      <label className="sr-only" htmlFor="range-from">From</label>
      <input
        id="range-from"
        type="date"
        className="input"
        value={draft.from_date}
        max={draft.to_date || undefined}
        onChange={(e) => setDraft((d) => ({ ...d, from_date: e.target.value }))}
        aria-invalid={Boolean(error)}
      />
      <span className="date-range-sep" aria-hidden="true">to</span>
      <label className="sr-only" htmlFor="range-to">To</label>
      <input
        id="range-to"
        type="date"
        className="input"
        value={draft.to_date}
        min={draft.from_date || undefined}
        onChange={(e) => setDraft((d) => ({ ...d, to_date: e.target.value }))}
        aria-invalid={Boolean(error)}
      />
      <button type="submit" className="btn btn-secondary" disabled={disabled}>Apply</button>
      {isApplied && <button type="button" className="btn btn-ghost" onClick={handleClear} disabled={disabled}>Clear</button>}
      {error && <span className="field-error date-range-error" role="alert">{error}</span>}
    </form>
  )
}

export default DateRangeForm
