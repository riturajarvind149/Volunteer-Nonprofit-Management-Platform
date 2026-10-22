import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyHoursApi, getMyHoursSummaryApi } from '../../services/api'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge } from '../../components/ui'
import DateRangeForm from '../../components/DateRangeForm'
import { formatDate, formatHours, pluralize } from '../../utils/format'

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'RECORDED', label: 'Recorded' },
  { key: 'VERIFIED', label: 'Verified' },
]

function VolunteerHours() {
  const { token } = useAuth()
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [range, setRange] = useState({ from_date: '', to_date: '' })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [hoursRes, summaryRes] = await Promise.all([getMyHoursApi(token, range), getMyHoursSummaryApi(token)])
      setRecords(hoursRes?.data?.volunteer_hours || [])
      setSummary(summaryRes?.data?.summary || null)
    } catch (err) {
      setError(err.message || 'Your hours could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, range])

  useEffect(() => { load() }, [load])

  const visible = status ? records.filter((r) => r.status === status) : records
  const visibleTotal = visible.reduce((sum, r) => sum + Number(r.hours || 0), 0)
  const hasRange = Boolean(range.from_date || range.to_date)

  return (
    <div className="page">
      <PageHeader
        title="My hours"
        description="Hours are logged by the coordinator of each opportunity. They count toward your total once verified."
      />

      <section className="figures" aria-label="Hours summary">
        <div className="figure">
          <span className="figure-value">{formatHours(summary?.verified_hours)}</span>
          <span className="figure-label">Verified</span>
          <span className="figure-note">Counted in your total</span>
        </div>
        <div className="figure">
          <span className="figure-value">{formatHours(summary?.recorded_hours)}</span>
          <span className="figure-label">Recorded</span>
          <span className="figure-note">Logged, awaiting verification</span>
        </div>
        <div className="figure">
          <span className="figure-value">{formatHours(summary?.pending_hours)}</span>
          <span className="figure-label">Pending</span>
          <span className="figure-note">Under review</span>
        </div>
        <div className="figure">
          <span className="figure-value">{formatHours(summary?.total_hours)}</span>
          <span className="figure-label">All logged hours</span>
          <span className="figure-note">{pluralize(summary?.total_records ?? 0, 'entry', 'entries')}</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="history-title">
        <div className="panel-header">
          <h2 id="history-title">Hour history</h2>
          <div className="segmented" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key || 'all'} type="button" aria-pressed={status === f.key} onClick={() => setStatus(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-filters">
          <DateRangeForm label="Logged between" value={range} onApply={setRange} disabled={loading} />
        </div>

        {error && <div className="panel-body"><Alert onRetry={load}>{error}</Alert></div>}

        {loading ? (
          <LoadingState label="Loading hours…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="clock"
            title={records.length === 0 && !hasRange ? 'No hours logged yet' : 'No entries match these filters'}
            action={records.length === 0 && !hasRange && <Link to="/my-signups" className="btn btn-secondary">View my registrations</Link>}
          >
            {records.length === 0 && !hasRange
              ? 'After you volunteer, the coordinator records your hours and they appear here.'
              : 'Try a different status or date range.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Logged on</th>
                  <th>Status</th>
                  <th className="cell-num">Hours</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Opportunity" className="cell-lead">
                      <Link to={`/opportunities/${r.opportunity_id}`}>{r.opportunity_title}</Link>
                      <span className="cell-sub">{r.organization_name}</span>
                    </td>
                    <td data-label="Logged on" className="num">{formatDate(r.created_at)}</td>
                    <td data-label="Status"><StatusBadge status={r.status} /></td>
                    <td data-label="Hours" className="cell-num">{formatHours(r.hours)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td data-label="" colSpan={3}>Total shown</td>
                  <td data-label="" className="cell-num">{formatHours(visibleTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default VolunteerHours
