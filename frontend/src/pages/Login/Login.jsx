import { useState } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { loginApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import { Alert } from '../../components/ui'
import '../Auth.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, sessionNotice } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')

  const redirectTo = location.state?.from || '/dashboard'
  const infoMessage = location.state?.message || ''

  if (isAuthenticated && !loading) return <Navigate to={redirectTo} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const errors = {}
    if (!trimmedEmail) errors.email = 'Enter your email address.'
    if (!password) errors.password = 'Enter your password.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setError('')
    setErrorCode('')
    setLoading(true)
    try {
      const response = await loginApi({ email: trimmedEmail, password })
      login(response.data.token, response.data.user)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your email and password.')
      setErrorCode(err.code || '')
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Sign in</h1>
          <p>Use the email address you registered with.</p>
        </div>

        {infoMessage && !error && <Alert tone="success">{infoMessage}</Alert>}
        {sessionNotice && !infoMessage && !error && <Alert tone="info">{sessionNotice}</Alert>}
        {location.state?.from && !infoMessage && !sessionNotice && !error && (
          <Alert tone="info">Sign in to continue to that page.</Alert>
        )}
        {error && (
          <Alert>
            {error}{' '}
            {errorCode === 'EMAIL_NOT_REGISTERED' && <Link to="/register">Create an account</Link>}
          </Alert>
        )}
        {errorCode === 'EMAIL_NOT_VERIFIED' && (
          <Link to="/verify-email" state={{ email: email.trim() }} className="btn btn-secondary btn-block">
            Enter verification code
          </Link>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              required
            />
            {fieldErrors.email && <span id="email-error" className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="field">
            <div className="field-label-row">
              <label className="field-label" htmlFor="password">Password</label>
              <Link to="/forgot-password" state={{ email: email.trim() }} className="field-link">
                Forgot password?
              </Link>
            </div>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
              </button>
            </div>
            {fieldErrors.password && <span id="password-error" className="field-error">{fieldErrors.password}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          New to ServeHub? <Link to="/register">Create a volunteer account</Link> or{' '}
          <Link to="/register/ngo">register your NGO</Link>.
          <br />
          Coordinators join through an invitation from their NGO admin.
        </p>
      </div>
    </div>
  )
}

export default Login
