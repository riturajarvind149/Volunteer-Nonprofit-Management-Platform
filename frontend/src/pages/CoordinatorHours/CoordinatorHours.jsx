import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getOrganizationHoursApi,
  getOrganizationHoursSummaryApi,
  getOrganizationOpportunitiesSummaryApi,
  updateHoursStatusApi,
} from '../../services/api'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge } from '../../components/ui'
import { formatDate, formatHours, pluralize } from '../../utils/format'
import './CoordinatorHours.css'

const QUEUE_FILTERS = [
  { key: 'review', label: 'Needs review', match: (r) => r.status !== 'VERIFIED' },
  { key: 'verified', label: 'Verified', match: (r) => r.status === 'VERIFIED' },
  { key: 'all', label: 'All entries', match: () => true },
]

function CoordinatorHours() {
  const { token } = useAuth()
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [byOpportunity, setByOpportunity] = useState([])
  const [view, setView] = useState('entries')
  const [filter, setFilter] = useState('review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [hoursRes, summaryRes, oppsRes] = await Promise.all([
        getOrganizationHoursApi(token),
        getOrganizationHoursSummaryApi(token),
        getOrganizationOpportunitiesSummaryApi(token),
      ])
      setRecords(hoursRes?.data?.volunteer_hours || [])
      setSummary(summaryRes?.data?.summary || null)
      setByOpportunity(oppsRes?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Hours could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const updateStatus = async (record, status) => {
    setUpdatingId(record.id)
    setNotice(null)
    try {
      await updateHoursStatusApi(record.id, status, token)
      setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status } : r)))
      setNotice({ tone: 'success', text: `${formatHours(record.hours)} hours for ${record.volunteer_name} marked as ${status.toLowerCase()}.` })
      const [summaryRes, oppsRes] = await Promise.all([
        getOrganizationHoursSummaryApi(token),
        getOrganizationOpportunitiesSummaryApi(token),
      ])
      setSummary(summaryRes?.data?.summary || null)
      setByOpportunity(oppsRes?.data?.opportunities || [])
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'The status could not be updated.' })
    } finally {
      setUpdatingId(null)
    }
  }

  const activeFilter = QUEUE_FILTERS.find((f) => f.key === filter)
  const visible = records.filter(activeFilter.match)
  const awaiting = Number(summary?.pending_hours || 0) + Number(summary?.recorded_hours || 0)
  const withHours = byOpportunity.filter((o) => Number(o.total_hours) > 0)

  return (
    <div className="page">
      <PageHeader
        title="Hours & attendance"
        description="Hours you log on a roster land here. Verify them so they count toward each volunteer’s total."
        actions={<Link to="/volunteers" className="btn btn-secondary">Go to rosters</Link>}
      />

      <section className="figures" aria-label="Hours summary">
        <div className="figure">
          <span className="figure-value">{formatHours(awaiting)}</span>
          <span className="figure-label">Awaiting verification</span>
        </div>
        <div className="figure">
          <span className="figure-value">{formatHours(summary?.verified_hours)}</span>
          <span className="figure-label">Verified</span>
        </div>
        <div className="figure">
          <span className="figure-value">{formatHours(summary?.total_hours)}</span>
          <span className="figure-label">Total logged</span>
          <span className="figure-note">{pluralize(summary?.total_records ?? 0, 'entry', 'entries')}</span>
        </div>
        <div className="figure">
          <span className="figure-value">{summary?.total_volunteers ?? 0}</span>
          <span className="figure-label">Volunteers with hours</span>
        </div>
      </section>

      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
      {error && <Alert onRetry={load}>{error}</Alert>}

      <section className="panel">
        <div className="panel-header">
          <div className="segmented" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'entries'} onClick={() => setView('entries')}>Entries</button>
            <button type="button" aria-pressed={view === 'opportunities'} onClick={() => setView('opportunities')}>By opportunity</button>
          </div>
          {view === 'entries' && (
            <div className="segmented" role="group" aria-label="Filter entries">
              {QUEUE_FILTERS.map((f) => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label}<span className="count">{records.filter(f.match).length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <LoadingState label="Loading hours…" />
        ) : view === 'entries' ? (
          visible.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title={records.length === 0 ? 'No hours logged yet' : filter === 'review' ? 'Nothing left to review' : 'No entries here'}
              action={records.length === 0 && <Link to="/volunteers" className="btn btn-secondary">Open a roster</Link>}
            >
              {records.length === 0 ? 'Log hours for attendees from an event’s roster.' : filter === 'review' ? 'Every logged hour has been verified.' : 'Try another filter.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table table-stack">
                <thead>
                  <tr>
                    <th>Volunteer</th>
                    <th>Opportunity</th>
                    <th>Logged on</th>
                    <th className="cell-num">Hours</th>
                    <th>Status</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const busy = updatingId === r.id
                    return (
                      <tr key={r.id}>
                        <td data-label="Volunteer" className="cell-lead">
                          <span className="cell-primary">{r.volunteer_name}</span>
                          <span className="cell-sub">{r.volunteer_email}</span>
                        </td>
                        <td data-label="Opportunity">
                          <Link to={`/opportunities/${r.opportunity_id}/attendees`}>{r.opportunity_title}</Link>
                        </td>
                        <td data-label="Logged on" className="num">{formatDate(r.created_at)}</td>
                        <td data-label="Hours" className="cell-num">{formatHours(r.hours)}</td>
                        <td data-label="Status"><StatusBadge status={r.status} /></td>
                        <td data-label="">
                          <div className="hours-actions">
                            {r.status !== 'VERIFIED' ? (
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => updateStatus(r, 'VERIFIED')} disabled={busy}>
                                {busy ? 'Saving…' : 'Verify'}
                              </button>
                            ) : (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r, 'RECORDED')} disabled={busy}>
                                {busy ? 'Saving…' : 'Undo verification'}
                              </button>
                            )}
                            {r.status === 'RECORDED' && (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r, 'PENDING')} disabled={busy}>
                                Mark pending
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : withHours.length === 0 ? (
          <EmptyState icon="chart" title="No hours logged against any opportunity yet" />
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th className="cell-num">Volunteers</th>
                  <th className="cell-num">Logged</th>
                  <th className="cell-num">Verified</th>
                  <th className="cell-num">Awaiting</th>
                </tr>
              </thead>
              <tbody>
                {withHours.map((o) => (
                  <tr key={o.opportunity_id}>
                    <td data-label="Opportunity" className="cell-lead">
                      <Link to={`/opportunities/${o.opportunity_id}/attendees`}>{o.opportunity_title}</Link>
                      <span className="cell-sub">{o.organization_name}</span>
                    </td>
                    <td data-label="Volunteers" className="cell-num">{o.total_volunteers}</td>
                    <td data-label="Logged" className="cell-num">{formatHours(o.total_hours)}</td>
                    <td data-label="Verified" className="cell-num">{formatHours(o.verified_hours)}</td>
                    <td data-label="Awaiting" className="cell-num">{formatHours(Number(o.recorded_hours || 0) + Number(o.pending_hours || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default CoordinatorHours
