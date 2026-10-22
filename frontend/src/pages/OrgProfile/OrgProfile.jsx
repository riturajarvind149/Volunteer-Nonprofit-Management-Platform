import { useState, useEffect, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationsApi } from '../../services/api'
import './OrgProfile.css'

function OrgProfile() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

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
  const createdYear = org.created_at ? new Date(org.created_at).getFullYear() : null

  return (
    <div className="orgprofile-page">
      <div className="orgprofile-header-row">
        <h1>Organization Profile</h1>
        <Link to="/manage-opportunities" className="orgprofile-edit-btn">
          Manage Opportunities →
        </Link>
      </div>
      <p className="orgprofile-subtext">Your nonprofit's profile as seen by volunteers.</p>

      <div className="orgprofile-grid">
        <div className="orgprofile-left">
          <div className="orgprofile-logo-section">
            <div className="orgprofile-logo">{initials}</div>
            <h2 className="orgprofile-name">{org.name}</h2>
            <span className="orgprofile-type-badge">NONPROFIT ORGANIZATION</span>
            {createdYear && <span className="orgprofile-since">Since {createdYear}</span>}
          </div>

          <div className="orgprofile-public-preview">
            <span className="preview-icon">👁</span>
            <p>
              <strong>Public Profile</strong><br />
              <span>Volunteers see your organization profile when browsing opportunities.</span>
            </p>
          </div>
        </div>

        <div className="orgprofile-right">
          <div className="orgprofile-section-card">
            <h3>About</h3>
            {org.description ? (
              <p className="orgprofile-about-text">{org.description}</p>
            ) : (
              <p className="orgprofile-about-text orgprofile-about-empty">
                No description provided. Edit your organization to add a description.
              </p>
            )}
          </div>

          <div className="orgprofile-section-card">
            <h3>Quick Links</h3>
            <div className="orgprofile-quick-links">
              <Link to="/manage-opportunities" className="btn btn-secondary btn-sm">Manage Opportunities</Link>
              <Link to="/coordinator-hours" className="btn btn-secondary btn-sm">Volunteer Hours</Link>
              <Link to="/analytics" className="btn btn-secondary btn-sm">Analytics</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrgProfile
