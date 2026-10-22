import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationsApi, getManagedOpportunitiesApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, OrgInitials } from '../../components/ui'
import { formatDate, isUpcoming } from '../../utils/format'
import './OrgProfile.css'

function OrgProfile() {
  const { user, token } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [orgsRes, oppsRes] = await Promise.all([getOrganizationsApi(token), getManagedOpportunitiesApi(token)])
      setOrganizations((orgsRes?.data?.organizations || []).filter((org) => org.coordinator_id === user.id))
      setOpportunities(oppsRes?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Your organizations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, user.id])

  useEffect(() => { load() }, [load])

  const statsFor = (orgId) => {
    const own = opportunities.filter((o) => o.organization_id === orgId)
    return [
      { label: 'Upcoming events', value: own.filter((o) => isUpcoming(o.event_date) && o.status === 'PUBLISHED').length },
      { label: 'Drafts', value: own.filter((o) => o.status === 'DRAFT').length },
      { label: 'Active registrations', value: own.reduce((sum, o) => sum + Number(o.active_signups || 0), 0) },
      { label: 'Opportunities in total', value: own.length },
    ]
  }

  return (
    <div className="page">
      <PageHeader
        title="My organizations"
        description="The organizations you coordinate. Volunteers see each one’s name and description on its public page."
        actions={organizations.length > 0 && (
          <Link to="/organizations?new=1" className="btn btn-secondary"><Icon name="plus" size={15} />New organization</Link>
        )}
      />

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading organizations…" />
      ) : organizations.length === 0 ? (
        !error && (
          <div className="panel">
            <EmptyState
              icon="building"
              title="You don’t manage an organization yet"
              action={<Link to="/organizations?new=1" className="btn btn-primary">Create an organization</Link>}
            >
              Opportunities are always published under an organization, so start by creating one.
            </EmptyState>
          </div>
        )
      ) : (
        organizations.map((org) => (
          <article key={org.id} className="panel org-card" aria-labelledby={`org-${org.id}`}>
            <header className="org-card-header">
              <OrgInitials name={org.name} />
              <div className="org-card-title">
                <h2 id={`org-${org.id}`}>{org.name}</h2>
                <p className="muted">Created {formatDate(org.created_at, { month: 'long' })}</p>
              </div>
              <div className="org-card-actions">
                <Link to={`/organizations/${org.id}`} className="btn btn-ghost">Public page</Link>
                <Link to={`/opportunities/create?org=${org.id}`} className="btn btn-primary"><Icon name="plus" size={15} />New opportunity</Link>
              </div>
            </header>
            <p className={`org-card-desc${org.description ? '' : ' muted'}`}>
              {org.description || 'No description yet. Volunteers will see an empty About section.'}
            </p>
            <dl className="org-card-stats">
              {statsFor(org.id).map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd className="num">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))
      )}

      {organizations.length > 0 && (
        <p className="muted org-note">Organization names and descriptions can’t be edited yet — the server has no update endpoint for organizations.</p>
      )}
    </div>
  )
}

export default OrgProfile
