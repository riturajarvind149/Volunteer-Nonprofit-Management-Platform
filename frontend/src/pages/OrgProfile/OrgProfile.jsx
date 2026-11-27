import { useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMyOrganizationsApi, getManagedOpportunitiesApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, OrgInitials } from '../../components/ui'
import { formatDate, isUpcoming } from '../../utils/format'
import { memberRoleLabel } from '../../utils/ngo'
import OrgEditForm from './OrgEditForm'
import { useAutoLoad } from '../../hooks/useAutoLoad'
import './OrgProfile.css'

function OrgProfile() {
  const { token } = useAuth()
  const location = useLocation()
  const [organizations, setOrganizations] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [savedId, setSavedId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [orgsRes, oppsRes] = await Promise.all([getMyOrganizationsApi(token), getManagedOpportunitiesApi(token)])
      setOrganizations(orgsRes?.data?.organizations || [])
      setOpportunities(oppsRes?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Your organizations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useAutoLoad(load)

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
        description="The NGOs you belong to. Volunteers see each one’s name and description on its public page."
      />

      {location.state?.message && <Alert tone="success">{location.state.message}</Alert>}
      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading organizations…" />
      ) : organizations.length === 0 ? (
        !error && (
          <div className="panel">
            <EmptyState
              icon="building"
              title="You’re not part of an NGO yet"
              action={<Link to="/organizations/register" className="btn btn-primary">Register your NGO</Link>}
            >
              Ask your NGO admin to invite you, or register your NGO to become its NGO admin.
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
                <p className="muted">
                  <span className="badge badge-info">{memberRoleLabel(org.my_role)}</span> · Created {formatDate(org.created_at, { month: 'long' })}
                </p>
              </div>
              <div className="org-card-actions">
                {org.my_role === 'OWNER' && editingId !== org.id && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(org.id); setSavedId(null) }}>
                    <Icon name="edit" size={15} />Edit details
                  </button>
                )}
                <Link to={`/organizations/${org.id}/team`} className="btn btn-secondary">
                  <Icon name="users" size={15} />Team
                </Link>
                <Link to={`/organizations/${org.id}`} className="btn btn-ghost">Public page</Link>
                <Link to={`/opportunities/create?org=${org.id}`} className="btn btn-primary"><Icon name="plus" size={15} />New opportunity</Link>
              </div>
            </header>
            {savedId === org.id && <Alert tone="success">Changes saved. They’re live on your public page.</Alert>}
            {editingId === org.id ? (
              <OrgEditForm
                organization={org}
                token={token}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  setOrganizations((prev) => prev.map((o) => (o.id === org.id ? { ...o, ...updated } : o)))
                  setEditingId(null)
                  setSavedId(org.id)
                }}
              />
            ) : (
              <p className={`org-card-desc${org.description ? '' : ' muted'}`}>
                {org.description || 'No description yet. Use “Edit details” to tell volunteers what you do.'}
              </p>
            )}
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

    </div>
  )
}

export default OrgProfile
