import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOrganizationByIdApi } from '../../services/api'
import OpportunityCard from '../../components/OpportunityCard'
import './OrganizationDetails.css'

function OrganizationDetails() {
  const { id } = useParams()
  const { token, isAuthenticated, user } = useAuth()
  const { opportunities } = useOpportunities()
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')

  const orgOpportunities = opportunities.filter(
    (o) => o.organization_id === id || o.organization_name === organization?.name
  )

  useEffect(() => {
    if (!token) return

    const fetchOrg = async () => {
      setError('')
      try {
        const res = await getOrganizationByIdApi(id, token)
        if (res?.data?.organization) {
          setOrganization(res.data.organization)
        } else {
          setError('Organization not found.')
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch organization details.')
      } finally {
        setLoading(false)
      }
    }

    fetchOrg()
  }, [id, token])

  if (!isAuthenticated) {
    return (
      <main className="org-details-page">
        <div className="org-details-container not-found">
          <h2>Authentication Required</h2>
          <p>Please log in to view organization details.</p>
          <Link to="/login" className="btn btn-primary">
            Login
          </Link>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="org-details-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading organization details...</p>
        </div>
      </main>
    )
  }

  if (error || !organization) {
    return (
      <main className="org-details-page">
        <div className="org-details-container not-found">
          <h2>Organization Not Found</h2>
          <p>{error || 'The requested organization could not be found.'}</p>
          <Link to="/organizations" className="btn btn-secondary">
            ← Back to Organizations
          </Link>
        </div>
      </main>
    )
  }

  const { name, description, coordinator_id, created_at } = organization
  const isOwner = user?.id === coordinator_id

  return (
    <main className="org-details-page">
      <div className="org-details-container">
        <Link to="/organizations" className="back-btn">
          ← Back to Organizations
        </Link>

        <article className="org-details-card">
          <header className="org-details-header">
            <span className="org-badge">Verified Organization</span>
            <h1>{name}</h1>
            <p className="org-id-sub">Organization ID: {organization.id}</p>
          </header>

          <section className="org-details-meta">
            <div className="meta-box">
              <span className="meta-box-label">Registered Date</span>
              <span className="meta-box-value">
                {created_at ? new Date(created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            {isOwner && (
              <div className="meta-box">
                <span className="meta-box-label">Your Organization</span>
                <span className="meta-box-value" style={{ color: 'var(--color-primary)' }}>You manage this org</span>
              </div>
            )}
          </section>

          <section className="org-details-body">
            <h2>About the Organization</h2>
            <p>{description || 'No description available for this organization.'}</p>
          </section>

          {orgOpportunities.length > 0 && (
            <section className="org-opportunities-section">
              <h2>Opportunities from this Organization</h2>
              <div className="org-opportunities-grid">
                {orgOpportunities.map((opp) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>
            </section>
          )}

          <footer className="org-details-footer">
            <Link to="/organizations" className="btn btn-secondary">Back to List</Link>
            {isOwner && (
              <Link to="/opportunities/new" className="btn btn-primary">Post Opportunity</Link>
            )}
          </footer>
        </article>
      </div>
    </main>
  )
}

export default OrganizationDetails
