import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { registerApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Alert } from '../../components/ui'
import '../Auth.css'

const ROLES = [
  { value: 'VOLUNTEER', title: 'Volunteer', desc: 'Find and register for opportunities' },
  { value: 'COORDINATOR', title: 'Coordinator', desc: 'Publish opportunities for a nonprofit' },
]

const FIELDS = [
  { id: 'name', label: 'Full name', type: 'text', autoComplete: 'name' },
  { id: 'email', label: 'Email address', type: 'email', autoComplete: 'email' },
  { id: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters.' },
  { id: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
]

function validate(form) {
  const errors = {}
  if (form.name.trim().length < 2) errors.name = 'Enter your full name (at least 2 characters).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (!form.confirmPassword) errors.confirmPassword = 'Re-enter your password.'
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords don’t match.'
  return errors
}

function Register() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    role: searchParams.get('role')?.toUpperCase() === 'COORDINATOR' ? 'COORDINATOR' : 'VOLUNTEER',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) return

    setServerError('')
    setLoading(true)
    try {
      await registerApi({
        full_name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      navigate('/login', { state: { message: 'Your account was created. Sign in to continue.' } })
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Create your account</h1>
          <p>Your role decides what you see after signing in. It can’t be changed later.</p>
        </div>

        {serverError && <Alert>{serverError}</Alert>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="role-options" disabled={loading}>
            <legend className="field-label">I’m joining as</legend>
            <div className="role-option-grid">
              {ROLES.map((role) => (
                <label key={role.value} className="role-option">
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={form.role === role.value}
                    onChange={handleChange}
                  />
                  <span className="role-option-title">{role.title}</span>
                  <span className="role-option-desc">{role.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {FIELDS.map((field) => {
            const describedBy = [errors[field.id] && `${field.id}-error`, field.hint && `${field.id}-hint`].filter(Boolean).join(' ')
            return (
              <div key={field.id} className="field">
                <label className="field-label" htmlFor={field.id}>{field.label}</label>
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  className="input"
                  value={form[field.id]}
                  onChange={handleChange}
                  autoComplete={field.autoComplete}
                  disabled={loading}
                  aria-invalid={Boolean(errors[field.id])}
                  aria-describedby={describedBy || undefined}
                  required
                />
                {field.hint && !errors[field.id] && <span id={`${field.id}-hint`} className="field-hint">{field.hint}</span>}
                {errors[field.id] && <span id={`${field.id}-error`} className="field-error">{errors[field.id]}</span>}
              </div>
            )
          })}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="field-hint">
            By creating an account you agree to the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
