import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Profile.css'

function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isCoordinator = user.role === 'COORDINATOR'
  const displayRole = isCoordinator ? 'NGO Coordinator' : 'Volunteer'
  const roleClass = isCoordinator ? 'coordinator' : 'volunteer'
  const initial = (user.full_name?.[0] || 'U').toUpperCase()

  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active Member'

  const details = [
    { label: 'Full Name', value: user.full_name },
    { label: 'Email Address', value: user.email },
    {
      label: 'Platform Role',
      value: <span className={`role-badge ${roleClass}`}>{displayRole}</span>,
    },
    {
      label: 'Account Status',
      value: (
        <span className="status-badge">
          <span className="status-dot" />
          Active
        </span>
      ),
    },
    { label: 'Member Since', value: formattedDate },
  ]

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{initial}</div>
          <h1>My Profile</h1>
          <p>Manage your account details and platform preferences.</p>
        </div>

        <div className="profile-details">
          {details.map(({ label, value }) => (
            <div key={label} className="profile-row">
              <span className="profile-row-label">{label}</span>
              <span className="profile-row-value">{value}</span>
            </div>
          ))}
        </div>

        <div className="profile-actions">
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile
