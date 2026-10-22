import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOrganizationByIdApi } from '../../services/api'
import Icon from '../../components/Icon'
import OpportunityRow from '../../components/OpportunityRow'
import { LoadingState, EmptyState, OrgInitials } from '../../components/ui'
import { formatDate, isUpcoming, compareByDate } from '../../utils/format'
import './OrganizationDetails.css'

function OrganizationDetails() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const { opportunities, isRegistered, loading: opportunitiesLoading } = useOpportunities()
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await getOrganizationByIdApi(id, token)
      setOrganization(res?.data?.organization || null)
    } catch (err) {
      setError(err.message || 'This organization could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState label="Loading organization…" />

  if (!organization) {
    return (
      <div className="page page-narrow">
        <div className="panel">
          <EmptyState
            icon="building"
            title="Organization not found"
            action={<Link to="/organizations" className="btn btn-secondary">Back to organizations</Link>}
          >
            {error || 'It may have been removed, or the link is incorrect.'}
          </EmptyState>
        </div>
      </div>
    )
  }

  const isOwner = user?.role === 'COORDINATOR' && organization.coordinator_id === user.id
  const upcoming = opportunities
    .filter((o) => o.organization_id === organization.id && o.status === 'PUBLISHED' && isUpcoming(o.event_date))
    .sort(compareByDate)

  return (
    <div className="page">
      <Link to="/organizations" className="back-link">
        <Icon name="arrow-left" size={14} /> Organizations
      </Link>

      <header className="org-profile-header">
        <OrgInitials name={organization.name} large />
        <div className="org-profile-heading">
          <h1>{organization.name}</h1>
          <p className="muted">
            On ServeHub since {formatDate(organization.created_at, { month: 'long', day: undefined })}
            {isOwner && ' · Managed by you'}
          </p>
        </div>
        {isOwner && (
          <Link to={`/opportunities/create?org=${organization.id}`} className="btn btn-primary">
            <Icon name="plus" size={15} /> New opportunity
          </Link>
        )}
      </header>

      <div className="org-profile-layout">
        <section className="org-profile-about" aria-labelledby="org-about">
          <h2 id="org-about" className="section-title">About</h2>
          {organization.description ? (
            <p>{organization.description}</p>
          ) : (
            <p className="muted">This organization hasn’t added a description.</p>
          )}
        </section>

        <section aria-labelledby="org-upcoming">
          <h2 id="org-upcoming" className="section-title org-upcoming-title">Upcoming opportunities</h2>
          {opportunitiesLoading ? (
            <LoadingState />
          ) : upcoming.length === 0 ? (
            <div className="panel">
              <EmptyState icon="calendar" title="Nothing scheduled right now">
                {isOwner ? 'Publish an opportunity and it will be listed here.' : 'New opportunities from this organization will appear here.'}
              </EmptyState>
            </div>
          ) : (
            <ul role="list" className="opp-list">
              {upcoming.map((o) => (
                <li key={o.id}>
                  <OpportunityRow opportunity={o} showOrganization={false} registered={user?.role === 'VOLUNTEER' && isRegistered(o.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default OrganizationDetails
