import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyHoursApi, getMyHoursSummaryApi } from '../../services/api'
import './VolunteerHours.css'

function SimpleBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="hours-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="hours-bar-col">
          <div className="hours-bar-fill" style={{ height: `${Math.max((d.value / max) * 80, 2)}px` }} />
          <span className="hours-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function VolunteerHours() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const [hours, setHours] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filterApplied, setFilterApplied] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

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
    if (token && user?.role === 'VOLUNTEER') loadData()
  }, [token, user, loadData])

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
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

  const formatDate = (d) => {
    if (!d) return ''
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
    catch { return d }
  }

  const totalHours = Number(summary?.total_hours || 0)
  const events = summary?.total_records || hours.length
  const orgs = new Set(hours.map(h => h.organization_name).filter(Boolean)).size || 5
  const verifiedCount = hours.filter(h => h.status === 'VERIFIED').length
  const pendingCount = hours.filter(h => h.status === 'PENDING').length

  const CHART_MONTHS = [
    { label: 'Apr', value: 4 },
    { label: 'May', value: 6 },
    { label: 'Jun', value: 5 },
    { label: 'Jul', value: 3.5 },
    { label: 'Aug', value: 11 },
    { label: 'Sep', value: 4 },
  ]

  const statusClass = { PENDING: 'badge-pending', RECORDED: 'badge-recorded', VERIFIED: 'badge-verified' }

  const filteredHours = statusFilter === 'all' ? hours
    : hours.filter(h => h.status === statusFilter.toUpperCase())

  return (
    <div className="vh-page">
      <div className="vh-topbar">
        <div>
          <h1>My Volunteer Hours</h1>
          <p>Your complete volunteering history and verified hours.</p>
        </div>
        <button type="button" className="vh-export-btn">&#8595; Export Report</button>
      </div>

      <div className="vh-summary-cards">
        <div className="vh-sum-card green">
          <span className="vh-sum-icon">⏱</span>
          <div className="vh-sum-value">{totalHours.toFixed(1)}<span className="vh-sum-unit">hrs</span></div>
          <div className="vh-sum-label">Total Hours</div>
        </div>
        <div className="vh-sum-card blue">
          <span className="vh-sum-icon">📅</span>
          <div className="vh-sum-value">{events}</div>
          <div className="vh-sum-label">Events</div>
        </div>
        <div className="vh-sum-card purple">
          <span className="vh-sum-icon">🏢</span>
          <div className="vh-sum-value">{orgs}</div>
          <div className="vh-sum-label">Organizations</div>
        </div>
        <div className="vh-sum-card orange">
          <span className="vh-sum-icon">🔥</span>
          <div className="vh-sum-value">4<span className="vh-sum-unit"> weeks</span></div>
          <div className="vh-sum-label">Current Streak</div>
        </div>
      </div>

      <div className="vh-chart-card">
        <div className="vh-chart-header">
          <h2>Hours by Month</h2>
          <span className="vh-chart-range">Apr – Sep 2024</span>
        </div>
        <SimpleBarChart data={CHART_MONTHS} />
      </div>

      <div className="vh-table-card">
        <div className="vh-table-header">
          <h2>Hour History</h2>
          <div className="vh-status-filters">
            {['all', 'verified', 'pending'].map((s) => (
              <button
                key={s}
                type="button"
                className={`vh-filter-btn${statusFilter === s ? ' active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="vh-date-filter">
          <form onSubmit={handleFilter} className="vh-date-form">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate || undefined} />
            <span>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || undefined} />
            <button type="submit" className="vh-apply-btn">Apply</button>
            {filterApplied && <button type="button" className="vh-clear-btn" onClick={handleClearFilter}>Clear</button>}
          </form>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : filteredHours.length === 0 ? (
          <div className="vh-empty">
            <p>No hours recorded yet.</p>
            <Link to="/opportunities" className="vh-browse-btn">Browse Opportunities</Link>
          </div>
        ) : (
          <div className="vh-table-wrapper">
            <table className="vh-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opportunity</th>
                  <th>Organization</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHours.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.opportunity_event_date || record.created_at)}</td>
                    <td>
                      <Link to={`/opportunities/${record.opportunity_id || '#'}`} className="vh-opp-link">
                        {record.opportunity_title || 'Opportunity'}
                      </Link>
                    </td>
                    <td>{record.organization_name || '—'}</td>
                    <td className="vh-hours-val">{Number(record.hours || 0).toFixed(1)}</td>
                    <td>
                      <span className={`vh-badge ${statusClass[record.status] || 'badge-recorded'}`}>
                        {record.status === 'VERIFIED' ? '✓ VERIFIED' : record.status === 'PENDING' ? '⚡ PENDING' : record.status || 'RECORDED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default VolunteerHours
