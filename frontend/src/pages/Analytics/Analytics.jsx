import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getManagedOpportunitiesApi,
  getOrganizationHoursSummaryApi,
  getOrganizationOpportunitiesSummaryApi,
} from '../../services/api'
import { PageHeader, LoadingState, EmptyState, Alert } from '../../components/ui'
import { formatHours, isUpcoming } from '../../utils/format'
import './Analytics.css'

const STATUS_ORDER = [
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function BarList({ rows, valueLabel }) {
  const max = Math.max(...rows.map((r) => r.max ?? r.value), 1)
  return (
    <ul role="list" className="bar-list">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="bar-list-head">
            {row.to ? <Link to={row.to} className="bar-list-label">{row.label}</Link> : <span className="bar-list-label">{row.label}</span>}
            <span className="bar-list-value num">{valueLabel(row)}</span>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span className={`bar-fill${row.full ? ' is-full' : ''}`} style={{ width: `${(row.value / max) * 100}%` }} />
            {row.secondary != null && (
              <span className="bar-fill bar-fill-secondary" style={{ width: `${(row.secondary / max) * 100}%` }} />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Analytics() {
  const { token } = useAuth()
  const [opportunities, setOpportunities] = useState([])
  const [hours, setHours] = useState(null)
  const [hoursByOpp, setHoursByOpp] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [oppsRes, hoursRes, byOppRes] = await Promise.all([
        getManagedOpportunitiesApi(token),
        getOrganizationHoursSummaryApi(token),
        getOrganizationOpportunitiesSummaryApi(token),
      ])
      setOpportunities(oppsRes?.data?.opportunities || [])
      setHours(hoursRes?.data?.summary || null)
      setHoursByOpp(byOppRes?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Analytics could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const live = opportunities.filter((o) => o.status === 'PUBLISHED' || o.status === 'COMPLETED')
  const seatsTaken = live.reduce((sum, o) => sum + Number(o.active_signups || 0), 0)
  const seatsOffered = live.reduce((sum, o) => sum + Number(o.capacity || 0), 0)
  const totalHours = Number(hours?.total_hours || 0)
  const verifiedHours = Number(hours?.verified_hours || 0)

  const fillRows = opportunities
    .filter((o) => o.status === 'PUBLISHED' && isUpcoming(o.event_date))
    .map((o) => ({
      key: o.id,
      label: o.title,
      to: `/opportunities/${o.id}/attendees`,
      value: percent(Number(o.active_signups), Number(o.capacity)),
      max: 100,
      full: Number(o.active_signups) >= Number(o.capacity),
      taken: o.active_signups,
      capacity: o.capacity,
    }))
    .sort((a, b) => a.value - b.value)

  const statusCounts = STATUS_ORDER.map((s) => ({ ...s, count: opportunities.filter((o) => o.status === s.key).length }))

  const categoryRows = Object.entries(
    opportunities.reduce((acc, o) => {
      const key = o.category || 'Uncategorized'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {}),
  )
    .map(([label, value]) => ({ key: label, label, value }))
    .sort((a, b) => b.value - a.value)

  const hoursRows = hoursByOpp
    .filter((o) => Number(o.total_hours) > 0)
    .sort((a, b) => Number(b.total_hours) - Number(a.total_hours))
    .slice(0, 8)
    .map((o) => ({
      key: o.opportunity_id,
      label: o.opportunity_title,
      value: Number(o.total_hours),
      secondary: Number(o.verified_hours),
      verified: Number(o.verified_hours),
    }))

  return (
    <div className="page">
      <PageHeader title="Analytics" description="How your opportunities are filling up and where volunteer hours are going. All figures cover every organization you manage." />

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading analytics…" />
      ) : opportunities.length === 0 ? (
        <div className="panel">
          <EmptyState icon="chart" title="Nothing to analyse yet" action={<Link to="/opportunities/create" className="btn btn-primary">Create an opportunity</Link>}>
            Analytics are calculated from your opportunities, registrations and logged hours.
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="figures" aria-label="Key figures">
            <div className="figure">
              <span className="figure-value">{opportunities.length}</span>
              <span className="figure-label">Opportunities created</span>
            </div>
            <div className="figure">
              <span className="figure-value">{percent(seatsTaken, seatsOffered)}%</span>
              <span className="figure-label">Spots filled</span>
              <span className="figure-note">{seatsTaken} of {seatsOffered}, published and completed</span>
            </div>
            <div className="figure">
              <span className="figure-value">{formatHours(totalHours)}</span>
              <span className="figure-label">Hours logged</span>
            </div>
            <div className="figure">
              <span className="figure-value">{percent(verifiedHours, totalHours)}%</span>
              <span className="figure-label">Hours verified</span>
              <span className="figure-note">{formatHours(verifiedHours)} of {formatHours(totalHours)}</span>
            </div>
          </section>

          <div className="analytics-grid">
            <section className="panel analytics-wide" aria-labelledby="fill-title">
              <div className="panel-header">
                <h2 id="fill-title">Fill rate of upcoming published events</h2>
                <span className="muted">Least filled first</span>
              </div>
              <div className="panel-body">
                {fillRows.length === 0 ? (
                  <p className="muted">No upcoming published events.</p>
                ) : (
                  <BarList rows={fillRows} valueLabel={(r) => `${r.taken} / ${r.capacity} · ${r.value}%`} />
                )}
              </div>
            </section>

            <section className="panel" aria-labelledby="status-title">
              <div className="panel-header"><h2 id="status-title">Opportunities by status</h2></div>
              <div className="panel-body">
                <div className="stack-bar" role="img" aria-label={statusCounts.map((s) => `${s.label}: ${s.count}`).join(', ')}>
                  {statusCounts.filter((s) => s.count > 0).map((s) => (
                    <span key={s.key} className={`stack-seg stack-${s.key.toLowerCase()}`} style={{ flexGrow: s.count }} />
                  ))}
                </div>
                <dl className="stack-legend">
                  {statusCounts.map((s) => (
                    <div key={s.key}>
                      <dt><span className={`legend-swatch stack-${s.key.toLowerCase()}`} aria-hidden="true" />{s.label}</dt>
                      <dd className="num">{s.count}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section className="panel" aria-labelledby="category-title">
              <div className="panel-header"><h2 id="category-title">Opportunities by category</h2></div>
              <div className="panel-body">
                <BarList rows={categoryRows} valueLabel={(r) => r.value} />
              </div>
            </section>

            <section className="panel analytics-wide" aria-labelledby="hours-title">
              <div className="panel-header">
                <h2 id="hours-title">Hours logged by opportunity</h2>
                <span className="analytics-key">
                  <span><span className="legend-swatch bar-key-verified" aria-hidden="true" />Verified</span>
                  <span><span className="legend-swatch bar-key-logged" aria-hidden="true" />Not yet verified</span>
                </span>
              </div>
              <div className="panel-body">
                {hoursRows.length === 0 ? (
                  <p className="muted">No hours have been logged yet.</p>
                ) : (
                  <BarList rows={hoursRows} valueLabel={(r) => `${formatHours(r.value)} h · ${formatHours(r.verified)} verified`} />
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

export default Analytics
