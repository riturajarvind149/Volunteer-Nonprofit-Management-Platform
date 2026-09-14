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

  // Format role for display: VOLUNTEER -> Volunteer, COORDINATOR -> NGO Coordinator
  const displayRole = user.role === 'COORDINATOR' ? 'NGO Coordinator' : 'Volunteer'
  const roleClass = user.role === 'COORDINATOR' ? 'coordinator' : 'volunteer'

  // Get initial for avatar badge
  const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'

  // Format date if available
  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active Member'

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{initial}</div>
          <h1>My Profile</h1>
          <p>Manage your account details and platform preferences.</p>
        </div>

        <div className="profile-details">
          <div className="profile-row">
            <span className="profile-row-label">Full Name</span>
            <span className="profile-row-value">{user.full_name}</span>
          </div>

          <div className="profile-row">
            <span className="profile-row-label">Email Address</span>
            <span className="profile-row-value">{user.email}</span>
          </div>

          <div className="profile-row">
            <span className="profile-row-label">Platform Role</span>
            <span className="profile-row-value">
              <span className={`role-badge ${roleClass}`}>{displayRole}</span>
            </span>
          </div>

          <div className="profile-row">
            <span className="profile-row-label">Account Status</span>
            <span className="profile-row-value">
              <span className="status-badge">
                <span className="status-dot" />
                Active
              </span>
            </span>
          </div>

          <div className="profile-row">
            <span className="profile-row-label">Member Since</span>
            <span className="profile-row-value">{formattedDate}</span>
          </div>
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
