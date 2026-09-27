import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { loginApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import '../Auth.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState(location.state?.message || '')

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (error) setError('')
    if (infoMessage) setInfoMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')

    const email = formData.email.trim()
    const { password } = formData

    if (!email || !password) {
      setError('Please provide both email and password.')
      return
    }

    setLoading(true)
    try {
      const response = await loginApi({ email, password })
      const { token, user } = response.data
      login(token, user)
      navigate('/profile')
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="auth-brand">
            ServeHub
          </Link>
          <h1>Welcome Back</h1>
          <p>Sign in to continue connecting with community causes.</p>
        </div>

        {infoMessage && <div className="alert-success">{infoMessage}</div>}
        {error && <div className="alert-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="password">Password</label>
              <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              disabled={loading}
            />
            <span>Remember me</span>
          </label>

          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
