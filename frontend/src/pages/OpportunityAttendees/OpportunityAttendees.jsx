import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getOpportunityAttendeesApi,
  updateSignupStatusApi,
  recordHoursApi,
} from '../../services/api'
import './OpportunityAttendees.css'

const SIGNUP_STATUSES = ['REGISTERED', 'CANCELLED']

function OpportunityAttendees() {
  const { id: opportunityId } = useParams()
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()

  const [data, setData] = useState(null) // { opportunity, signups }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [updatingSignupId, setUpdatingSignupId] = useState(null)
  const [recordingHoursId, setRecordingHoursId] = useState(null)
  const [hoursInput, setHoursInput] = useState({}) // signupId -> value
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' })

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await getOpportunityAttendeesApi(opportunityId, token)
      setData({
        opportunity: res?.data?.opportunity || {},
        signups: res?.data?.signups || res?.data?.attendees || [],
      })
    } catch (err) {
      setError(err.message || 'Failed to load attendees.')
    } finally {
      setLoading(false)
    }
  }, [opportunityId, token])

  useEffect(() => {
    if (token && user?.role === 'COORDINATOR') {
      loadData()
    }
  }, [token, user, loadData])

  if (authLoading) {
    return (
      <main className="attendees-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading attendees...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />

  const showMessage = (type, text) => {
    setActionMessage({ type, text })
    setTimeout(() => setActionMessage({ type: '', text: '' }), 4000)
  }

  const handleUpdateSignupStatus = async (signupId, newStatus) => {
    if (updatingSignupId) return
    setUpdatingSignupId(signupId)
    try {
      await updateSignupStatusApi(signupId, newStatus, token)
      setData((prev) => ({
        ...prev,
        signups: prev.signups.map((s) => s.id === signupId ? { ...s, status: newStatus } : s),
      }))
      showMessage('success', 'Signup status updated to ' + newStatus + '.')
    } catch (err) {
      showMessage('error', err.message || 'Failed to update signup status.')
    } finally {
      setUpdatingSignupId(null)
    }
  }

  const handleRecordHours = async (signupId) => {
    const hrs = parseFloat(hoursInput[signupId])
    if (isNaN(hrs) || hrs < 0) {
      showMessage('error', 'Please enter a valid number of hours (0 or more).')
      return
    }
    setRecordingHoursId(signupId)
    try {
      await recordHoursApi(signupId, { hours: hrs, status: 'RECORDED' }, token)
      setHoursInput((prev) => ({ ...prev, [signupId]: '' }))
      showMessage('success', hrs + ' hours recorded successfully.')
    } catch (err) {
      showMessage('error', err.message || 'Failed to record hours.')
    } finally {
      setRecordingHoursId(null)
    }
  }

  const statusClass = { REGISTERED: 'badge-registered', CANCELLED: 'badge-cancelled' }

  if (loading) {
    return (
      <main className="attendees-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading attendees...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="attendees-page">
        <div className="attendees-container">
          <Link to="/manage-opportunities" className="back-btn">Back to Opportunities</Link>
          <div className="alert-error">{error}</div>
        </div>
      </main>
    )
  }

  const opportunity = data?.opportunity || {}
  const signups = data?.signups || []
  const activeSignups = signups.filter((s) => s.status !== 'CANCELLED')
  const cancelledSignups = signups.filter((s) => s.status === 'CANCELLED')

  return (
    <main className="attendees-page">
      <div className="attendees-container">
        <Link to="/manage-opportunities" className="back-btn">Back to Opportunities</Link>

        <header className="attendees-header">
          <div>
            <h1>{opportunity.title || 'Opportunity'}</h1>
            <p>
              Manage volunteer signups, update attendance status, and record volunteer hours.
            </p>
          </div>
          <Link to={'/opportunities/' + opportunityId} className="btn btn-outline btn-sm">
            View Details
          </Link>
        </header>

        {/* Stats Row */}
        <div className="attendees-stats-row">
          <div className="attendee-stat">
            <span className="attendee-stat-value">{signups.length}</span>
            <span className="attendee-stat-label">Total Signups</span>
          </div>
          <div className="attendee-stat">
            <span className="attendee-stat-value">{activeSignups.length}</span>
            <span className="attendee-stat-label">Active</span>
          </div>
          <div className="attendee-stat">
            <span className="attendee-stat-value">{cancelledSignups.length}</span>
            <span className="attendee-stat-label">Cancelled</span>
          </div>
        </div>

        {actionMessage.text && (
          <div className={actionMessage.type === 'success' ? 'alert-success' : 'alert-error'}>
            {actionMessage.text}
          </div>
        )}

        {signups.length === 0 ? (
          <div className="attendees-empty">
            <div className="empty-icon">👥</div>
            <h3>No Signups Yet</h3>
            <p>No volunteers have signed up for this opportunity. Share it to attract volunteers.</p>
          </div>
        ) : (
          <section className="attendees-table-section">
            <div className="attendees-table-header">
              <h2>Volunteer Signups</h2>
              <span className="hours-count">{signups.length} signup{signups.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="attendees-table-wrapper">
              <table className="attendees-table">
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Status</th>
                    <th>Signed Up</th>
                    <th>Update Status</th>
                    <th>Record Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map((signup) => (
                    <tr key={signup.id}>
                      <td>
                        <div className="volunteer-name">{signup.volunteer_name || signup.full_name || 'Volunteer'}</div>
                        <div className="volunteer-email">{signup.volunteer_email || signup.email || ''}</div>
                      </td>
                      <td>
                        <span className={'signup-badge ' + (statusClass[signup.status] || '')}>
                          {signup.status || 'REGISTERED'}
                        </span>
                      </td>
                      <td className="signup-date-cell">
                        {signup.created_at
                          ? new Date(signup.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </td>
                      <td>
                        <div className="status-actions">
                          {SIGNUP_STATUSES.filter((s) => s !== signup.status).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={'status-action-btn status-' + s.toLowerCase()}
                              onClick={() => handleUpdateSignupStatus(signup.id, s)}
                              disabled={!!updatingSignupId}
                            >
                              {updatingSignupId === signup.id ? '...' : s}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        {signup.status !== 'CANCELLED' ? (
                          <div className="record-hours-form">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="9999.99"
                              placeholder="hrs"
                              value={hoursInput[signup.id] || ''}
                              onChange={(e) => setHoursInput((prev) => ({ ...prev, [signup.id]: e.target.value }))}
                              className="hours-input"
                            />
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleRecordHours(signup.id)}
                              disabled={!!recordingHoursId || !hoursInput[signup.id]}
                            >
                              {recordingHoursId === signup.id ? '...' : 'Log'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-sm">N/A (cancelled)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default OpportunityAttendees
