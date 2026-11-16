import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { reviewVolunteerApi } from '../../services/api'
import { Alert } from '../../components/ui'
import { formatDate } from '../../utils/format'
import { REQUIRED_DETAILS, idTypeLabel } from '../../utils/volunteerDetails'

/** Which decisions make sense from each volunteer state. */
const ACTIONS = {
  UNVERIFIED: [
    { status: 'VERIFIED', label: 'Mark verified', tone: 'primary', needsDetails: true },
    { status: 'FLAGGED', label: 'Flag as suspicious', tone: 'danger', needsNote: true },
  ],
  VERIFIED: [
    { status: 'FLAGGED', label: 'Flag as suspicious', tone: 'danger', needsNote: true },
    { status: 'UNVERIFIED', label: 'Reset to not reviewed', tone: 'ghost' },
  ],
  FLAGGED: [
    { status: 'VERIFIED', label: 'Mark verified', tone: 'primary', needsDetails: true },
    { status: 'UNVERIFIED', label: 'Clear flag', tone: 'secondary' },
  ],
}

const ageFrom = (dob) => {
  if (!dob) return null
  const [y, m, d] = dob.split('-').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1
  return age
}

const notGiven = <span className="muted">Not provided</span>

/** Admin view of a volunteer's identity details with verify / flag decisions. */
function VolunteerReviewPanel({ volunteer, onDone }) {
  const { token } = useAuth()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const missing = volunteer.missing_details || []
  const status = volunteer.verification_status || 'UNVERIFIED'

  const decide = async (action) => {
    if (action.needsNote && !note.trim()) {
      setError('Add a note explaining why — it’s kept in the audit log.')
      return
    }
    setBusy(action.status)
    setError('')
    try {
      const res = await reviewVolunteerApi(volunteer.id, action.status, note.trim() || undefined, token)
      onDone(volunteer, res?.data?.user, action)
    } catch (err) {
      setError(err.message || 'The decision could not be saved.')
      setBusy(null)
    }
  }

  const age = ageFrom(volunteer.date_of_birth)

  return (
    <div className="admin-review">
      {missing.length > 0 && (
        <Alert tone="warning">
          Details not complete yet — missing {missing.map((k) => REQUIRED_DETAILS[k].toLowerCase()).join(', ')}.
          They’ll be asked for these before their first registration.
        </Alert>
      )}
      <dl className="admin-review-facts">
        <div><dt>Full name</dt><dd>{volunteer.full_name}</dd></div>
        <div><dt>Email</dt><dd><a href={`mailto:${volunteer.email}`}>{volunteer.email}</a>{!volunteer.email_verified_at && ' (not verified)'}</dd></div>
        <div><dt>Phone</dt><dd>{volunteer.phone ? <a href={`tel:${volunteer.phone.replace(/\s/g, '')}`}>{volunteer.phone}</a> : notGiven}</dd></div>
        <div><dt>City</dt><dd>{volunteer.location || notGiven}</dd></div>
        <div>
          <dt>Date of birth</dt>
          <dd>{volunteer.date_of_birth ? `${formatDate(volunteer.date_of_birth, { month: 'long' })} (age ${age})` : notGiven}</dd>
        </div>
        <div>
          <dt>Emergency contact</dt>
          <dd>
            {volunteer.emergency_contact_name
              ? `${volunteer.emergency_contact_name}${volunteer.emergency_contact_phone ? ` · ${volunteer.emergency_contact_phone}` : ''}`
              : notGiven}
          </dd>
        </div>
        <div>
          <dt>Government ID</dt>
          <dd>{volunteer.id_type ? `${idTypeLabel(volunteer.id_type)} ending ${volunteer.id_last4}` : notGiven}</dd>
        </div>
        <div><dt>Joined</dt><dd>{formatDate(volunteer.created_at, { month: 'long' })}</dd></div>
        {volunteer.details_updated_at && (
          <div><dt>Details last changed</dt><dd>{formatDate(volunteer.details_updated_at, { month: 'long' })}</dd></div>
        )}
        {volunteer.verified_at && status !== 'UNVERIFIED' && (
          <div><dt>Reviewed</dt><dd>{formatDate(volunteer.verified_at, { month: 'long' })}</dd></div>
        )}
      </dl>
      {volunteer.verification_note && (
        <p className="admin-review-prev"><strong>Previous note:</strong> {volunteer.verification_note}</p>
      )}

      <div className="field">
        <label className="field-label" htmlFor={`vnote-${volunteer.id}`}>
          Note <span className="opt">(required to flag; not shown to the volunteer)</span>
        </label>
        <textarea
          id={`vnote-${volunteer.id}`}
          className="textarea"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => { setNote(e.target.value); setError('') }}
          disabled={Boolean(busy)}
        />
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="admin-review-actions">
        {(ACTIONS[status] || []).map((action) => (
          <button
            key={action.status}
            type="button"
            className={`btn btn-sm btn-${action.tone}`}
            onClick={() => decide(action)}
            disabled={Boolean(busy) || (action.needsDetails && missing.length > 0)}
            title={action.needsDetails && missing.length > 0 ? 'The volunteer must complete their details first' : undefined}
          >
            {busy === action.status ? 'Saving…' : action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default VolunteerReviewPanel
