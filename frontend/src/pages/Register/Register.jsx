import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerApi } from '../../services/api'
import '../Auth.css'

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ role: 'VOLUNTEER', name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRoleChange = (role) => { setFormData((prev) => ({ ...prev, role })); setErrors({}); setServerError('') }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const errs = {}
    if (!formData.name.trim() || formData.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errs.email = 'Please enter a valid email address'
    if (!formData.password || formData.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setLoading(true)
    try {
      await registerApi({ full_name: formData.name.trim(), email: formData.email.trim(), password: formData.password, role: formData.role })
      setSuccessMessage('Registration successful! Redirecting to login...')
      setTimeout(() => navigate('/login', { state: { message: 'Registration successful! Please login with your credentials.' } }), 1500)
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isCoordinator = formData.role === 'COORDINATOR'

  const fields = [
    { id: 'name', label: isCoordinator ? 'Coordinator / Contact Name' : 'Full Name', type: 'text', placeholder: 'e.g. John Doe' },
    { id: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com' },
    { id: 'password', label: 'Password', type: showPassword ? 'text' : 'password', placeholder: 'At least 8 characters', toggle: true },
    { id: 'confirmPassword', label: 'Confirm Password', type: showPassword ? 'text' : 'password', placeholder: 'Repeat your password' },
  ]

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="auth-brand">ServeHub</Link>
          <h1>Create an Account</h1>
          <p>Join our community to discover or host meaningful volunteer opportunities.</p>
        </div>

        <div className="role-selector">
          <button type="button" className={`role-btn ${!isCoordinator ? 'active' : ''}`} onClick={() => handleRoleChange('VOLUNTEER')} disabled={loading}>Volunteer</button>
          <button type="button" className={`role-btn ${isCoordinator ? 'active' : ''}`} onClick={() => handleRoleChange('COORDINATOR')} disabled={loading}>NGO Coordinator</button>
        </div>

        {serverError && <div className="alert-error">{serverError}</div>}
        {successMessage && <div className="alert-success">{successMessage}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {fields.map(({ id, label, type, placeholder, toggle }) => (
            <div key={id} className="form-group">
              <label htmlFor={id}>{label}</label>
              <div className={toggle ? 'password-input-wrapper' : ''}>
                <input
                  type={type} id={id} name={id}
                  placeholder={placeholder}
                  value={formData[id]} onChange={handleChange}
                  className={errors[id] ? 'input-error' : ''}
                  disabled={loading} required
                />
                {toggle && (
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((p) => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                )}
              </div>
              {errors[id] && <span className="error-text">{errors[id]}</span>}
            </div>
          ))}

          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  )
}

export default Register
