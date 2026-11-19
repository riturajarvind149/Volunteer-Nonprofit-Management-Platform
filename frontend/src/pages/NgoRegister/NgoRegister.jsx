import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { registerOrganizationApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Alert } from '../../components/ui'
import PasswordInput from '../../components/PasswordInput'
import NgoFields from '../../components/NgoFields'
import SignupChooser from '../../components/SignupChooser'
import { EMPTY_NGO, ngoPayload, validateNgo } from '../../utils/ngo'
import { passwordError, PASSWORD_HINT } from '../../utils/password'
import '../Auth.css'
import './NgoRegister.css'

const EMPTY_PERSON = { full_name: '', email: '', phone: '', password: '', confirm: '' }

function validatePerson(values) {
  const errors = {}
  if (values.full_name.trim().length < 2) errors.full_name = 'Enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (!/^\+?[0-9][0-9 ()-]{6,19}$/.test(values.phone.trim())) errors.phone = 'Enter a phone number the ServeHub team can reach you on.'
  const pw = passwordError(values.password)
  if (pw) errors.password = pw
  if (!values.confirm) errors.confirm = 'Re-enter your password.'
  else if (values.confirm !== values.password) errors.confirm = 'Passwords don’t match.'
  return errors
}

/** Public NGO sign-up: the NGO and its NGO admin's account are created together. */
function NgoRegister() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [ngo, setNgo] = useState(EMPTY_NGO)
  const [person, setPerson] = useState(EMPTY_PERSON)
  const [ngoErrors, setNgoErrors] = useState({})
  const [personErrors, setPersonErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  // A signed-in coordinator registers from inside the app; everyone else signed in goes home.
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'COORDINATOR' ? '/organizations/register' : '/dashboard'} replace />
  }

  const changeNgo = (field, value) => {
    setNgo((prev) => ({ ...prev, [field]: value }))
    if (ngoErrors[field]) setNgoErrors((prev) => ({ ...prev, [field]: '' }))
  }
  const changePerson = (field) => (e) => {
    setPerson((prev) => ({ ...prev, [field]: e.target.value }))
    if (personErrors[field]) setPersonErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextNgoErrors = validateNgo(ngo)
    const nextPersonErrors = validatePerson(person)
    setNgoErrors(nextNgoErrors)
    setPersonErrors(nextPersonErrors)
    if (Object.keys(nextNgoErrors).length || Object.keys(nextPersonErrors).length) return

    setServerError('')
    setLoading(true)
    const email = person.email.trim()
    try {
      const res = await registerOrganizationApi({
        full_name: person.full_name.trim(),
        email,
        phone: person.phone.trim(),
        password: person.password,
        organization: ngoPayload(ngo),
      })
      if (res?.data?.requires_email_verification) {
        navigate('/verify-email', { state: { email } })
      } else {
        navigate('/login', { state: { message: 'Your NGO is registered. Sign in to continue.' } })
      }
    } catch (err) {
      setLoading(false)
      if (err.code === 'ORG_NAME_TAKEN') setNgoErrors((prev) => ({ ...prev, name: err.message }))
      else setServerError(err.message || 'Registration failed. Please try again.')
    }
  }

  const personField = (id, label, { type = 'text', autoComplete, hint } = {}) => (
    <div className="field">
      <label className="field-label" htmlFor={`rep-${id}`}>{label}</label>
      <input
        id={`rep-${id}`}
        type={type}
        className="input"
        value={person[id]}
        onChange={changePerson(id)}
        disabled={loading}
        autoComplete={autoComplete}
        aria-invalid={Boolean(personErrors[id])}
        aria-describedby={personErrors[id] ? `rep-${id}-error` : hint ? `rep-${id}-hint` : undefined}
        required
      />
      {personErrors[id] ? (
        <span id={`rep-${id}-error`} className="field-error">{personErrors[id]}</span>
      ) : (
        hint && <span id={`rep-${id}-hint`} className="field-hint">{hint}</span>
      )}
    </div>
  )

  return (
    <div className="auth">
      <div className="auth-panel ngo-register">
        <SignupChooser active="ngo" />

        <div className="auth-heading">
          <h1>Register your NGO</h1>
          <p>
            Your NGO gets its own space on ServeHub. You become its NGO admin and can invite coordinators to run events
            with you. The ServeHub team verifies every NGO before it can publish opportunities.
          </p>
        </div>

        {serverError && (
          <Alert>
            {serverError}{' '}
            {/already registered/i.test(serverError) && <Link to="/login">Sign in instead</Link>}
          </Alert>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="ngo-register-section" disabled={loading}>
            <legend>About your NGO</legend>
            <NgoFields values={ngo} errors={ngoErrors} onChange={changeNgo} disabled={loading} />
          </fieldset>

          <fieldset className="ngo-register-section" disabled={loading}>
            <legend>Your details</legend>
            <p className="field-hint">You’ll be the NGO admin. Use an email you check — we’ll send a code to confirm it.</p>
            {personField('full_name', 'Your full name', { autoComplete: 'name' })}
            {personField('email', 'Email address', { type: 'email', autoComplete: 'email' })}
            {personField('phone', 'Phone number', { type: 'tel', autoComplete: 'tel', hint: 'Only the ServeHub team sees this.' })}
            <div className="field">
              <label className="field-label" htmlFor="rep-password">Password</label>
              <PasswordInput
                id="rep-password"
                value={person.password}
                onChange={changePerson('password')}
                disabled={loading}
                autoComplete="new-password"
                aria-invalid={Boolean(personErrors.password)}
                aria-describedby={personErrors.password ? 'rep-password-error' : 'rep-password-hint'}
                required
              />
              {personErrors.password ? (
                <span id="rep-password-error" className="field-error">{personErrors.password}</span>
              ) : (
                <span id="rep-password-hint" className="field-hint">{PASSWORD_HINT}</span>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="rep-confirm">Confirm password</label>
              <PasswordInput
                id="rep-confirm"
                value={person.confirm}
                onChange={changePerson('confirm')}
                disabled={loading}
                autoComplete="new-password"
                aria-invalid={Boolean(personErrors.confirm)}
                aria-describedby={personErrors.confirm ? 'rep-confirm-error' : undefined}
                required
              />
              {personErrors.confirm && <span id="rep-confirm-error" className="field-error">{personErrors.confirm}</span>}
            </div>
          </fieldset>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? 'Registering…' : 'Register NGO'}
          </button>
          <p className="field-hint">
            By registering you agree to the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default NgoRegister
