import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { verifyEmailApi, verifyEmailCodeApi, resendVerificationApi } from '../../services/api'
import { Alert, LoadingState } from '../../components/ui'
import CodeField from '../../components/CodeField'
import { isCompleteCode } from '../../utils/code'
import '../Auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Didn't get it?" form: sends a new code + link. */
export function ResendVerification({ initialEmail = '', onSent }) {
  const [email, setEmail] = useState(initialEmail)
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [message, setMessage] = useState('')
  const [notRegistered, setNotRegistered] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    setNotRegistered(false)
    if (!EMAIL_PATTERN.test(trimmed)) {
      setStatus('error')
      setMessage('Enter a valid email address.')
      return
    }
    setStatus('sending')
    try {
      const res = await resendVerificationApi(trimmed)
      setStatus('sent')
      setMessage(res.message || 'A new verification code is on its way.')
      onSent?.(trimmed, Boolean(res.data?.already_verified))
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Could not send the email. Please try again.')
      setNotRegistered(err.code === 'EMAIL_NOT_REGISTERED')
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-label="Resend verification email">
      {status === 'sent' && <Alert tone="success">{message}</Alert>}
      {status === 'error' && (
        <Alert>
          {message} {notRegistered && <Link to="/register">Create an account</Link>}
        </Alert>
      )}
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
        {status === 'sending' ? 'Sending…' : 'Send a new code'}
      </button>
    </form>
  )
}

/** Email + 6-digit code form. */
function VerifyCodeForm({ email, setEmail, onVerified }) {
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [notRegistered, setNotRegistered] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    const nextErrors = {}
    if (!EMAIL_PATTERN.test(trimmed)) nextErrors.email = 'Enter a valid email address.'
    if (!isCompleteCode(code)) nextErrors.code = 'Enter all 6 digits.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setError('')
    setNotRegistered(false)
    setLoading(true)
    try {
      const res = await verifyEmailCodeApi(trimmed, code)
      onVerified(res.message)
    } catch (err) {
      setLoading(false)
      if (err.code === 'INVALID_CODE') {
        setErrors({ code: err.message })
      } else {
        setError(err.message || 'Could not verify your email. Please try again.')
        setNotRegistered(err.code === 'EMAIL_NOT_REGISTERED')
      }
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate aria-label="Verify with code">
      {error && (
        <Alert>
          {error} {notRegistered && <Link to="/register">Create an account</Link>}
        </Alert>
      )}
      <div className="field">
        <label className="field-label" htmlFor="verify-email">Email address</label>
        <input
          id="verify-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'verify-email-error' : undefined}
          required
        />
        {errors.email && <span id="verify-email-error" className="field-error">{errors.email}</span>}
      </div>
      <CodeField value={code} onChange={setCode} error={errors.code} disabled={loading} />
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
        {loading ? 'Verifying…' : 'Verify email'}
      </button>
    </form>
  )
}

/**
 * Two ways in:
 *  - /verify-email?token=…  → confirms the address (link from the email)
 *  - /verify-email           → enter the 6-digit code (after registering or an unverified sign-in)
 */
function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const token = searchParams.get('token')
  const [email, setEmail] = useState(location.state?.email || '')

  const [state, setState] = useState(token ? 'verifying' : 'pending') // verifying | verified | failed | pending
  const [error, setError] = useState('')
  const [doneMessage, setDoneMessage] = useState('')
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

  const markVerified = (message) => {
    setDoneMessage(message || '')
    setState('verified')
  }

  if (state === 'verifying') return <LoadingState label="Verifying your email…" />

  if (state === 'verified') {
    return (
      <div className="auth">
        <div className="auth-panel">
          <div className="auth-heading">
            <h1>Email verified</h1>
            <p>{doneMessage && /already/i.test(doneMessage) ? doneMessage : 'Your account is active. Sign in to get started.'}</p>
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
              <p>Enter the 6-digit code from your latest verification email instead, or send a new one.</p>
            </>
          ) : (
            <>
              <h1>Verify your email</h1>
              <p>
                We sent a 6-digit code to {location.state?.email ? <strong>{location.state.email}</strong> : 'your email address'}.
                Enter it below to activate your account.
              </p>
            </>
          )}
        </div>

        {state === 'failed' && error && <Alert>{error}</Alert>}

        <VerifyCodeForm email={email} setEmail={setEmail} onVerified={markVerified} />

        <p className="auth-subheading">Didn’t get the email? Check your spam folder, or send a new code.</p>
        <ResendVerification
          initialEmail={email}
          onSent={(sentTo, alreadyVerified) => {
            setEmail(sentTo)
            if (alreadyVerified) markVerified('This email is already verified. You can log in.')
          }}
        />

        <p className="auth-switch">
          Already verified? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default VerifyEmail
