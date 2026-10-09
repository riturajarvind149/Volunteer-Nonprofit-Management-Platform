import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { testCoordinatorApi, testVolunteerApi } from '../../services/api'
import './Profile.css'

function Profile() {
  const { user, token, loading, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [testResult, setTestResult] = useState(null)
  const [testingRole, setTestingRole] = useState(false)
  const [testError, setTestError] = useState('')

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

  const handleTestRole = async () => {
    setTestingRole(true)
    setTestResult(null)
    setTestError('')
    try {
      let res
      if (user.role === 'COORDINATOR') {
        res = await testCoordinatorApi(token)
      } else {
        res = await testVolunteerApi(token)
      }
      setTestResult(res?.message || 'Authorization verified successfully!')
    } catch (err) {
      setTestError(err.message || 'Authorization test failed.')
    } finally {
      setTestingRole(false)
    }
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
          <p>Manage your account details and platform permissions.</p>
        </div>

        <div className="profile-details">
          {details.map(({ label, value }) => (
            <div key={label} className="profile-row">
              <span className="profile-row-label">{label}</span>
              <span className="profile-row-value">{value}</span>
            </div>
          ))}
        </div>

        <div className="role-test-section">
          <h3>Role Access Verification</h3>
          <p className="role-test-desc">
            Test backend RBAC access control for your <strong>{displayRole}</strong> role.
          </p>

          {testResult && <div className="alert-success">{testResult}</div>}
          {testError && <div className="alert-error">{testError}</div>}

          <div className="role-test-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleTestRole}
              disabled={testingRole}
            >
              {testingRole ? 'Verifying...' : `Verify ${displayRole} Access`}
            </button>
            <Link to="/organizations" className="btn btn-secondary">
              {isCoordinator ? 'Manage Organizations' : 'Browse Organizations'}
            </Link>
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
