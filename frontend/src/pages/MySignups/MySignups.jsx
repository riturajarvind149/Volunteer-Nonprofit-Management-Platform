import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getMySignupsApi } from '../../services/api'
import './MySignups.css'

function MySignups() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { cancelSignUp, refetchMySignups } = useOpportunities()

  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('active') // 'active' | 'all' | 'cancelled'
  const [confirmCancelId, setConfirmCancelId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // ── Fetch volunteer's own signups from API ──────────────────────────────
  const loadSignups = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getMySignupsApi(token)
      const list = res?.data?.signups || res?.data?.opportunities || []
      setSignups(list)
    } catch (err) {
      setError(err.message || 'Failed to load signups from server')
      setSignups([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token && user?.role === 'VOLUNTEER') {
      loadSignups()
    }
  }, [token, user, loadSignups])

  // ── Auth & Role Guard ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <main className="my-signups-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your signups...</p>
        </div>
      </main>
    )
  }

  // Redirect unauthenticated visitors to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Redirect coordinators away to dashboard (volunteer-only experience)
  if (user.role !== 'VOLUNTEER') {
    return <Navigate to="/dashboard" replace />
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatTime = (startTime, endTime) => {
    if (!startTime) return ''
    const fmt = (t) => {
      const [h, m] = t.split(':')
      const d = new Date()
      d.setHours(Number(h), Number(m))
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    if (endTime) {
      return `${fmt(startTime)} – ${fmt(endTime)}`
    }
    return fmt(startTime)
  }

  // ── Cancellation Workflow ───────────────────────────────────────────────
  const handleInitiateCancel = (oppId) => {
    setActionError('')
    setActionSuccess('')
    setConfirmCancelId(oppId)
  }

  const handleDismissCancel = () => {
    if (cancellingId) return
    setConfirmCancelId(null)
  }

  const handleConfirmCancel = async (oppId, oppTitle) => {
    if (cancellingId) return // Prevent repeated submission
    setCancellingId(oppId)
    setActionError('')
    setActionSuccess('')

    try {
      // Call context method which communicates with DELETE /api/opportunities/:id/signup
      await cancelSignUp(oppId)

      // Optimistically update local signup item status to CANCELLED
      setSignups((prev) =>
        prev.map((item) =>
          item.opportunity_id === oppId || item.id === oppId
            ? { ...item, status: 'CANCELLED' }
            : item
        )
      )

      setConfirmCancelId(null)
      setActionSuccess(`Your signup for "${oppTitle || 'Opportunity'}" has been cancelled.`)

      // Sync OpportunityContext state in background
      if (refetchMySignups) {
        refetchMySignups()
      }
    } catch (err) {
      setActionError(err.message || 'Failed to cancel signup. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  // ── Filtered Signups ────────────────────────────────────────────────────
  const activeSignups = signups.filter((s) => s.status !== 'CANCELLED')
  const cancelledSignups = signups.filter((s) => s.status === 'CANCELLED')

  const displayedSignups =
    filter === 'active'
      ? activeSignups
      : filter === 'cancelled'
      ? cancelledSignups
      : signups

  return (
    <main className="my-signups-page">
      <div className="my-signups-container">
        {/* Header Section */}
        <header className="my-signups-header">
          <div className="header-text">
            <h1>My Volunteer Signups</h1>
            <p>View your scheduled commitments, event information, and signup history.</p>
          </div>
          <div className="header-actions">
            <Link to="/opportunities" className="btn btn-primary">
              Browse More Opportunities →
            </Link>
          </div>
        </header>

        {/* Action Banners */}
        {actionSuccess && (
          <div className="alert-success" role="alert">
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="alert-error" role="alert">
            {actionError}
          </div>
        )}
        {error && (
          <div className="alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={loadSignups}>
              Retry
            </button>
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <nav className="my-signups-tabs" aria-label="Signups filter">
          <button
            type="button"
            className={`tab-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active Signups <span className="tab-badge">{activeSignups.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Signups <span className="tab-badge">{signups.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled <span className="tab-badge">{cancelledSignups.length}</span>
          </button>
        </nav>

        {/* Content Body */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Fetching your signup details...</p>
          </div>
        ) : displayedSignups.length === 0 ? (
          <div className="empty-signups-card">
            <div className="empty-icon">📋</div>
            <h3>
              {filter === 'active'
                ? 'No Active Signups'
                : filter === 'cancelled'
                ? 'No Cancelled Signups'
                : 'No Signups Found'}
            </h3>
            <p>
              {filter === 'active'
                ? 'You are not currently signed up for any upcoming opportunities. Explore available community initiatives and sign up to contribute!'
                : filter === 'cancelled'
                ? 'You have not cancelled any volunteer signups.'
                : 'You have not registered for any volunteer opportunities yet.'}
            </p>
            <Link to="/opportunities" className="btn btn-primary">
              Explore Opportunities
            </Link>
          </div>
        ) : (
          <div className="signups-grid">
            {displayedSignups.map((signup) => {
              const oppId = signup.opportunity_id || signup.id
              const title = signup.opportunity_title || signup.title || 'Untitled Opportunity'
              const orgName =
                signup.organization_name || signup.organization || 'Community Organization'
              const dateDisplay = formatDate(signup.opportunity_event_date || signup.event_date)
              const timeDisplay = formatTime(
                signup.opportunity_start_time || signup.start_time,
                signup.opportunity_end_time || signup.end_time
              )
              const location =
                signup.opportunity_location || signup.location || 'Location upon registration'
              const isCancelled = signup.status === 'CANCELLED'
              const isConfirming = confirmCancelId === oppId
              const isCurrentlyCancelling = cancellingId === oppId

              return (
                <article key={signup.id} className={`signup-card ${isCancelled ? 'cancelled-card' : ''}`}>
                  <div className="signup-card-header">
                    <span
                      className={`signup-status-badge ${
                        isCancelled ? 'badge-cancelled' : 'badge-registered'
                      }`}
                    >
                      {isCancelled ? '✕ Cancelled' : '✓ Registered'}
                    </span>
                    <span className="signup-date-pill">{dateDisplay}</span>
                  </div>

                  <h2 className="signup-title">
                    <Link to={`/opportunities/${oppId}`}>{title}</Link>
                  </h2>

                  <p className="signup-org">
                    Organized by <strong>{orgName}</strong>
                  </p>

                  <div className="signup-meta">
                    {timeDisplay && (
                      <div className="meta-row">
                        <span className="meta-icon">⏰</span>
                        <span>{timeDisplay}</span>
                      </div>
                    )}
                    <div className="meta-row">
                      <span className="meta-icon">📍</span>
                      <span>{location}</span>
                    </div>
                  </div>

                  {/* Cancellation Confirmation Box */}
                  {isConfirming && (
                    <div className="confirm-cancel-box">
                      <p className="confirm-text">Cancel your volunteer registration for this opportunity?</p>
                      <div className="confirm-actions">
                        <button
                          type="button"
                          className="btn-confirm-cancel"
                          onClick={() => handleConfirmCancel(oppId, title)}
                          disabled={isCurrentlyCancelling}
                        >
                          {isCurrentlyCancelling ? 'Cancelling...' : 'Yes, Cancel Signup'}
                        </button>
                        <button
                          type="button"
                          className="btn-keep-signup"
                          onClick={handleDismissCancel}
                          disabled={isCurrentlyCancelling}
                        >
                          Keep Signup
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card Actions Footer */}
                  <div className="signup-card-actions">
                    <Link to={`/opportunities/${oppId}`} className="btn btn-outline btn-sm">
                      View Details
                    </Link>

                    {!isCancelled ? (
                      !isConfirming && (
                        <button
                          type="button"
                          className="btn-cancel-signup"
                          onClick={() => handleInitiateCancel(oppId)}
                          disabled={!!cancellingId}
                        >
                          Cancel Signup
                        </button>
                      )
                    ) : (
                      <span className="cancelled-indicator">Registration Cancelled</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default MySignups
