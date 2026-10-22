import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { loginApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const infoMessage = location.state?.message || ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Please provide both email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const response = await loginApi({ email: trimmedEmail, password })
      login(response.data.token, response.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-left-panel">
        <div className="login-left-content">
          <Link to="/" className="login-brand">
            <div className="login-brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <span>ServeHub</span>
          </Link>

          <h2 className="login-left-headline">Welcome back to your community.</h2>
          <p className="login-left-subtext">
            Every hour you give creates real change. Sign in to continue your volunteering journey.
          </p>


        </div>
      </div>

      <div className="login-right-panel">
        <div className="login-form-card">
          <h1>Sign In</h1>
          <p className="login-form-subtext">
            Don't have an account? <Link to="/register">Create one free</Link>
          </p>

          {infoMessage && <div className="alert-success">{infoMessage}</div>}
          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-form-group">
              <label htmlFor="email">Email address</label>
              <input
                type="email"
                id="email"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError('') }}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-form-group">
              <div className="login-label-row">
                <label htmlFor="password">Password</label>
                <button type="button" className="login-forgot-btn">Forgot password?</button>
              </div>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-show-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
