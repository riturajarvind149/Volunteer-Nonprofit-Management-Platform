import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getOrganizationHoursApi,
  getOrganizationHoursSummaryApi,
  updateHoursStatusApi,
} from '../../services/api'
import './CoordinatorHours.css'

const HOUR_STATUSES = ['PENDING', 'RECORDED', 'VERIFIED']

function CoordinatorHours() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()

  const [hours, setHours] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [updateError, setUpdateError] = useState('')
  const [updateSuccess, setUpdateSuccess] = useState('')

  const loadData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [hoursRes, summaryRes] = await Promise.all([
        getOrganizationHoursApi(token),
        getOrganizationHoursSummaryApi(token),
      ])
      setHours(hoursRes?.data?.volunteer_hours || hoursRes?.data?.hours || [])
      setSummary(summaryRes?.data?.summary || summaryRes?.data || null)
    } catch (err) {
      setError(err.message || 'Failed to load organization hours.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token && user?.role === 'COORDINATOR') {
      loadData()
    }
  }, [token, user, loadData])

  if (authLoading) {
    return (
      <main className="coord-hours-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading hours data...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />

  const handleUpdateStatus = async (id, newStatus) => {
    if (updatingId) return
    setUpdatingId(id)
    setUpdateError('')
    setUpdateSuccess('')
    try {
      await updateHoursStatusApi(id, newStatus, token)
      setHours((prev) => prev.map((h) => h.id === id ? { ...h, status: newStatus } : h))
      setUpdateSuccess('Hours status updated to ' + newStatus + '.')
      setTimeout(() => setUpdateSuccess(''), 3000)
    } catch (err) {
      setUpdateError(err.message || 'Failed to update status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  const statusClass = { PENDING: 'badge-pending', RECORDED: 'badge-recorded', VERIFIED: 'badge-verified' }
  const totalHours = summary?.total_hours ?? 0
  const verifiedHours = summary?.verified_hours ?? 0
  const totalVolunteers = summary?.total_volunteers ?? 0
  const totalRecords = summary?.total_records ?? hours.length

  return (
    <main className="coord-hours-page">
      <div className="coord-hours-container">
        <header className="coord-hours-header">
          <div>
            <h1>Volunteer Hours Management</h1>
            <p>Review, verify, and manage volunteer hours for your organization's opportunities.</p>
          </div>
          <Link to="/manage-opportunities" className="btn btn-secondary">Manage Opportunities</Link>
        </header>

        {/* Summary */}
        <section className="hours-summary-grid">
          <div className="hours-stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{Number(totalHours).toFixed(1)}</div>
            <div className="stat-label">Total Hours Logged</div>
          </div>
          <div className="hours-stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{Number(verifiedHours).toFixed(1)}</div>
            <div className="stat-label">Verified Hours</div>
          </div>
          <div className="hours-stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{totalVolunteers}</div>
            <div className="stat-label">Volunteers</div>
          </div>
          <div className="hours-stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{totalRecords}</div>
            <div className="stat-label">Hour Records</div>
          </div>
        </section>

        {updateSuccess && <div className="alert-success">{updateSuccess}</div>}
        {updateError && <div className="alert-error">{updateError}</div>}

        {error && (
          <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={loadData}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading organization hours...</p>
          </div>
        ) : hours.length === 0 ? (
          <div className="hours-empty">
            <div className="empty-icon">⏱️</div>
            <h3>No Hours Recorded Yet</h3>
            <p>No volunteer hours have been logged for your organization's opportunities. Record hours for signups from the attendees view.</p>
            <Link to="/manage-opportunities" className="btn btn-primary">Go to Opportunities</Link>
          </div>
        ) : (
          <section className="coord-hours-table-section">
            <div className="hours-table-header">
              <h2>Hours Log</h2>
              <span className="hours-count">{hours.length} record{hours.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="hours-table-wrapper">
              <table className="hours-table">
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Opportunity</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Recorded On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="volunteer-name">{record.volunteer_name || record.volunteer_full_name || 'Volunteer'}</div>
                        <div className="volunteer-email">{record.volunteer_email || ''}</div>
                      </td>
                      <td>
                        <Link to={'/opportunities/' + (record.opportunity_id || '#')} className="opp-link">
                          {record.opportunity_title || 'Opportunity'}
                        </Link>
                        {record.opportunity_event_date && (
                          <span className="opp-date-sub">{formatDate(record.opportunity_event_date)}</span>
                        )}
                      </td>
                      <td className="hours-cell">{Number(record.hours || 0).toFixed(1)}</td>
                      <td>
                        <span className={'hours-badge ' + (statusClass[record.status] || '')}>
                          {record.status || 'RECORDED'}
                        </span>
                      </td>
                      <td>{formatDate(record.created_at)}</td>
                      <td>
                        <div className="status-actions">
                          {HOUR_STATUSES.filter((s) => s !== record.status).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={'status-action-btn status-' + s.toLowerCase()}
                              onClick={() => handleUpdateStatus(record.id, s)}
                              disabled={!!updatingId}
                              title={'Set to ' + s}
                            >
                              {updatingId === record.id ? '...' : s}
                            </button>
                          ))}
                        </div>
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

export default CoordinatorHours
