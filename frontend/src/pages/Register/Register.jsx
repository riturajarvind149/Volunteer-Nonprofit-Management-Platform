import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerApi } from '../../services/api'
import './Register.css'

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    role: 'VOLUNTEER',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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

  const isCoordinator = formData.role === 'COORDINATOR'

  const validate = () => {
    const newErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedEmail = formData.email.trim()

    if (!trimmedName) {
      newErrors.name = isCoordinator ? 'Coordinator name is required' : 'Full name is required'
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
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
      await registerApi({
        full_name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      })

      setSuccessMessage('Registration successful! Redirecting to login...')
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Registration successful! Please login with your credentials.' },
        })
      }, 1500)
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      id: 'name',
      label: isCoordinator ? 'Coordinator / Contact Name' : 'Full Name',
      type: 'text',
      placeholder: isCoordinator ? 'e.g. Sarah Jenkins' : 'e.g. John Doe',
    },
    {
      id: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'you@example.com',
    },
    {
      id: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'At least 8 characters',
    },
    {
      id: 'confirmPassword',
      label: 'Confirm Password',
      type: 'password',
      placeholder: 'Repeat your password',
    },
  ]

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
            className={`role-btn ${!isCoordinator ? 'active' : ''}`}
            onClick={() => handleRoleChange('VOLUNTEER')}
            disabled={loading}
          >
            Volunteer
          </button>
          <button
            type="button"
            className={`role-btn ${isCoordinator ? 'active' : ''}`}
            onClick={() => handleRoleChange('COORDINATOR')}
            disabled={loading}
          >
            NGO Coordinator
          </button>
        </div>

        {serverError && <div className="alert-error">{serverError}</div>}
        {successMessage && <div className="alert-success">{successMessage}</div>}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {fields.map(({ id, label, type, placeholder }) => (
            <div key={id} className="form-group">
              <label htmlFor={id}>{label}</label>
              <input
                type={type}
                id={id}
                name={id}
                placeholder={placeholder}
                value={formData[id]}
                onChange={handleChange}
                className={errors[id] ? 'input-error' : ''}
                disabled={loading}
                required
              />
              {errors[id] && <span className="error-text">{errors[id]}</span>}
            </div>
          ))}

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
