import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import { formatDate } from '../../utils/format'
import './Profile.css'

function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isCoordinator = user.role === 'COORDINATOR'
  const roleLabel = isCoordinator ? 'Coordinator' : 'Volunteer'
  const initials = (user.full_name || '?').split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

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

      <div className="profile-signout">
        <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
          <Icon name="log-out" size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}

export default Profile
