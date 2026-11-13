import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getAdminStatsApi, getAdminOrganizationsApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, Alert, EmptyState, OrgInitials } from '../../components/ui'
import { formatDate, formatHours } from '../../utils/format'
import './Admin.css'

const FIGURES = [
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'coordinators', label: 'Coordinators' },
  { key: 'new_users_30d', label: 'New accounts', note: 'Last 30 days' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'open_opportunities', label: 'Open opportunities', note: 'Published, upcoming' },
  { key: 'active_signups', label: 'Active registrations' },
  { key: 'verified_hours', label: 'Verified hours', hours: true },
]

function AdminOverview() {
  const { token } = useAuth()
  const [stats, setStats] = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [statsRes, pendingRes] = await Promise.all([
        getAdminStatsApi(token),
        getAdminOrganizationsApi(token, { status: 'PENDING', limit: 5 }),
      ])
      setStats(statsRes?.data?.stats || null)
      setPending(pendingRes?.data?.organizations || [])
    } catch (err) {
      setError(err.message || 'The overview could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState label="Loading platform overview…" />

  const pendingCount = Number(stats?.pending_organizations || 0)

  return (
    <div className="page">
      <PageHeader title="Platform overview" description="Health of ServeHub at a glance, and anything waiting on an administrator." />

      {error && <Alert onRetry={load}>{error}</Alert>}

      {stats && (
        <section className="figures admin-figures" aria-label="Platform statistics">
          {FIGURES.map((f) => (
            <div key={f.key} className="figure">
              <span className="figure-value">{f.hours ? formatHours(stats[f.key]) : Number(stats[f.key] || 0).toLocaleString('en-IN')}</span>
              <span className="figure-label">{f.label}</span>
              {f.note && <span className="figure-note">{f.note}</span>}
            </div>
          ))}
        </section>
      )}

      <section className="panel" aria-labelledby="pending-title">
        <div className="panel-header">
          <h2 id="pending-title">
            Organizations awaiting review
            {pendingCount > 0 && <span className="badge badge-warning admin-count">{pendingCount}</span>}
          </h2>
          <Link to="/admin/organizations" className="btn btn-secondary btn-sm">Open review queue</Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing to review">
            New organizations appear here as soon as a coordinator registers one.
          </EmptyState>
        ) : (
          <ul role="list" className="admin-pending-list">
            {pending.map((org) => (
              <li key={org.id}>
                <OrgInitials name={org.name} />
                <div className="admin-pending-main">
                  <span className="cell-primary">{org.name}</span>
                  <span className="cell-sub">
                    {org.coordinator_name} · {org.coordinator_email} · submitted {formatDate(org.created_at)}
                  </span>
                </div>
                <Link to="/admin/organizations" className="btn btn-primary btn-sm">
                  Review <Icon name="chevron-right" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default AdminOverview
