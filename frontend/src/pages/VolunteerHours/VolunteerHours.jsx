import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyHoursApi, getMyHoursSummaryApi } from '../../services/api'
import './VolunteerHours.css'

function VolunteerHours() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()

  const [hours, setHours] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filterApplied, setFilterApplied] = useState(false)

  const loadData = useCallback(async (params = {}) => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [hoursRes, summaryRes] = await Promise.all([
        getMyHoursApi(token, params),
        getMyHoursSummaryApi(token),
      ])
      setHours(hoursRes?.data?.volunteer_hours || hoursRes?.data?.hours || [])
      setSummary(summaryRes?.data?.summary || summaryRes?.data || null)
    } catch (err) {
      setError(err.message || 'Failed to load volunteer hours.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token && user?.role === 'VOLUNTEER') {
      loadData()
    }
  }, [token, user, loadData])

  if (authLoading) {
    return (
      <main className="hours-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your hours...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'VOLUNTEER') return <Navigate to="/dashboard" replace />

  const handleFilter = (e) => {
    e.preventDefault()
    setFilterApplied(true)
    loadData({ from_date: fromDate || undefined, to_date: toDate || undefined })
  }

  const handleClearFilter = () => {
    setFromDate('')
    setToDate('')
    setFilterApplied(false)
    loadData()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  const statusClass = { PENDING: 'badge-pending', RECORDED: 'badge-recorded', VERIFIED: 'badge-verified' }

  const totalHours = summary?.total_hours ?? 0
  const verifiedHours = summary?.verified_hours ?? 0
  const pendingHours = summary?.pending_hours ?? 0
  const recordedCount = summary?.total_records ?? hours.length

  return (
    <main className="hours-page">
      <div className="hours-container">
        <header className="hours-header">
          <div>
            <h1>My Volunteer Hours</h1>
            <p>Track your volunteer hours and see your total contribution.</p>
          </div>
          <Link to="/my-signups" className="btn btn-secondary">View My Signups</Link>
        </header>

        {/* Summary Cards */}
        <section className="hours-summary-grid">
          <div className="hours-stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{Number(totalHours).toFixed(1)}</div>
            <div className="stat-label">Total Hours</div>
          </div>
          <div className="hours-stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{Number(verifiedHours).toFixed(1)}</div>
            <div className="stat-label">Verified Hours</div>
          </div>
          <div className="hours-stat-card">
            <div className="stat-icon">🕐</div>
            <div className="stat-value">{Number(pendingHours).toFixed(1)}</div>
            <div className="stat-label">Pending / Recorded</div>
          </div>
          <div className="hours-stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-value">{recordedCount}</div>
            <div className="stat-label">Hour Records</div>
          </div>
        </section>

        {/* Date Filter */}
        <section className="hours-filter-section">
          <form className="hours-filter-form" onSubmit={handleFilter}>
            <div className="filter-group">
              <label htmlFor="fromDate">From Date</label>
              <input
                type="date"
                id="fromDate"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate || undefined}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="toDate">To Date</label>
              <input
                type="date"
                id="toDate"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate || undefined}
              />
            </div>
            <div className="filter-actions">
              <button type="submit" className="btn btn-primary btn-sm">Apply Filter</button>
              {filterApplied && (
                <button type="button" className="btn btn-outline btn-sm" onClick={handleClearFilter}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </section>

        {error && (
          <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => loadData()}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading hours...</p>
          </div>
        ) : hours.length === 0 ? (
          <div className="hours-empty">
            <div className="empty-icon">⏱️</div>
            <h3>No Hours Recorded Yet</h3>
            <p>
              {filterApplied
                ? 'No volunteer hours found for the selected date range.'
                : 'You have no volunteer hours recorded. Attend events and coordinators will log your hours.'}
            </p>
            {filterApplied ? (
              <button type="button" className="btn btn-secondary" onClick={handleClearFilter}>Clear Filter</button>
            ) : (
              <Link to="/opportunities" className="btn btn-primary">Browse Opportunities</Link>
            )}
          </div>
        ) : (
          <section className="hours-table-section">
            <div className="hours-table-header">
              <h2>Hours Log</h2>
              <span className="hours-count">{hours.length} record{hours.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="hours-table-wrapper">
              <table className="hours-table">
                <thead>
                  <tr>
                    <th>Opportunity</th>
                    <th>Organization</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map((record) => (
                    <tr key={record.id}>
                      <td className="opp-cell">
                        <Link to={'/opportunities/' + (record.opportunity_id || '#')}>
                          {record.opportunity_title || 'Opportunity'}
                        </Link>
                        {record.opportunity_event_date && (
                          <span className="opp-date-sub">{formatDate(record.opportunity_event_date)}</span>
                        )}
                      </td>
                      <td>{record.organization_name || '—'}</td>
                      <td className="hours-cell">{Number(record.hours || 0).toFixed(1)}</td>
                      <td>
                        <span className={'hours-badge ' + (statusClass[record.status] || '')}>
                          {record.status || 'RECORDED'}
                        </span>
                      </td>
                      <td>{formatDate(record.created_at)}</td>
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

export default VolunteerHours
