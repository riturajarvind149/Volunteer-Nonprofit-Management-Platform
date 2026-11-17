import { useState } from 'react'
import { updateOrganizationApi } from '../../services/api'
import { Alert } from '../../components/ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^https?:\/\/[^\s.]+\.[^\s]+$/i
const HANDLE_PATTERN = /^@?[A-Za-z0-9_.-]{1,100}$/

const SOCIALS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'youtube', label: 'YouTube' },
]

const initialValues = (org) => ({
  name: org.name || '',
  description: org.description || '',
  website: org.website || '',
  email: org.email || '',
  phone: org.phone || '',
  address: org.address || '',
  ...Object.fromEntries(SOCIALS.map(({ key }) => [key, org.social_links?.[key] || ''])),
})

const validate = (v) => {
  const errors = {}
  if (v.name.trim().length < 2) errors.name = 'Enter at least 2 characters.'
  if (v.description.length > 2000) errors.description = 'Keep it under 2000 characters.'
  if (v.website.trim() && !URL_PATTERN.test(v.website.trim())) errors.website = 'Enter a full address starting with https://'
  if (v.email.trim() && !EMAIL_PATTERN.test(v.email.trim())) errors.email = 'Enter a valid email address.'
  if (v.phone.trim().length > 30) errors.phone = 'Keep it under 30 characters.'
  if (v.address.length > 500) errors.address = 'Keep it under 500 characters.'
  for (const { key } of SOCIALS) {
    const value = v[key].trim()
    if (value && !HANDLE_PATTERN.test(value) && !URL_PATTERN.test(value)) errors[key] = 'Use @handle or a full https:// link.'
  }
  return errors
}

/** Edit an organization's public details (name, about, contact and social links). */
function OrgEditForm({ organization, token, onSaved, onCancel }) {
  const [values, setValues] = useState(() => initialValues(organization))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const id = organization.id

  const set = (field) => (e) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const blankToNull = (value) => value.trim() || null
    const payload = {
      name: values.name.trim(),
      description: blankToNull(values.description),
      website: blankToNull(values.website),
      email: blankToNull(values.email),
      phone: blankToNull(values.phone),
      address: blankToNull(values.address),
      social_links: Object.fromEntries(SOCIALS.map(({ key }) => [key, values[key].trim()]).filter(([, v]) => v)),
    }

    setSaving(true)
    setError('')
    try {
      const res = await updateOrganizationApi(id, payload, token)
      onSaved(res?.data?.organization || { ...organization, ...payload })
    } catch (err) {
      setError(err.message || 'Could not save the changes.')
      setSaving(false)
    }
  }

  const field = (name, label, { type = 'text', hint, optional = true, textarea, autoComplete } = {}) => {
    const fieldId = `${name}-${id}`
    const describedBy = errors[name] ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
    const props = {
      id: fieldId,
      className: textarea ? 'input textarea' : 'input',
      value: values[name],
      onChange: set(name),
      disabled: saving,
      'aria-invalid': Boolean(errors[name]),
      'aria-describedby': describedBy,
      autoComplete,
    }
    return (
      <div className="field">
        <label className="field-label" htmlFor={fieldId}>
          {label}
          {optional ? <span className="opt">(optional)</span> : <span className="req" aria-hidden="true">*</span>}
        </label>
        {textarea ? <textarea rows={4} {...props} /> : <input type={type} {...props} />}
        {errors[name] ? (
          <span id={`${fieldId}-error`} className="field-error">{errors[name]}</span>
        ) : (
          hint && <span id={`${fieldId}-hint`} className="field-hint">{hint}</span>
        )}
      </div>
    )
  }

  return (
    <form className="org-edit" onSubmit={handleSubmit} noValidate aria-label={`Edit ${organization.name}`}>
      {error && <Alert>{error}</Alert>}
      {field('name', 'Name', { optional: false })}
      {field('description', 'About', { textarea: true, hint: 'What you do and who volunteers will help. Shown on your public page.' })}

      <fieldset className="org-edit-group">
        <legend>Contact</legend>
        <div className="org-edit-grid">
          {field('website', 'Website', { type: 'url', hint: 'e.g. https://example.org', autoComplete: 'url' })}
          {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel' })}
          {field('address', 'Address', { autoComplete: 'street-address' })}
        </div>
      </fieldset>

      <fieldset className="org-edit-group">
        <legend>Social media</legend>
        <div className="org-edit-grid">
          {SOCIALS.map(({ key, label }) => (
            <div key={key}>{field(key, label, { hint: key === 'instagram' ? '@handle or full link' : undefined })}</div>
          ))}
        </div>
      </fieldset>

      <div className="org-edit-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default OrgEditForm
