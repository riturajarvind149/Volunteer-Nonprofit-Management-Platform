import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPasswordApi } from '../../services/api'
import { Alert } from '../../components/ui'
import PasswordInput from '../../components/PasswordInput'
import { passwordError, PASSWORD_HINT } from '../../utils/password'
import '../Auth.css'

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token || expired) {
    return (
      <div className="auth">
        <div className="auth-panel">
          <div className="auth-heading">
            <h1>Link invalid or expired</h1>
            <p>Password reset links work once and expire after 60 minutes.</p>
          </div>
          {error && <Alert>{error}</Alert>}
          <Link to="/forgot-password" className="btn btn-primary btn-lg btn-block">
            Request a new link
          </Link>
          <p className="auth-switch">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = {}
    const pwError = passwordError(password)
    if (pwError) nextErrors.password = pwError
    if (!confirm) nextErrors.confirm = 'Re-enter your new password.'
    else if (confirm !== password) nextErrors.confirm = 'Passwords don’t match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setError('')
    setLoading(true)
    try {
      await resetPasswordApi(token, password)
      navigate('/login', { replace: true, state: { message: 'Your password was reset. Sign in with your new password.' } })
    } catch (err) {
      setLoading(false)
      if (err.code === 'INVALID_TOKEN') {
        setError(err.message)
        setExpired(true)
      } else {
        setError(err.message || 'Could not reset your password. Please try again.')
      }
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Choose a new password</h1>
          <p>You’ll be signed out on every other device once it’s changed.</p>
        </div>

        {error && <Alert>{error}</Alert>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="password">New password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
              }}
              disabled={loading}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : 'password-hint'}
              required
            />
            {errors.password ? (
              <span id="password-error" className="field-error">{errors.password}</span>
            ) : (
              <span id="password-hint" className="field-hint">{PASSWORD_HINT}</span>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="confirm">Confirm new password</label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: '' }))
              }}
              disabled={loading}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirm)}
              aria-describedby={errors.confirm ? 'confirm-error' : undefined}
              required
            />
            {errors.confirm && <span id="confirm-error" className="field-error">{errors.confirm}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
