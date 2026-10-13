import { useState, useEffect, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationsApi } from '../../services/api'
import './OrgProfile.css'

function OrgProfile() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await getOrganizationsApi(token)
      const orgs = res?.data?.organizations || []
      const mine = orgs.find((o) => o.coordinator_id === user?.id)
      setOrg(mine || null)
    } catch {
      setOrg(null)
    } finally {
      setLoading(false)
    }
  }, [token, user])

  useEffect(() => { load() }, [load])

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading organization profile...</p>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="orgprofile-page">
        <div className="orgprofile-empty">
          <h2>No Organization Found</h2>
          <p>You haven't created an organization yet.</p>
          <Link to="/organizations" className="orgprofile-create-btn">Create Organization</Link>
        </div>
      </div>
    )
  }

  const initials = org.name?.slice(0, 2).toUpperCase() || 'VO'
  const createdYear = org.created_at ? new Date(org.created_at).getFullYear() : '2024'

  return (
    <div className="orgprofile-page">
      <div className="orgprofile-header-row">
        <h1>Organization Profile</h1>
        <button
          type="button"
          className="orgprofile-edit-btn"
          onClick={() => setEditing(!editing)}
        >
          ✏ Edit Profile
        </button>
      </div>
      <p className="orgprofile-subtext">Manage your nonprofit's public profile and information.</p>

      <div className="orgprofile-grid">
        <div className="orgprofile-left">
          <div className="orgprofile-logo-section">
            <div className="orgprofile-logo">{initials}</div>
            <h2 className="orgprofile-name">{org.name}</h2>
            <span className="orgprofile-type-badge">NONPROFIT ORGANIZATION</span>
          </div>

          <div className="orgprofile-stats-row">
            <div className="orgprofile-stat">
              <strong>24</strong>
              <span>Events</span>
            </div>
            <div className="orgprofile-stat">
              <strong>312</strong>
              <span>Volunteers</span>
            </div>
            <div className="orgprofile-stat">
              <strong>1840</strong>
              <span>Hours</span>
            </div>
          </div>

          <div className="orgprofile-info-section">
            <h3>Contact Information</h3>
            <div className="orgprofile-info-list">
              <div className="orgprofile-info-row">
                <span>🌐</span>
                <span>{org.name?.toLowerCase().replace(/\s+/g, '')}.org</span>
              </div>
              <div className="orgprofile-info-row">
                <span>✉</span>
                <span>hello@{org.name?.toLowerCase().replace(/\s+/g, '')}.org</span>
              </div>
              <div className="orgprofile-info-row">
                <span>📞</span>
                <span>+91 80 2222 3333</span>
              </div>
              <div className="orgprofile-info-row">
                <span>📍</span>
                <span>Koramangala, Bengaluru</span>
              </div>
            </div>
          </div>

          <div className="orgprofile-public-preview">
            <span className="preview-icon">👁</span>
            <p>
              <strong>Public Profile Preview</strong><br />
              <span>Volunteers see your profile when browsing opportunities. Keep it updated and compelling!</span>
            </p>
          </div>
        </div>

        <div className="orgprofile-right">
          <div className="orgprofile-section-card">
            <h3>About</h3>
            {editing ? (
              <textarea
                className="orgprofile-about-input"
                defaultValue={org.description || 'Dedicated to creating a greener, cleaner Bengaluru through community-driven environmental initiatives.'}
                rows={4}
              />
            ) : (
              <p className="orgprofile-about-text">
                {org.description || 'Dedicated to creating a greener, cleaner Bengaluru through community-driven environmental initiatives.'}
              </p>
            )}
          </div>

          <div className="orgprofile-section-card">
            <h3>Social Links</h3>
            <div className="orgprofile-social-list">
              <div className="orgprofile-social-item">
                <span className="social-icon twitter">𝕏</span>
                <span>@{org.name?.replace(/\s+/g, '').toLowerCase()}</span>
              </div>
              <div className="orgprofile-social-item">
                <span className="social-icon instagram">📷</span>
                <span>@{org.name?.replace(/\s+/g, '').toLowerCase()}</span>
              </div>
            </div>
          </div>

          <div className="orgprofile-section-card">
            <h3>Impact Summary</h3>
            <div className="orgprofile-impact-list">
              <div className="orgprofile-impact-row">
                <span>Active Volunteers</span>
                <div className="impact-progress-bar-track">
                  <div className="impact-progress-bar" style={{ width: '78%' }} />
                </div>
                <span className="impact-val">78 this month</span>
              </div>
              <div className="orgprofile-impact-row">
                <span>Event Fill Rate</span>
                <div className="impact-progress-bar-track">
                  <div className="impact-progress-bar" style={{ width: '87%' }} />
                </div>
                <span className="impact-val">87% avg.</span>
              </div>
              <div className="orgprofile-impact-row">
                <span>Hour Verification Rate</span>
                <div className="impact-progress-bar-track">
                  <div className="impact-progress-bar" style={{ width: '94%' }} />
                </div>
                <span className="impact-val">94%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrgProfile
