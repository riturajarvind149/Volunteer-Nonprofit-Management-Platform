import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { checkInApi, logOwnHoursApi } from '../../services/api'
import { StatusBadge } from '../../components/ui'
import { formatHours } from '../../utils/format'

/**
 * Check in on the day of the event with the code the coordinator shares at the venue.
 * The server only accepts it from 1 hour before the start until 3 hours after the end.
 */
export function CheckInForm({ signup, onCheckedIn }) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (signup.attendance_status === 'PRESENT') {
    return <StatusBadge status="PRESENT" />
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        Check in
      </button>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Enter the check-in code shown at the venue.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await checkInApi(signup.opportunity_id, code.trim(), token)
      onCheckedIn(signup.id, res?.data?.signup)
    } catch (err) {
      setError(err.message || 'Check-in failed. Please try again.')
      setBusy(false)
    }
  }

  const inputId = `checkin-${signup.id}`
  return (
    <form className="reg-inline-form" onSubmit={submit} noValidate>
      <label className="field-label" htmlFor={inputId}>Check-in code</label>
      <div className="reg-inline-row">
        <input
          id={inputId}
          className="input reg-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Checking in…' : 'Confirm'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
      {error && <span id={`${inputId}-error`} className="field-error">{error}</span>}
    </form>
  )
}

/** Shows logged hours with their review status, or a form to log them for a past shift. */
export function LogHoursForm({ signup, onLogged }) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (signup.hours_status && signup.hours_status !== 'REJECTED') {
    return (
      <span className="reg-hours">
        {formatHours(signup.hours_logged)} h <StatusBadge status={signup.hours_status} />
      </span>
    )
  }

  if (!open) {
    return (
      <div className="reg-hours-cta">
        {signup.hours_status === 'REJECTED' && <StatusBadge status="REJECTED" label="Hours not approved" />}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          {signup.hours_status === 'REJECTED' ? 'Log hours again' : 'Log hours'}
        </button>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    const value = Number(hours)
    if (!hours || !Number.isFinite(value) || value <= 0 || value > 24) {
      setError('Enter the hours you volunteered (more than 0, at most 24).')
      return
    }
    if (Math.round(value * 100) !== value * 100) {
      setError('Use at most two decimal places, e.g. 2.5.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await logOwnHoursApi(signup.id, { hours: value, notes: notes.trim() || undefined }, token)
      onLogged(signup.id, res?.data?.volunteer_hours)
    } catch (err) {
      setError(err.message || 'Your hours could not be saved.')
      setBusy(false)
    }
  }

  const id = `hours-${signup.id}`
  return (
    <form className="reg-inline-form" onSubmit={submit} noValidate>
      <div className="reg-inline-row">
        <div className="field reg-hours-field">
          <label className="field-label" htmlFor={id}>Hours</label>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min="0.25"
            max="24"
            step="0.25"
            className="input"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            autoFocus
          />
        </div>
        <div className="field reg-notes-field">
          <label className="field-label" htmlFor={`${id}-notes`}>Note for the coordinator <span className="opt">(optional)</span></label>
          <input
            id={`${id}-notes`}
            className="input"
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>
      {error && <span id={`${id}-error`} className="field-error">{error}</span>}
      <div className="reg-inline-row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
