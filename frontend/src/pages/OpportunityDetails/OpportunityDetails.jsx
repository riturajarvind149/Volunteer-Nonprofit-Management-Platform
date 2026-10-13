import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOpportunityByIdApi } from '../../services/api'
import { formatTime } from '../../utils/format'
import './OpportunityDetails.css'

const STATUS_BADGE = {
  PUBLISHED: 'badge-published',
  DRAFT: 'badge-draft',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
}

function OpportunityDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { isRegistered, signUp, cancelSignUp } = useOpportunities()

  const [opportunity, setOpportunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError('')
    getOpportunityByIdApi(id, token)
      .then((res) => setOpportunity(res?.data?.opportunity || null))
      .catch((err) => setFetchError(err.message || 'Failed to load opportunity details.'))
      .finally(() => setLoading(false))
  }, [id, token])

  if (authLoading || loading) {
    return (
      <div className="details-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading opportunity details...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="details-page">
        <div className="details-container not-found">
          <h2>Authentication Required</h2>
          <p>Please log in to view opportunity details.</p>
          <Link to="/login" className="btn btn-primary">Login</Link>
        </div>
      </div>
    )
  }

  if (fetchError || !opportunity) {
    return (
      <div className="details-page">
        <div className="details-container not-found">
          <h2>Opportunity Not Found</h2>
          <p>{fetchError || 'The opportunity you are looking for does not exist or has ended.'}</p>
          <Link to="/opportunities" className="btn btn-secondary">Back to Opportunities</Link>
        </div>
      </div>
    )
  }

  const { title, category, location, description, status, event_date, start_time, end_time, capacity, address, coordinator_id } = opportunity
  const spotsRemaining = opportunity.spots_remaining !== undefined ? Number(opportunity.spots_remaining) : null
  const isFull = spotsRemaining !== null && spotsRemaining <= 0
  const isCoordinator = user?.role === 'COORDINATOR'
  const isOwner = isCoordinator && coordinator_id === user?.id
  const registered = isRegistered(opportunity.id)

  let dateDisplay = ''
  if (event_date) {
    dateDisplay = new Date(event_date + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }
  const timeDisplay = formatTime(start_time, end_time)

  const handleSignUp = async () => {
    if (!isAuthenticated) { navigate('/login'); return }
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')
    try {
      await signUp(opportunity.id)
      setActionSuccess('Successfully signed up for this opportunity!')
    } catch (err) {
      setActionError(err.message || 'Failed to sign up. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')
    try {
      await cancelSignUp(opportunity.id)
      setActionSuccess('Your signup has been cancelled.')
    } catch (err) {
      setActionError(err.message || 'Failed to cancel signup. Please try again.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="details-page">
      <div className="details-container">
        <Link to="/opportunities" className="back-btn">Back to Opportunities</Link>

        <article className="details-card">
          <header className="details-header">
            <div className="details-badges">
              <span className="card-category">{category || 'General'}</span>
              {status && (
                <span className={`status-pill ${STATUS_BADGE[status] || ''}`}>{status}</span>
              )}
              {spotsRemaining !== null && (
                <span className="card-spots">
                  {isFull ? 'Fully Booked' : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} available`}
                </span>
              )}
            </div>
            <h1>{title}</h1>
            <p className="details-org">
              Organized by <strong>{opportunity.organization_name || 'Unknown Organization'}</strong>
            </p>
          </header>

          <section className="details-meta-grid">
            {dateDisplay && (
              <div className="meta-item">
                <span className="meta-label">Date</span>
                <span className="meta-value">{dateDisplay}{timeDisplay ? '  ' + timeDisplay : ''}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">Location</span>
              <span className="meta-value">{location || 'Location TBD'}</span>
            </div>
            {address && (
              <div className="meta-item">
                <span className="meta-label">Address</span>
                <span className="meta-value">{address}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">Category</span>
              <span className="meta-value">{category || 'General'}</span>
            </div>
            {capacity !== undefined && (
              <div className="meta-item">
                <span className="meta-label">Capacity</span>
                <span className="meta-value">{capacity} total spots</span>
              </div>
            )}
            {spotsRemaining !== null && (
              <div className="meta-item">
                <span className="meta-label">Availability</span>
                <span className="meta-value">
                  {isFull ? 'Fully Booked' : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining`}
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

          <footer className="details-actions">
            {actionSuccess && <div className="alert-success" style={{ marginBottom: '1rem' }}>{actionSuccess}</div>}
            {actionError && <div className="alert-error" style={{ marginBottom: '1rem' }}>{actionError}</div>}

            {isCoordinator && isOwner && (
              <Link to={`/opportunities/${opportunity.id}/edit`} className="btn btn-secondary">Edit Opportunity</Link>
            )}

            {!isCoordinator && (
              registered ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div className="signed-up-banner">You are signed up to volunteer for this opportunity!</div>
                  <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={actionLoading}>
                    {actionLoading ? 'Cancelling...' : 'Cancel Signup'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary volunteer-btn"
                  onClick={handleSignUp}
                  disabled={actionLoading || isFull || status !== 'PUBLISHED'}
                >
                  {actionLoading ? 'Signing up...'
                    : isFull ? 'Fully Booked'
                    : status !== 'PUBLISHED' ? 'Not Available'
                    : 'Sign Up to Volunteer'}
                </button>
              )
            )}
          </footer>
        </article>
      </div>
    </div>
  )
}

export default OpportunityDetails
