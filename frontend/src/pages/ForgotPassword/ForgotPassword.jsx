import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { forgotPasswordApi } from '../../services/api'
import { Alert } from '../../components/ui'
import '../Auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFieldError('Enter a valid email address.')
      return
    }
    setFieldError('')
    setError('')
    setLoading(true)
    try {
      await forgotPasswordApi(trimmed)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Reset your password</h1>
          <p>Enter the email you registered with and we’ll send you a link to choose a new password.</p>
        </div>

        {sent ? (
          <>
            <Alert tone="success">
              If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. The link expires in
              60 minutes. Check your spam folder if you don’t see it.
            </Alert>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setSent(false)}>
              Send another link
            </button>
          </>
        ) : (
          <>
            {error && <Alert>{error}</Alert>}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldError) setFieldError('')
                  }}
                  disabled={loading}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? 'email-error' : undefined}
                  required
                />
                {fieldError && <span id="email-error" className="field-error">{fieldError}</span>}
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch">
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
