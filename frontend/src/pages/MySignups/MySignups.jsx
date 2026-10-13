import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getMySignupsApi } from '../../services/api'
import { formatDate, formatTime } from '../../utils/format'
import './MySignups.css'

function MySignups() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { cancelSignUp, refetchMySignups } = useOpportunities()

  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('upcoming')
  const [confirmCancelId, setConfirmCancelId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const loadSignups = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getMySignupsApi(token)
      setSignups(res?.data?.signups || res?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Failed to load signups')
      setSignups([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token && user?.role === 'VOLUNTEER') loadSignups()
  }, [token, user, loadSignups])

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'VOLUNTEER') return <Navigate to="/dashboard" replace />

  const handleConfirmCancel = async (oppId, title) => {
    if (cancellingId) return
    setCancellingId(oppId)
    setActionError('')
    try {
      await cancelSignUp(oppId)
      setSignups((prev) => prev.map((s) =>
        (s.opportunity_id === oppId || s.id === oppId) ? { ...s, status: 'CANCELLED' } : s
      ))
      setConfirmCancelId(null)
      setActionSuccess(`Signup for "${title}" cancelled.`)
      if (refetchMySignups) refetchMySignups()
    } catch (err) {
      setActionError(err.message || 'Failed to cancel signup.')
    } finally {
      setCancellingId(null)
    }
  }

  const upcoming = signups.filter((s) => s.status !== 'CANCELLED')
  const completed = signups.filter((s) => s.status === 'CONFIRMED')
  const cancelled = signups.filter((s) => s.status === 'CANCELLED')

  const displayed = tab === 'upcoming' ? upcoming : tab === 'completed' ? completed : cancelled

  return (
    <div className="regs-page">
      <div className="regs-header">
        <div>
          <h1>My Registrations</h1>
          <p>Track all your volunteer event sign-ups.</p>
        </div>
        <Link to="/opportunities" className="regs-browse-btn">Browse Opportunities</Link>
      </div>

      {actionSuccess && <div className="alert-success">{actionSuccess}</div>}
      {actionError && <div className="alert-error">{actionError}</div>}
      {error && (
        <div className="alert-error">
          {error} <button type="button" className="retry-btn" onClick={loadSignups}>Retry</button>
        </div>
      )}

      <div className="regs-tabs">
        <button type="button" className={`regs-tab${tab === 'upcoming' ? ' active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming <span className="regs-tab-badge">{upcoming.length}</span>
        </button>
        <button type="button" className={`regs-tab${tab === 'completed' ? ' active' : ''}`} onClick={() => setTab('completed')}>
          Completed <span className="regs-tab-badge">{completed.length}</span>
        </button>
        <button type="button" className={`regs-tab${tab === 'cancelled' ? ' active' : ''}`} onClick={() => setTab('cancelled')}>
          Cancelled <span className="regs-tab-badge">{cancelled.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : displayed.length === 0 ? (
        <div className="regs-empty">
          <p>No {tab} registrations.</p>
          <Link to="/opportunities" className="regs-browse-btn">Browse Opportunities</Link>
        </div>
      ) : (
        <div className="regs-list">
          {displayed.map((s) => {
            const oppId = s.opportunity_id || s.id
            const title = s.opportunity_title || s.title || 'Opportunity'
            const org = s.organization_name || s.organization || ''
            const dateStr = s.opportunity_event_date || s.event_date
            const startTime = s.opportunity_start_time || s.start_time
            const endTime = s.opportunity_end_time || s.end_time
            const loc = s.opportunity_location || s.location || ''
            const isCancelled = s.status === 'CANCELLED'
            const isConfirming = confirmCancelId === oppId

            return (
              <article key={s.id} className={`regs-item${isCancelled ? ' regs-item-cancelled' : ''}`}>
                <div className="regs-item-img">
                  <div className="regs-item-img-placeholder" />
                </div>
                <div className="regs-item-body">
                  <div className="regs-item-top">
                    <div>
                      <h3 className="regs-item-title">{title}</h3>
                      <p className="regs-item-org">{org}</p>
                    </div>
                    <span className={`regs-status-badge${isCancelled ? ' cancelled' : ''}`}>
                      {isCancelled ? 'CANCELLED' : s.status === 'CONFIRMED' ? 'CONFIRMED' : 'REGISTERED'}
                    </span>
                  </div>
                  <div className="regs-item-meta">
                    {dateStr && <span>📅 {formatDate(dateStr)}</span>}
                    {startTime && <span>🕐 {formatTime(startTime, endTime)}</span>}
                    {loc && <span>📍 {loc}</span>}
                    {s.created_at && <span>Registered {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </div>

                  {isConfirming && !isCancelled && (
                    <div className="regs-confirm-box">
                      <p>Are you sure you want to cancel this registration?</p>
                      <div className="regs-confirm-btns">
                        <button type="button" className="regs-confirm-yes" onClick={() => handleConfirmCancel(oppId, title)} disabled={!!cancellingId}>
                          {cancellingId === oppId ? 'Cancelling...' : 'Yes, Cancel'}
                        </button>
                        <button type="button" className="regs-confirm-no" onClick={() => setConfirmCancelId(null)}>Keep</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="regs-item-actions">
                  <Link to={`/opportunities/${oppId}`} className="regs-view-btn">View →</Link>
                  {!isCancelled && !isConfirming && (
                    <button type="button" className="regs-cancel-btn" onClick={() => { setActionError(''); setConfirmCancelId(oppId) }}>
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MySignups
