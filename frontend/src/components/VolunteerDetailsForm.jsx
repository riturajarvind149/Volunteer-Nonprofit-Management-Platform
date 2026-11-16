import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfileApi } from '../services/api'
import { Alert } from './ui'
import { ID_TYPES, PHONE_PATTERN } from '../utils/volunteerDetails'
import './VolunteerDetailsForm.css'

const FIELDS = [
  'full_name',
  'phone',
  'location',
  'date_of_birth',
  'emergency_contact_name',
  'emergency_contact_phone',
  'id_type',
  'id_last4',
]

const toForm = (user) => Object.fromEntries(FIELDS.map((key) => [key, user?.[key] || '']))

const ageOn = (dob, today = new Date()) => {
  const [y, m, d] = dob.split('-').map(Number)
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1
  return age
}

function validate(form) {
  const errors = {}
  const t = (k) => form[k].trim()
  if (t('full_name').length < 2) errors.full_name = 'Enter your full name as on your ID.'
  if (!t('phone')) errors.phone = 'Enter your phone number.'
  else if (!PHONE_PATTERN.test(t('phone'))) errors.phone = 'Use digits, spaces, +, - or brackets only.'
  if (!t('location')) errors.location = 'Enter your city.'
  if (!form.date_of_birth) errors.date_of_birth = 'Enter your date of birth.'
  else {
    const age = ageOn(form.date_of_birth)
    if (Number.isNaN(age) || age < 13 || age > 120) errors.date_of_birth = 'Volunteers must be at least 13 years old.'
  }
  if (t('emergency_contact_name').length < 2) errors.emergency_contact_name = 'Enter someone we can call in an emergency.'
  if (!t('emergency_contact_phone')) errors.emergency_contact_phone = 'Enter their phone number.'
  else if (!PHONE_PATTERN.test(t('emergency_contact_phone'))) errors.emergency_contact_phone = 'Use digits, spaces, +, - or brackets only.'
  if (t('id_last4') && !/^[A-Za-z0-9]{4}$/.test(t('id_last4'))) errors.id_last4 = 'Enter exactly the last 4 letters or digits.'
  if (form.id_type && !t('id_last4')) errors.id_last4 = 'Add the last 4 characters, or clear the ID type.'
  if (!form.id_type && t('id_last4')) errors.id_type = 'Choose which ID these digits are from.'
  return errors
}

/**
 * The identity details a volunteer gives once before registering. Used on the
 * profile page and in the "complete your details" dialog on registration.
 */
function VolunteerDetailsForm({ profile, onSaved, onCancel, submitLabel = 'Save details', idPrefix = 'details' }) {
  const { token, updateUser } = useAuth()
  const [form, setForm] = useState(() => toForm(profile))
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
    setStatus(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const first = Object.keys(nextErrors)[0]
      document.getElementById(`${idPrefix}-${first}`)?.focus()
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const payload = Object.fromEntries(FIELDS.map((key) => [key, form[key].trim() || null]))
      const res = await updateProfileApi(payload, token)
      const updated = res?.data?.user
      if (updated) {
        updateUser(Object.fromEntries([...FIELDS, 'verification_status'].map((key) => [key, updated[key]])))
        setForm(toForm(updated))
        onSaved?.(updated)
      }
      setStatus({ tone: 'success', text: 'Your details were saved.' })
    } catch (err) {
      setStatus({ tone: 'error', text: err.message || 'Your details could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  const field = (id, label, input, { hint, optional } = {}) => (
    <div className="field">
      <label className="field-label" htmlFor={`${idPrefix}-${id}`}>
        {label}
        {optional ? <span className="opt">(optional)</span> : <span className="req" aria-hidden="true">*</span>}
      </label>
      {input}
      {errors[id] ? (
        <span id={`${idPrefix}-${id}-error`} className="field-error">{errors[id]}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  )

  const inputProps = (id, required = true) => ({
    id: `${idPrefix}-${id}`,
    value: form[id],
    onChange: set(id),
    disabled: saving,
    required,
    'aria-invalid': Boolean(errors[id]),
    'aria-describedby': errors[id] ? `${idPrefix}-${id}-error` : undefined,
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form className="details-form" onSubmit={submit} noValidate>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}

      <div className="details-grid">
        {field('full_name', 'Full name', <input className="input" maxLength={255} autoComplete="name" {...inputProps('full_name')} />, { hint: 'As it appears on your ID.' })}
        {field('phone', 'Phone', <input className="input" type="tel" maxLength={30} autoComplete="tel" {...inputProps('phone')} />, { hint: 'Shared only with coordinators of events you join.' })}
        {field('location', 'City', <input className="input" maxLength={255} autoComplete="address-level2" {...inputProps('location')} />)}
        {field('date_of_birth', 'Date of birth', <input className="input" type="date" max={today} autoComplete="bday" {...inputProps('date_of_birth')} />)}
      </div>

      <fieldset className="details-group">
        <legend className="details-legend">Emergency contact</legend>
        <div className="details-grid">
          {field('emergency_contact_name', 'Name', <input className="input" maxLength={255} {...inputProps('emergency_contact_name')} />)}
          {field('emergency_contact_phone', 'Phone', <input className="input" type="tel" maxLength={30} {...inputProps('emergency_contact_phone')} />)}
        </div>
      </fieldset>

      <fieldset className="details-group">
        <legend className="details-legend">Government ID <span className="opt">(optional)</span></legend>
        <div className="details-grid">
          {field(
            'id_type',
            'ID type',
            <select className="select" {...inputProps('id_type', false)}>
              <option value="">None</option>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>,
            { optional: true },
          )}
          {field(
            'id_last4',
            'Last 4 characters',
            <input className="input" maxLength={4} autoComplete="off" inputMode="text" {...inputProps('id_last4', false)} />,
            { optional: true, hint: 'Never enter your full ID number — we only keep the last 4.' },
          )}
        </div>
      </fieldset>

      <p className="field-hint details-privacy">
        Only the ServeHub admin team sees your date of birth, emergency contact and ID. They use it to confirm
        volunteers are real people.
      </p>

      <div className="details-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        )}
      </div>
    </form>
  )
}

export default VolunteerDetailsForm
