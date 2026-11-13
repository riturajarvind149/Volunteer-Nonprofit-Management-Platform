import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { verifyEmailApi, resendVerificationApi } from '../../services/api'
import { Alert, LoadingState } from '../../components/ui'
import '../Auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Didn't get it?" form, used after registration, on failed links and on unverified sign-in. */
export function ResendVerification({ initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail)
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setStatus('error')
      setMessage('Enter a valid email address.')
      return
    }
    setStatus('sending')
    try {
      const res = await resendVerificationApi(trimmed)
      setStatus('sent')
      setMessage(res.message || 'If that account still needs verifying, a new link is on its way.')
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Could not send the email. Please try again.')
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-label="Resend verification email">
      {status === 'sent' && <Alert tone="success">{message}</Alert>}
      {status === 'error' && <Alert>{message}</Alert>}
      <div className="field">
        <label className="field-label" htmlFor="resend-email">Email address</label>
        <input
          id="resend-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'sending'}
          autoComplete="email"
          required
        />
      </div>
      <button type="submit" className="btn btn-secondary btn-block" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Resend verification email'}
      </button>
    </form>
  )
}

/**
 * Two modes:
 *  - /verify-email?token=…  → confirms the address (link from the email)
 *  - /verify-email           → "check your inbox" screen shown right after registering
 */
function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get('token')
  const registeredEmail = location.state?.email || ''

  const [state, setState] = useState(token ? 'verifying' : 'pending') // verifying | verified | failed | pending
  const [error, setError] = useState('')
  const requested = useRef(false)

  useEffect(() => {
    // Tokens are single-use; guard against React StrictMode's double effect run.
    if (!token || requested.current) return
    requested.current = true
    verifyEmailApi(token)
      .then(() => setState('verified'))
      .catch((err) => {
        setError(err.message || 'This verification link is invalid or has expired.')
        setState('failed')
      })
  }, [token])

  if (state === 'verifying') return <LoadingState label="Verifying your email…" />

  if (state === 'verified') {
    return (
      <div className="auth">
        <div className="auth-panel">
          <div className="auth-heading">
            <h1>Email verified</h1>
            <p>Your account is active. Sign in to get started.</p>
          </div>
          <Link
            to="/login"
            state={{ message: 'Your email is verified. Sign in to continue.' }}
            className="btn btn-primary btn-lg btn-block"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        <div className="auth-heading">
          {state === 'failed' ? (
            <>
              <h1>Link invalid or expired</h1>
              <p>Verification links work once and expire after 24 hours. Request a new one below.</p>
            </>
          ) : (
            <>
              <h1>Check your inbox</h1>
              <p>
                We sent a verification link to {registeredEmail ? <strong>{registeredEmail}</strong> : 'your email address'}.
                Open it to activate your account, then sign in.
              </p>
            </>
          )}
        </div>

        {state === 'failed' && error && <Alert>{error}</Alert>}

        <p className="field-hint">Didn’t get it? Check your spam folder or send a new link.</p>
        <ResendVerification initialEmail={registeredEmail} />

        <p className="auth-switch">
          Already verified? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default VerifyEmail
