import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOrganizationByIdApi, getOrganizationOpportunitiesApi } from '../../services/api'
import Icon from '../../components/Icon'
import OpportunityRow from '../../components/OpportunityRow'
import { LoadingState, EmptyState, OrgInitials, Alert } from '../../components/ui'
import { formatDate } from '../../utils/format'
import './OrganizationDetails.css'

const SOCIAL_BASE = {
  twitter: 'https://twitter.com/',
  x: 'https://x.com/',
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  linkedin: 'https://www.linkedin.com/company/',
  youtube: 'https://www.youtube.com/@',
}

/** Turn a saved social value (URL or @handle) into a safe https link, or null. */
function socialHref(network, value) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  const handle = value.replace(/^@/, '')
  if (!/^[A-Za-z0-9_.-]+$/.test(handle) || !SOCIAL_BASE[network]) return null
  return SOCIAL_BASE[network] + handle
}

const safeUrl = (value) => (value && /^https?:\/\//i.test(value) ? value : null)

function OrganizationContact({ organization }) {
  const website = safeUrl(organization.website)
  const socials = Object.entries(organization.social_links || {})
    .map(([network, value]) => ({ network, href: socialHref(network, value) }))
    .filter((s) => s.href)
  if (!website && !organization.email && !organization.phone && !organization.address && socials.length === 0) return null

  return (
    <section aria-labelledby="org-contact">
      <h2 id="org-contact" className="section-title">Contact</h2>
      <ul role="list" className="org-contact-list">
        {website && (
          <li><Icon name="link" size={15} /><a href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//, '')}</a></li>
        )}
        {organization.email && (
          <li><Icon name="mail" size={15} /><a href={`mailto:${organization.email}`}>{organization.email}</a></li>
        )}
        {organization.phone && (
          <li><Icon name="phone" size={15} /><a href={`tel:${organization.phone.replace(/[^+\d]/g, '')}`}>{organization.phone}</a></li>
        )}
        {organization.address && <li><Icon name="map-pin" size={15} /><span>{organization.address}</span></li>}
        {socials.map((s) => (
          <li key={s.network}>
            <Icon name="link" size={15} />
            <a href={s.href} target="_blank" rel="noopener noreferrer">
              {s.network.charAt(0).toUpperCase() + s.network.slice(1)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OrganizationDetails() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const { isRegistered } = useOpportunities()
  const [organization, setOrganization] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [orgRes, oppRes] = await Promise.all([
        getOrganizationByIdApi(id, token),
        getOrganizationOpportunitiesApi(id, token, { upcoming: true, limit: 50 }).catch(() => null),
      ])
      setOrganization(orgRes?.data?.organization || null)
      setUpcoming(oppRes?.data?.opportunities || [])
    } catch (err) {
      setOrganization(null)
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
  const status = organization.verification_status

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

      {isOwner && status && status !== 'APPROVED' && (
        <Alert tone={status === 'PENDING' ? 'info' : 'error'}>
          {status === 'PENDING'
            ? 'This organization is awaiting verification by the ServeHub team. Until it’s approved it’s hidden from the public and you can only save opportunities as drafts.'
            : `This organization was ${status.toLowerCase()}.${organization.verification_note ? ` Reviewer note: ${organization.verification_note}` : ''} Contact support to resolve it.`}
        </Alert>
      )}

      <div className="org-profile-layout">
        <div className="org-profile-about">
          <section aria-labelledby="org-about">
            <h2 id="org-about" className="section-title">About</h2>
            {organization.description ? (
              <p>{organization.description}</p>
            ) : (
              <p className="muted">This organization hasn’t added a description.</p>
            )}
          </section>
          <OrganizationContact organization={organization} />
        </div>

        <section aria-labelledby="org-upcoming">
          <h2 id="org-upcoming" className="section-title org-upcoming-title">Upcoming opportunities</h2>
          {upcoming.length === 0 ? (
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
