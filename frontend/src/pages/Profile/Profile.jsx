import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { testCoordinatorApi, testVolunteerApi } from '../../services/api'
import Icon from '../../components/Icon'
import { Alert } from '../../components/ui'
import { formatDate } from '../../utils/format'
import './Profile.css'

function Profile() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)

  const isCoordinator = user.role === 'COORDINATOR'
  const roleLabel = isCoordinator ? 'Coordinator' : 'Volunteer'
  const initials = (user.full_name || '?').split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

  const handleCheck = async () => {
    setChecking(true)
    setResult(null)
    try {
      const res = await (isCoordinator ? testCoordinatorApi(token) : testVolunteerApi(token))
      setResult({ tone: 'success', text: res?.message || `The server confirmed your ${roleLabel.toLowerCase()} access.` })
    } catch (err) {
      setResult({ tone: 'error', text: err.message || 'The access check failed.' })
    } finally {
      setChecking(false)
    }
  }

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="page page-narrow">
      <header className="profile-header">
        <span className="profile-avatar" aria-hidden="true">{initials}</span>
        <div>
          <h1>{user.full_name}</h1>
          <p className="muted">{roleLabel} account</p>
        </div>
      </header>

      <section className="panel" aria-labelledby="details-title">
        <div className="panel-header">
          <h2 id="details-title">Account details</h2>
        </div>
        <dl className="profile-details">
          <div><dt>Full name</dt><dd>{user.full_name}</dd></div>
          <div><dt>Email address</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd>{roleLabel}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(user.created_at, { month: 'long' })}</dd></div>
        </dl>
        <p className="profile-note">
          Account details can’t be edited from ServeHub yet — the server doesn’t provide an update endpoint.
        </p>
      </section>

      {isCoordinator && (
        <Link to="/organization-profile" className="panel profile-link">
          <Icon name="building" size={18} />
          <span>
            <strong>My organizations</strong>
            <span className="muted">Organizations you manage and their opportunities</span>
          </span>
          <Icon name="chevron-right" size={16} />
        </Link>
      )}

      <section className="panel" aria-labelledby="access-title">
        <div className="panel-header">
          <h2 id="access-title">Access check</h2>
        </div>
        <div className="panel-body profile-access">
          <p className="muted">Ask the server to confirm that your session carries {roleLabel.toLowerCase()} permissions. Useful if a page refuses to load.</p>
          {result && <Alert tone={result.tone}>{result.text}</Alert>}
          <button type="button" className="btn btn-secondary" onClick={handleCheck} disabled={checking}>
            <Icon name="shield" size={15} />
            {checking ? 'Checking…' : 'Run access check'}
          </button>
        </div>
      </section>

      <div className="profile-signout">
        <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
          <Icon name="log-out" size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}

export default Profile
