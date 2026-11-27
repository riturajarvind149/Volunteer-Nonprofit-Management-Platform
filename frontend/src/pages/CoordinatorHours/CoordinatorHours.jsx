import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getOrganizationHoursApi,
  getOrganizationHoursSummaryApi,
  getOrganizationOpportunitiesSummaryApi,
  updateHoursStatusApi,
} from '../../services/api'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge } from '../../components/ui'
import Pagination from '../../components/Pagination'
import { formatDate, formatHours, pluralize } from '../../utils/format'
import { useAutoLoad } from '../../hooks/useAutoLoad'
import './CoordinatorHours.css'

// Each tab is one server-side query, so long histories load a page at a time.
const QUEUE_FILTERS = [
  { key: 'review', label: 'Needs review', status: 'PENDING,RECORDED' },
  { key: 'verified', label: 'Verified', status: 'VERIFIED' },
  { key: 'rejected', label: 'Not approved', status: 'REJECTED' },
  { key: 'all', label: 'All entries', status: '' },
]

const PAGE_SIZE = 25

const STATUS_WORDS = { VERIFIED: 'verified', REJECTED: 'not approved', RECORDED: 'recorded', PENDING: 'pending' }

function CoordinatorHours() {
  const { token } = useAuth()
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState({})
  const [summary, setSummary] = useState(null)
  const [byOpportunity, setByOpportunity] = useState([])
  const [view, setView] = useState('entries')
  const [filter, setFilter] = useState('review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [notice, setNotice] = useState(null)

  const activeFilter = QUEUE_FILTERS.find((f) => f.key === filter)

  const load = useCallback(async () => {
    setError('')
    try {
      const [hoursRes, summaryRes, oppsRes, ...countRes] = await Promise.all([
        getOrganizationHoursApi(token, { status: activeFilter.status, page, limit: PAGE_SIZE }),
        getOrganizationHoursSummaryApi(token),
        getOrganizationOpportunitiesSummaryApi(token),
        // Tab counts: one tiny request per tab, reading only its total.
        ...QUEUE_FILTERS.map((f) => getOrganizationHoursApi(token, { status: f.status, page: 1, limit: 1 })),
      ])
      const nextPagination = hoursRes?.data?.pagination || null
      // The last entry of the last page moved to another tab: show the page before it.
      if (page > 1 && nextPagination && page > nextPagination.total_pages) {
        setPage(nextPagination.total_pages)
        return
      }
      setRecords(hoursRes?.data?.volunteer_hours || [])
      setPagination(nextPagination)
      setCounts(Object.fromEntries(QUEUE_FILTERS.map((f, i) => [f.key, countRes[i]?.data?.pagination?.total ?? 0])))
      setSummary(summaryRes?.data?.summary || null)
      setByOpportunity(oppsRes?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Hours could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, activeFilter, page])

  useAutoLoad(load)

  const changeFilter = (key) => {
    setFilter(key)
    setPage(1)
    setRejectingId(null)
  }

  const updateStatus = async (record, status) => {
    setUpdatingId(record.id)
    setNotice(null)
    try {
      await updateHoursStatusApi(record.id, status, token)
      setRejectingId(null)
      setNotice({
        tone: 'success',
        text: `${formatHours(record.hours)} hours for ${record.volunteer_name} marked as ${STATUS_WORDS[status] || status.toLowerCase()}.`
          + (status === 'VERIFIED' || status === 'REJECTED' ? ' The volunteer has been notified.' : ''),
      })
      // Refresh the page, tab counts and totals: the entry may have moved to another tab.
      await load()
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'The status could not be updated.' })
    } finally {
      setUpdatingId(null)
    }
  }

  const visible = records
  const noHoursYet = !counts.all
  const awaiting = Number(summary?.pending_hours || 0) + Number(summary?.recorded_hours || 0)
  const withHours = byOpportunity.filter((o) => Number(o.total_hours) > 0)

  return (
    <div className="page">
      <PageHeader
        title="Hours & attendance"
        description="Hours you log on a roster and hours volunteers submit themselves land here. Verify them so they count toward each volunteer’s total and certificate."
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
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => changeFilter(f.key)}>
                  {f.label}<span className="count">{counts[f.key] ?? 0}</span>
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
              title={noHoursYet ? 'No hours logged yet' : filter === 'review' ? 'Nothing left to review' : 'No entries here'}
              action={noHoursYet && <Link to="/volunteers" className="btn btn-secondary">Open a roster</Link>}
            >
              {noHoursYet ? 'Log hours for attendees from an event’s roster.' : filter === 'review' ? 'Every logged hour has been verified.' : 'Try another filter.'}
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
                        <td data-label="Opportunity" className="cell-lead">
                          <Link to={`/opportunities/${r.opportunity_id}/attendees`}>{r.opportunity_title}</Link>
                          {r.self_reported && <span className="cell-sub">Submitted by volunteer</span>}
                          {r.notes && <span className="cell-sub hours-note">“{r.notes}”</span>}
                        </td>
                        <td data-label="Logged on" className="num">{formatDate(r.created_at)}</td>
                        <td data-label="Hours" className="cell-num">{formatHours(r.hours)}</td>
                        <td data-label="Status"><StatusBadge status={r.status} /></td>
                        <td data-label="">
                          {rejectingId === r.id ? (
                            <div className="hours-actions" role="group" aria-label="Confirm rejection">
                              <span className="hours-confirm-text">Reject these hours? The volunteer can submit them again.</span>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => updateStatus(r, 'REJECTED')} disabled={busy}>
                                {busy ? 'Saving…' : 'Yes, reject'}
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejectingId(null)} disabled={busy}>Keep</button>
                            </div>
                          ) : (
                            <div className="hours-actions">
                              {r.status === 'VERIFIED' ? (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r, 'RECORDED')} disabled={busy}>
                                  {busy ? 'Saving…' : 'Undo verification'}
                                </button>
                              ) : r.status === 'REJECTED' ? (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateStatus(r, 'PENDING')} disabled={busy}>
                                  {busy ? 'Saving…' : 'Reopen'}
                                </button>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => updateStatus(r, 'VERIFIED')} disabled={busy}>
                                    {busy ? 'Saving…' : 'Verify'}
                                  </button>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNotice(null); setRejectingId(r.id) }} disabled={busy}>
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Pagination pagination={pagination} onPage={setPage} disabled={Boolean(updatingId)} noun="entries" />
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
