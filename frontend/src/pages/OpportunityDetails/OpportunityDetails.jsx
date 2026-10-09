import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import './OpportunityDetails.css'

function OpportunityDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { opportunities, isRegistered, signUp, cancelSignUp } = useOpportunities()
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Support both numeric IDs (mock) and UUID strings (real API)
  const opportunity = opportunities.find(
    (item) => String(item.id) === String(id)
  )

  if (!opportunity) {
    return (
      <main className="details-page">
        <div className="details-container not-found">
          <h2>Opportunity Not Found</h2>
          <p>The opportunity you are looking for does not exist or has ended.</p>
          <Link to="/opportunities" className="btn btn-secondary">
            ← Back to Opportunities
          </Link>
        </div>
      </main>
    )
  }

  // Normalise field names — real API uses snake_case, mock uses camelCase
  const title = opportunity.title
  const organization = opportunity.organization_name || opportunity.organization || 'Unknown Organization'
  const category = opportunity.category || 'General'
  const location = opportunity.location
  const description = opportunity.description || ''
  const requirements = Array.isArray(opportunity.requirements) ? opportunity.requirements : []

  // Spots: real API provides spots_remaining, mock provides spots
  const spotsRemaining =
    opportunity.spots_remaining !== undefined
      ? Number(opportunity.spots_remaining)
      : opportunity.spots !== undefined
      ? Number(opportunity.spots)
      : null

  // Date / time formatting
  let dateDisplay = ''
  let timeDisplay = ''
  if (opportunity.event_date) {
    // Real API: event_date = "2026-10-15", start_time = "09:00", end_time = "13:00"
    dateDisplay = new Date(opportunity.event_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    if (opportunity.start_time && opportunity.end_time) {
      const fmt = (t) => {
        const [h, m] = t.split(':')
        const date = new Date()
        date.setHours(Number(h), Number(m))
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }
      timeDisplay = `${fmt(opportunity.start_time)} – ${fmt(opportunity.end_time)}`
    }
  } else if (opportunity.date) {
    // Mock: date = "Oct 15, 2026", time = "09:00 AM - 01:00 PM"
    dateDisplay = opportunity.date
    timeDisplay = opportunity.time || ''
  }

  const registered = isRegistered(opportunity.id)

  const handleSignUp = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    setActionLoading(true)
    setActionError('')
    try {
      await signUp(opportunity.id)
    } catch (err) {
      setActionError(err.message || 'Failed to sign up. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    setActionError('')
    try {
      await cancelSignUp(opportunity.id)
    } catch (err) {
      setActionError(err.message || 'Failed to cancel signup. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const isFull = spotsRemaining !== null && spotsRemaining <= 0

  return (
    <main className="details-page">
      <div className="details-container">
        <Link to="/opportunities" className="back-btn">
          ← Back to Opportunities
        </Link>

        <article className="details-card">
          <header className="details-header">
            <div className="details-badges">
              <span className="card-category">{category}</span>
              {spotsRemaining !== null && (
                <span className="card-spots">
                  {isFull ? 'Fully Booked' : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} available`}
                </span>
              )}
            </div>
            <h1>{title}</h1>
            <p className="details-org">
              Organized by <strong>{organization}</strong>
            </p>
          </header>

          <section className="details-meta-grid">
            {dateDisplay && (
              <div className="meta-item">
                <span className="meta-label">📅 Date</span>
                <span className="meta-value">{dateDisplay}{timeDisplay ? ` • ${timeDisplay}` : ''}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">📍 Location</span>
              <span className="meta-value">{location}</span>
            </div>
            {opportunity.address && (
              <div className="meta-item">
                <span className="meta-label">🗺️ Address</span>
                <span className="meta-value">{opportunity.address}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">🏷️ Category</span>
              <span className="meta-value">{category}</span>
            </div>
            {spotsRemaining !== null && (
              <div className="meta-item">
                <span className="meta-label">👥 Capacity</span>
                <span className="meta-value">
                  {isFull ? 'Fully Booked' : `${spotsRemaining} volunteer${spotsRemaining !== 1 ? 's' : ''} needed`}
                </span>
              </div>
            )}
          </section>

          {description && (
            <section className="details-section">
              <h2>About this Opportunity</h2>
              <p>{description}</p>
            </section>
          )}

          {requirements.length > 0 && (
            <section className="details-section">
              <h2>Requirements</h2>
              <ul className="requirements-list">
                {requirements.map((req, index) => (
                  <li key={index}>{req}</li>
                ))}
              </ul>
            </section>
          )}

          <footer className="details-actions">
            {actionError && <div className="alert-error" style={{ marginBottom: '1rem' }}>{actionError}</div>}

            {registered ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="signed-up-banner">
                  ✓ You have signed up to volunteer for this opportunity!
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel Signup'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary volunteer-btn"
                onClick={handleSignUp}
                disabled={actionLoading || isFull}
              >
                {actionLoading
                  ? 'Signing up...'
                  : isFull
                  ? 'Fully Booked'
                  : isAuthenticated
                  ? 'Sign Up / Volunteer'
                  : 'Login to Sign Up'}
              </button>
            )}
          </footer>
        </article>
      </div>
    </main>
  )
}

export default OpportunityDetails
