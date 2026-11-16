import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPasswordApi, resetPasswordWithCodeApi, forgotPasswordApi } from '../../services/api'
import { Alert } from '../../components/ui'
import PasswordInput from '../../components/PasswordInput'
import CodeField from '../../components/CodeField'
import { isCompleteCode } from '../../utils/code'
import { passwordError, PASSWORD_HINT } from '../../utils/password'
import '../Auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Two ways in:
 *  - /reset-password?token=…  → link from the email: only the new password is needed
 *  - /reset-password           → enter email + 6-digit code from the email + new password
 */
function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const useCode = !token

  const [email, setEmail] = useState(location.state?.email || '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.message || '')
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  if (expired) {
    return (
      <div className="auth">
        <div className="auth-panel">
          <div className="auth-heading">
            <h1>Link invalid or expired</h1>
            <p>Password reset links and codes work once and expire after 60 minutes.</p>
          </div>
          {error && <Alert>{error}</Alert>}
          <Link to="/forgot-password" className="btn btn-primary btn-lg btn-block">
            Request a new code
          </Link>
          <p className="auth-switch">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  const clearError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = {}
    if (useCode) {
      if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address.'
      if (!isCompleteCode(code)) nextErrors.code = 'Enter all 6 digits.'
    }
    const pwError = passwordError(password)
    if (pwError) nextErrors.password = pwError
    if (!confirm) nextErrors.confirm = 'Re-enter your new password.'
    else if (confirm !== password) nextErrors.confirm = 'Passwords don’t match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setError('')
    setNotice('')
    setLoading(true)
    try {
      if (useCode) await resetPasswordWithCodeApi(email.trim(), code, password)
      else await resetPasswordApi(token, password)
      navigate('/login', { replace: true, state: { message: 'Your password was reset. Sign in with your new password.' } })
    } catch (err) {
      setLoading(false)
      if (err.code === 'INVALID_TOKEN') {
        setError(err.message)
        setExpired(true)
      } else if (err.code === 'INVALID_CODE') {
        setErrors({ code: err.message })
      } else {
        setError(err.message || 'Could not reset your password. Please try again.')
      }
    }
  }

  const resendCode = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }))
      return
    }
    setResending(true)
    setError('')
    try {
      const res = await forgotPasswordApi(email.trim())
      setNotice(res?.message || 'A new code is on its way.')
      setCode('')
      clearError('code')
    } catch (err) {
      setError(err.message || 'Could not send a new code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Choose a new password</h1>
          <p>
            {useCode
              ? 'Enter the 6-digit code from the password reset email and your new password.'
              : 'You’ll be signed out on every other device once it’s changed.'}
          </p>
        </div>

        {notice && !error && <Alert tone="success">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {useCode && (
            <>
              <div className="field">
                <label className="field-label" htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearError('email')
                  }}
                  disabled={loading}
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'reset-email-error' : undefined}
                  required
                />
                {errors.email && <span id="reset-email-error" className="field-error">{errors.email}</span>}
              </div>
              <CodeField
                label="Reset code"
                value={code}
                onChange={(value) => {
                  setCode(value)
                  clearError('code')
                }}
                error={errors.code}
                disabled={loading}
              />
            </>
          )}

          <div className="field">
            <label className="field-label" htmlFor="password">New password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearError('password')
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
                clearError('confirm')
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

        {useCode && (
          <button type="button" className="btn btn-secondary btn-block" onClick={resendCode} disabled={resending || loading}>
            {resending ? 'Sending…' : 'Send a new code'}
          </button>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default ResetPassword
