import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { forgotPasswordApi } from '../../services/api'
import { Alert } from '../../components/ui'
import '../Auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ForgotPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [notRegistered, setNotRegistered] = useState(false)
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
    setNotRegistered(false)
    setLoading(true)
    try {
      const res = await forgotPasswordApi(trimmed)
      navigate('/reset-password', { state: { email: trimmed, message: res?.message } })
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setNotRegistered(err.code === 'EMAIL_NOT_REGISTERED')
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Reset your password</h1>
          <p>Enter the email you registered with and we’ll send you a 6-digit code to choose a new password.</p>
        </div>

        {error && (
          <Alert>
            {error} {notRegistered && <Link to="/register">Create an account</Link>}
          </Alert>
        )}
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
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>

        <p className="auth-switch">
          Already have a code?{' '}
          <Link to="/reset-password" state={{ email: email.trim() }}>Enter it</Link>
          {' · '}
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
