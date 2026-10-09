import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './VolunteerHours.css'

function VolunteerHours() {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <main className="hours-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const isCoordinator = user?.role === 'COORDINATOR'

  return (
    <main className="hours-page">
      <div className="hours-container">
        <header className="hours-header">
          <h1>{isCoordinator ? 'Volunteer Hours Management' : 'My Volunteer Hours'}</h1>
          <p>
            {isCoordinator
              ? 'Review and verify hours submitted by volunteers for your opportunities.'
              : 'Track and view all your recorded volunteer hours.'}
          </p>
        </header>

        <div className="hours-notice-card">
          <div className="notice-icon">🔧</div>
          <h2>Hours Tracking Coming Soon</h2>
          <p>
            The volunteer hours feature requires the following backend endpoints that have not yet been implemented:
          </p>
          <ul className="missing-endpoints">
            <li><code>POST /api/hours</code> — Record hours for a signup</li>
            <li><code>GET /api/hours/my</code> — Get current volunteer's hours</li>
            <li><code>GET /api/hours/opportunity/:id</code> — Get all hours for an opportunity (coordinator)</li>
            <li><code>PATCH /api/hours/:id/verify</code> — Verify hours (coordinator)</li>
          </ul>
          <p className="notice-note">
            Once these endpoints are available, this page will display full hours recording, history, and verification functionality.
          </p>

          <div className="notice-actions">
            <Link to="/dashboard" className="btn btn-secondary">Back to Dashboard</Link>
            {!isCoordinator && (
              <Link to="/my-signups" className="btn btn-outline">My Signups</Link>
            )}
          </div>
        </div>

        <div className="hours-summary-row">
          <div className="hours-summary-card">
            <span className="summary-icon">⏱️</span>
            <div>
              <div className="summary-value">—</div>
              <div className="summary-label">{isCoordinator ? 'Total Hours Recorded' : 'Total Hours Contributed'}</div>
            </div>
          </div>
          <div className="hours-summary-card">
            <span className="summary-icon">✅</span>
            <div>
              <div className="summary-value">—</div>
              <div className="summary-label">Verified Hours</div>
            </div>
          </div>
          <div className="hours-summary-card">
            <span className="summary-icon">🕐</span>
            <div>
              <div className="summary-value">—</div>
              <div className="summary-label">Pending Verification</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default VolunteerHours
