import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { exportMyDataApi, deleteAccountApi } from '../../services/api'
import Icon from '../../components/Icon'
import { Alert } from '../../components/ui'
import PasswordInput from '../../components/PasswordInput'

function DownloadData() {
  const { token } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      await exportMyDataApi(token)
    } catch (err) {
      setError(err.message || 'Your data could not be exported.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-title">Download your data</p>
        <p className="muted settings-row-desc">
          A JSON file with your profile, registrations, hours, waitlist entries and notifications.
        </p>
        {error && <Alert>{error}</Alert>}
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={download} disabled={busy}>
        <Icon name="download" size={14} /> {busy ? 'Preparing…' : 'Download'}
      </button>
    </div>
  )
}

const CONFIRM_WORD = 'DELETE'

function DeleteAccount() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setOpen(false)
    setPassword('')
    setConfirmText('')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!password) {
      setError('Enter your password to confirm.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await deleteAccountApi(password, token)
      logout('Your account and personal data were permanently deleted.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Your account could not be deleted.')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="settings-row">
        <div>
          <p className="settings-row-title">Delete account</p>
          <p className="muted settings-row-desc">
            Permanently removes your account, registrations, hours and notifications. This can’t be undone.
          </p>
        </div>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>Delete account…</button>
      </div>
    )
  }

  return (
    <form className="settings-form settings-danger" onSubmit={submit} noValidate aria-label="Delete account">
      <p className="settings-row-title">Delete your account permanently?</p>
      <p className="muted settings-row-desc">
        Your registrations and hours will be removed and can’t be recovered. Consider downloading your data first.
        Coordinators must hand over or close their organizations before deleting.
      </p>
      {error && <Alert>{error}</Alert>}
      <div className="settings-grid">
        <div className="field">
          <label className="field-label" htmlFor="delete-password">Your password</label>
          <PasswordInput
            id="delete-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            autoComplete="current-password"
            disabled={busy}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</label>
          <input
            id="delete-confirm"
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        </div>
      </div>
      <div className="settings-actions">
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>Keep my account</button>
        <button type="submit" className="btn btn-danger" disabled={busy || confirmText !== CONFIRM_WORD}>
          {busy ? 'Deleting…' : 'Permanently delete account'}
        </button>
      </div>
    </form>
  )
}

function PrivacySettings() {
  return (
    <>
      <DownloadData />
      <DeleteAccount />
    </>
  )
}

export default PrivacySettings
