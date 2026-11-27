import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationsApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, OrgInitials } from '../../components/ui'
import { formatDate, pluralize } from '../../utils/format'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useAutoLoad } from '../../hooks/useAutoLoad'
import './Organizations.css'

function Organizations() {
  const { token } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const debouncedQuery = useDebouncedValue(query.trim(), 300)

  const load = useCallback(async () => {
    setError('')
    try {
      // Server-side search; approved organizations plus a coordinator's own.
      const res = await getOrganizationsApi(token, { q: debouncedQuery, limit: 100 })
      setOrganizations(res?.data?.organizations || [])
    } catch (err) {
      setError(err.message || 'Organizations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, debouncedQuery])

  useAutoLoad(load)

  const filtered = organizations

  return (
    <div className="page">
      <PageHeader
        title="Organizations"
        description="Nonprofits and community groups that publish opportunities on ServeHub."
      />

      <div className="org-toolbar">
        <label className="search">
          <span className="sr-only">Search organizations</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            className="input"
            placeholder="Search by name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {!loading && <p className="muted" aria-live="polite">{pluralize(filtered.length, 'organization')}</p>}
      </div>

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading organizations…" />
      ) : filtered.length === 0 ? (
        <div className="panel">
          {organizations.length === 0 && !debouncedQuery ? (
            <EmptyState icon="building" title="No organizations yet">
              NGOs appear here once they register and the ServeHub team verifies them.
            </EmptyState>
          ) : (
            <EmptyState
              icon="search"
              title={`No organizations match “${query}”`}
              action={<button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>Clear search</button>}
            />
          )}
        </div>
      ) : (
        <ul role="list" className="org-list">
          {filtered.map((org) => (
            <li key={org.id}>
              <Link to={`/organizations/${org.id}`} className="org-row">
                <OrgInitials name={org.name} />
                <div className="org-row-main">
                  <h2 className="org-row-name">
                    {org.name}
                    {org.my_role && <span className="badge badge-info">Yours</span>}
                    {org.my_role && org.verification_status === 'PENDING' && (
                      <span className="badge badge-warning">Pending verification</span>
                    )}
                    {org.my_role && ['REJECTED', 'SUSPENDED'].includes(org.verification_status) && (
                      <span className="badge badge-danger">{org.verification_status === 'REJECTED' ? 'Rejected' : 'Suspended'}</span>
                    )}
                  </h2>
                  <p className="org-row-desc">{org.description || 'No description provided.'}</p>
                  {Number(org.open_opportunities) > 0 && (
                    <p className="org-row-open">{pluralize(Number(org.open_opportunities), 'open opportunity', 'open opportunities')}</p>
                  )}
                </div>
                <span className="org-row-date">Joined {formatDate(org.created_at, { day: undefined })}</span>
                <Icon name="chevron-right" size={18} className="org-row-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Organizations
