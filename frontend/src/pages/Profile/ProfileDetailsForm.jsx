import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfileApi } from '../../services/api'
import { Alert } from '../../components/ui'
import { parseSkills } from '../../utils/skills'

const toForm = (user) => ({
  full_name: user.full_name || '',
  phone: user.phone || '',
  location: user.location || '',
  bio: user.bio || '',
  skills: (user.skills || []).join(', '),
})

function validate(form) {
  const errors = {}
  if (form.full_name.trim().length < 2) errors.full_name = 'Enter your name (at least 2 characters).'
  if (form.phone.trim() && !/^[+()\-\s\d]{6,30}$/.test(form.phone.trim())) errors.phone = 'Use digits, spaces, +, - or brackets only.'
  if (form.bio.length > 2000) errors.bio = 'Keep your bio under 2000 characters.'
  const skills = parseSkills(form.skills)
  if (skills.some((s) => s.length > 50)) errors.skills = 'Keep each skill under 50 characters.'
  return errors
}

/** Editable personal details. Volunteers' skills help coordinators match them to opportunities. */
export function ProfileDetailsForm({ profile, onSaved }) {
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

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(profile))

  const submit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    setStatus(null)
    try {
      const res = await updateProfileApi({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        location: form.location.trim() || null,
        bio: form.bio.trim() || null,
        skills: parseSkills(form.skills),
      }, token)
      const updated = res?.data?.user
      if (updated) {
        updateUser({ full_name: updated.full_name })
        onSaved(updated)
        setForm(toForm(updated))
      }
      setStatus({ tone: 'success', text: 'Your profile was saved.' })
    } catch (err) {
      setStatus({ tone: 'error', text: err.message || 'Your profile could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  const field = (id, label, input, hint) => (
    <div className="field">
      <label className="field-label" htmlFor={`profile-${id}`}>{label}</label>
      {input}
      {errors[id] ? (
        <span id={`profile-${id}-error`} className="field-error">{errors[id]}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  )

  const inputProps = (id) => ({
    id: `profile-${id}`,
    value: form[id],
    onChange: set(id),
    disabled: saving,
    'aria-invalid': Boolean(errors[id]),
    'aria-describedby': errors[id] ? `profile-${id}-error` : undefined,
  })

  return (
    <form className="settings-form" onSubmit={submit} noValidate>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <div className="settings-grid">
        {field('full_name', 'Full name', <input className="input" maxLength={255} autoComplete="name" {...inputProps('full_name')} />)}
        {field('phone', 'Phone', <input className="input" type="tel" maxLength={30} autoComplete="tel" {...inputProps('phone')} />, 'Only shared with coordinators of events you register for.')}
        {field('location', 'City or area', <input className="input" maxLength={255} autoComplete="address-level2" {...inputProps('location')} />)}
        {profile.role !== 'ADMIN' && field(
          'skills',
          'Skills',
          <input className="input" maxLength={1000} {...inputProps('skills')} />,
          'Separate with commas, e.g. First aid, Teaching, Hindi.',
        )}
      </div>
      {field('bio', 'About you', <textarea className="textarea" rows={3} maxLength={2000} {...inputProps('bio')} />)}
      <div className="settings-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}

/** Toggle for non-essential emails (reminders, confirmations). Security emails are always sent. */
export function NotificationPreference({ profile, onSaved }) {
  const { token } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enabled = profile.email_notifications !== false

  const toggle = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await updateProfileApi({ email_notifications: !enabled }, token)
      if (res?.data?.user) onSaved(res.data.user)
    } catch (err) {
      setError(err.message || 'Your preference could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-title" id="email-pref-label">Email updates</p>
        <p className="muted settings-row-desc" id="email-pref-desc">
          Registration confirmations, reminders and hour reviews. Security emails (password changes) and
          cancellations of events you’re registered for are always sent.
        </p>
        {error && <Alert>{error}</Alert>}
      </div>
      <button
        type="button"
        role="switch"
        className={`switch${enabled ? ' is-on' : ''}`}
        aria-checked={enabled}
        aria-labelledby="email-pref-label"
        aria-describedby="email-pref-desc"
        onClick={toggle}
        disabled={busy}
      >
        <span className="switch-thumb" aria-hidden="true" />
      </button>
    </div>
  )
}
