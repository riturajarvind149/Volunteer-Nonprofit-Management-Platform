import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { changePasswordApi, logoutAllApi } from '../../services/api'
import { Alert } from '../../components/ui'
import PasswordInput from '../../components/PasswordInput'
import { passwordError, PASSWORD_HINT } from '../../utils/password'

function ChangePasswordForm() {
  const { token, replaceToken } = useAuth()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
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
    const nextErrors = {}
    if (!form.current) nextErrors.current = 'Enter your current password.'
    const pwError = passwordError(form.next)
    if (pwError) nextErrors.next = pwError
    else if (form.next === form.current) nextErrors.next = 'Choose a password different from your current one.'
    if (!form.confirm) nextErrors.confirm = 'Re-enter the new password.'
    else if (form.confirm !== form.next) nextErrors.confirm = 'Passwords don’t match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setStatus(null)
    try {
      const res = await changePasswordApi(form.current, form.next, token)
      // The server revoked every session, including this one, and issued a new token for us.
      if (res?.data?.token) replaceToken(res.data.token)
      setForm({ current: '', next: '', confirm: '' })
      setStatus({ tone: 'success', text: 'Password changed. You were signed out on your other devices.' })
    } catch (err) {
      if (/current password/i.test(err.message || '')) setErrors({ current: err.message })
      else setStatus({ tone: 'error', text: err.message || 'Your password could not be changed.' })
    } finally {
      setSaving(false)
    }
  }

  const pw = (id, label, autoComplete, hint) => (
    <div className="field">
      <label className="field-label" htmlFor={`pw-${id}`}>{label}</label>
      <PasswordInput
        id={`pw-${id}`}
        value={form[id]}
        onChange={set(id)}
        autoComplete={autoComplete}
        disabled={saving}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `pw-${id}-error` : hint ? `pw-${id}-hint` : undefined}
      />
      {errors[id] ? (
        <span id={`pw-${id}-error`} className="field-error">{errors[id]}</span>
      ) : hint ? (
        <span id={`pw-${id}-hint`} className="field-hint">{hint}</span>
      ) : null}
    </div>
  )

  return (
    <form className="settings-form" onSubmit={submit} noValidate aria-label="Change password">
      <p className="settings-row-title">Change password</p>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <div className="settings-grid">
        {pw('current', 'Current password', 'current-password')}
        <span aria-hidden="true" />
        {pw('next', 'New password', 'new-password', PASSWORD_HINT)}
        {pw('confirm', 'Confirm new password', 'new-password')}
      </div>
      <div className="settings-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}

function SignOutEverywhere() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await logoutAllApi(token)
      logout('You were signed out on every device, including this one.')
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Could not sign out of other devices.')
      setBusy(false)
    }
  }

  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-title">Sign out of all devices</p>
        <p className="muted settings-row-desc">Use this if you signed in on a shared computer or lost a phone. You’ll need to sign in again here too.</p>
        {error && <Alert>{error}</Alert>}
      </div>
      {confirming ? (
        <div className="settings-confirm" role="group" aria-label="Confirm signing out everywhere">
          <button type="button" className="btn btn-danger btn-sm" onClick={run} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out everywhere'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(true)}>Sign out everywhere</button>
      )}
    </div>
  )
}

function SecuritySettings() {
  return (
    <>
      <ChangePasswordForm />
      <SignOutEverywhere />
    </>
  )
}

export default SecuritySettings
