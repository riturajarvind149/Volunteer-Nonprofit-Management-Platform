import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Register.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    role: 'volunteer',
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRoleChange = (role) => {
    setFormData((prev) => ({ ...prev, role }))
    setErrors({})
    setServerError('')
    setSuccessMessage('')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    if (serverError) setServerError('')
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = formData.role === 'organization' ? 'Organization name is required' : 'Full name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters long'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    setSuccessMessage('')

    const validationErrors = validate()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setLoading(true)

    try {
      const backendRole = formData.role === 'organization' ? 'COORDINATOR' : 'VOLUNTEER'

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: backendRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed')
      }

      setSuccessMessage('Registration successful! Redirecting to login...')
      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <Link to="/" className="register-brand">
            ServeHub
          </Link>
          <h1>Create an Account</h1>
          <p>Join our community to discover or host meaningful volunteer opportunities.</p>
        </div>

        <div className="role-selector">
          <button
            type="button"
            className={`role-btn ${formData.role === 'volunteer' ? 'active' : ''}`}
            onClick={() => handleRoleChange('volunteer')}
            disabled={loading}
          >
            Volunteer
          </button>
          <button
            type="button"
            className={`role-btn ${formData.role === 'organization' ? 'active' : ''}`}
            onClick={() => handleRoleChange('organization')}
            disabled={loading}
          >
            Nonprofit Organization
          </button>
        </div>

        {serverError && <div className="alert-error">{serverError}</div>}
        {successMessage && <div className="alert-success">{successMessage}</div>}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name">
              {formData.role === 'organization' ? 'Organization Name' : 'Full Name'}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder={formData.role === 'organization' ? 'e.g. Green Earth Foundation' : 'e.g. Sarah Jenkins'}
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? 'input-error' : ''}
              disabled={loading}
              required
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'input-error' : ''}
              disabled={loading}
              required
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? 'input-error' : ''}
              disabled={loading}
              required
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Repeat your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? 'input-error' : ''}
              disabled={loading}
              required
            />
            {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" className="btn btn-primary register-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="register-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="login-link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
