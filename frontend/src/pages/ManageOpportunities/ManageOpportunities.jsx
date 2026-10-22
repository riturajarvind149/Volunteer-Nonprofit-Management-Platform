import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getManagedOpportunitiesApi, getOrganizationsApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge, CapacityMeter } from '../../components/ui'
import { formatDate, formatTime, compareByDate } from '../../utils/format'
import './ManageOpportunities.css'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

function ManageOpportunities() {
  const { user, token } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [opportunities, setOpportunities] = useState([])
  const [hasOrganization, setHasOrganization] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const status = params.get('status') || ''

  const load = useCallback(async () => {
    setError('')
    try {
      const [oppsRes, orgsRes] = await Promise.all([getManagedOpportunitiesApi(token), getOrganizationsApi(token)])
      setOpportunities(oppsRes?.data?.opportunities || [])
      setHasOrganization((orgsRes?.data?.organizations || []).some((org) => org.coordinator_id === user.id))
    } catch (err) {
      setError(err.message || 'Your opportunities could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, user.id])

  useEffect(() => { load() }, [load])

  const counts = Object.fromEntries(
    STATUS_TABS.map((t) => [t.key, t.key ? opportunities.filter((o) => o.status === t.key).length : opportunities.length]),
  )

  const q = query.trim().toLowerCase()
  const rows = opportunities
    .filter((o) => !status || o.status === status)
    .filter((o) => !q || [o.title, o.location, o.category, o.organization_name].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => compareByDate(b, a))

  return (
    <div className="page">
      <PageHeader
        title="Opportunities"
        description="Everything your organizations have scheduled, newest dates first."
        actions={hasOrganization && (
          <Link to="/opportunities/create" className="btn btn-primary"><Icon name="plus" size={15} />New opportunity</Link>
        )}
      />

      {location.state?.notice && <Alert tone="success">{location.state.notice}</Alert>}
      {!loading && !hasOrganization && (
        <Alert tone="info">
          You need an organization before you can publish opportunities. <Link to="/organizations?new=1">Create one now</Link>.
        </Alert>
      )}
      {error && <Alert onRetry={load}>{error}</Alert>}

      <section className="panel">
        <div className="panel-header manage-toolbar">
          <div className="segmented" role="group" aria-label="Filter by status">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key || 'all'}
                type="button"
                aria-pressed={status === t.key}
                onClick={() => setParams(t.key ? { status: t.key } : {}, { replace: true })}
              >
                {t.label}<span className="count">{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <label className="search manage-search">
            <span className="sr-only">Search opportunities</span>
            <Icon name="search" size={16} />
            <input type="search" className="input" placeholder="Search title, place, category" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        {loading ? (
          <LoadingState label="Loading opportunities…" />
        ) : rows.length === 0 ? (
          opportunities.length === 0 ? (
            <EmptyState
              icon="layers"
              title="You haven’t created any opportunities"
              action={hasOrganization && <Link to="/opportunities/create" className="btn btn-primary">Create your first opportunity</Link>}
            >
              Opportunities you create are listed here with their signup numbers.
            </EmptyState>
          ) : (
            <EmptyState icon="search" title="No opportunities match">
              Try another status or search term.
            </EmptyState>
          )
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opportunity</th>
                  <th>Status</th>
                  <th>Signups</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td data-label="Date" className="num manage-date">
                      {formatDate(o.event_date)}
                      <span className="cell-sub">{formatTime(o.start_time, o.end_time)}</span>
                    </td>
                    <td data-label="Opportunity" className="cell-lead">
                      <Link to={`/opportunities/${o.id}`}>{o.title}</Link>
                      <span className="cell-sub">{[o.organization_name, o.location].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td data-label="Status"><StatusBadge status={o.status} /></td>
                    <td data-label="Signups">
                      <div className="manage-signups">
                        <span className="num">{o.active_signups} / {o.capacity}</span>
                        <CapacityMeter taken={o.active_signups} capacity={o.capacity} />
                      </div>
                    </td>
                    <td data-label="">
                      <div className="manage-actions">
                        <Link to={`/opportunities/${o.id}/attendees`} className="btn btn-secondary btn-sm">Roster</Link>
                        <Link to={`/opportunities/${o.id}/edit`} className="btn btn-ghost btn-sm" aria-label={`Edit ${o.title}`}>
                          <Icon name="edit" size={14} />Edit
                        </Link>
                      </div>
                    </td>
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

export default ManageOpportunities
