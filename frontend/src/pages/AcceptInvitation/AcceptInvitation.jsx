import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { previewInvitationApi, acceptInvitationApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Alert, LoadingState } from '../../components/ui'
import PasswordInput from '../../components/PasswordInput'
import { passwordError, PASSWORD_HINT } from '../../utils/password'
import '../Auth.css'

/** Join an NGO as a coordinator from the link in an invitation email. */
function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('token') || ''
  const location = useLocation()
  const navigate = useNavigate()
  const { token, user, isAuthenticated, loading: authLoading, login, logout } = useAuth()

  const [invitation, setInvitation] = useState(null)
  const [state, setState] = useState(inviteToken ? 'loading' : 'invalid') // loading | ready | invalid
  const [error, setError] = useState(inviteToken ? '' : 'This invitation link is incomplete. Open the link from your email again.')
  const [form, setForm] = useState({ full_name: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const requested = useRef(false)

  useEffect(() => {
    if (!inviteToken || requested.current) return
    requested.current = true
    previewInvitationApi(inviteToken)
      .then((res) => {
        setInvitation(res?.data?.invitation || null)
        setState('ready')
      })
      .catch((err) => {
        setError(err.message || 'This invitation link is invalid or has expired.')
        setState('invalid')
      })
  }, [inviteToken])

  const joined = (organizationName) =>
    navigate('/organization-profile', { replace: true, state: { message: `Welcome! You’re now a coordinator for ${organizationName}.` } })

  const acceptSignedIn = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await acceptInvitationApi(inviteToken, {}, token)
      joined(res?.data?.organization_name || invitation.organization_name)
    } catch (err) {
      setError(err.message || 'The invitation could not be accepted.')
      setSubmitting(false)
    }
  }

  const acceptNew = async (e) => {
    e.preventDefault()
    const next = {}
    if (form.full_name.trim().length < 2) next.full_name = 'Enter your full name.'
    const pw = passwordError(form.password)
    if (pw) next.password = pw
    if (!form.confirm) next.confirm = 'Re-enter your password.'
    else if (form.confirm !== form.password) next.confirm = 'Passwords don’t match.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    setError('')
    try {
      const res = await acceptInvitationApi(inviteToken, { full_name: form.full_name.trim(), password: form.password })
      login(res.data.token, res.data.user)
      joined(res.data.organization_name)
    } catch (err) {
      setError(err.message || 'The invitation could not be accepted.')
      setSubmitting(false)
    }
  }

  const change = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  if (state === 'loading' || authLoading) return <LoadingState label="Opening your invitation…" />

  if (state === 'invalid') {
    return (
      <div className="auth">
        <div className="auth-panel">
          <div className="auth-heading">
            <h1>Invitation not available</h1>
          </div>
          <Alert>{error}</Alert>
          <p className="auth-switch">
            <Link to="/login">Go to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  const signedInAsInvitee = isAuthenticated && user?.email?.toLowerCase() === invitation.email.toLowerCase()
  const returnHere = location.pathname + location.search

  let body
  if (!invitation.account_can_accept) {
    body = (
      <Alert>
        {invitation.email} already has a ServeHub account that can’t be a coordinator (for example a volunteer account). Ask
        your NGO admin to invite a different email address.
      </Alert>
    )
  } else if (isAuthenticated && !signedInAsInvitee) {
    body = (
      <>
        <Alert tone="info">
          You’re signed in as {user?.email}, but this invitation is for <strong>{invitation.email}</strong>.
        </Alert>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => logout()}>
          Sign out to continue
        </button>
      </>
    )
  } else if (signedInAsInvitee) {
    body = (
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={acceptSignedIn} disabled={submitting}>
        {submitting ? 'Joining…' : `Join ${invitation.organization_name}`}
      </button>
    )
  } else if (invitation.account_exists) {
    body = (
      <>
        <p>
          <strong>{invitation.email}</strong> already has a ServeHub account. Sign in with it to accept.
        </p>
        <Link to="/login" state={{ from: returnHere }} className="btn btn-primary btn-lg btn-block">
          Sign in to accept
        </Link>
      </>
    )
  } else {
    body = (
      <form className="auth-form" onSubmit={acceptNew} noValidate aria-label="Create your coordinator account">
        <div className="field">
          <span className="field-label">Email address</span>
          <span className="invite-email">{invitation.email}</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="invite-name">Your full name</label>
          <input
            id="invite-name"
            className="input"
            value={form.full_name}
            onChange={change('full_name')}
            disabled={submitting}
            autoComplete="name"
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? 'invite-name-error' : undefined}
            required
          />
          {errors.full_name && <span id="invite-name-error" className="field-error">{errors.full_name}</span>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="invite-password">Choose a password</label>
          <PasswordInput
            id="invite-password"
            value={form.password}
            onChange={change('password')}
            disabled={submitting}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'invite-password-error' : 'invite-password-hint'}
            required
          />
          {errors.password ? (
            <span id="invite-password-error" className="field-error">{errors.password}</span>
          ) : (
            <span id="invite-password-hint" className="field-hint">{PASSWORD_HINT}</span>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="invite-confirm">Confirm password</label>
          <PasswordInput
            id="invite-confirm"
            value={form.confirm}
            onChange={change('confirm')}
            disabled={submitting}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'invite-confirm-error' : undefined}
            required
          />
          {errors.confirm && <span id="invite-confirm-error" className="field-error">{errors.confirm}</span>}
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
          {submitting ? 'Joining…' : 'Create account and join'}
        </button>
        <p className="field-hint">
          By joining you agree to the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </form>
    )
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Join {invitation.organization_name}</h1>
          <p>
            {invitation.invited_by_name || 'The NGO admin'} invited you to coordinate for {invitation.organization_name} on
            ServeHub: publishing volunteer opportunities, managing rosters and recording hours.
          </p>
        </div>
        {error && <Alert>{error}</Alert>}
        {body}
      </div>
    </div>
  )
}

export default AcceptInvitation
