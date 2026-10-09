import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationsApi, createOrganizationApi } from '../../services/api'
import './Organizations.css'

function Organizations() {
  const { user, token, isAuthenticated } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  const fetchOrganizations = async () => {
    if (!token) return
    setError('')
    try {
      const res = await getOrganizationsApi(token)
      setOrganizations(res?.data?.organizations || [])
    } catch (err) {
      setError(err.message || 'Failed to load organizations. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [token])


  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')

    const name = formName.trim()
    const description = formDesc.trim()

    if (!name) {
      setCreateError('Organization name is required.')
      return
    }

    setCreating(true)
    try {
      await createOrganizationApi({ name, description }, token)
      setCreateSuccess('Organization created successfully!')
      setFormName('')
      setFormDesc('')
      setShowCreateForm(false)
      fetchOrganizations()
    } catch (err) {
      setCreateError(err.message || 'Failed to create organization.')
    } finally {
      setCreating(false)
    }
  }

  const filteredOrganizations = organizations.filter((org) => {
    const q = searchQuery.toLowerCase()
    return (
      org.name?.toLowerCase().includes(q) ||
      org.description?.toLowerCase().includes(q)
    )
  })

  const isCoordinator = user?.role === 'COORDINATOR'

  if (!isAuthenticated) {
    return (
      <main className="organizations-page">
        <div className="organizations-container auth-gate">
          <h2>Nonprofit Organizations</h2>
          <p>Please log in to view and register organizations on ServeHub.</p>
          <div className="auth-gate-actions">
            <Link to="/login" className="btn btn-primary">Login to View</Link>
            <Link to="/register" className="btn btn-secondary">Create Account</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="organizations-page">
      <div className="organizations-container">
        <header className="organizations-header">
          <div>
            <h1>Nonprofit Organizations</h1>
            <p>Discover partner organizations driving community impact and social change.</p>
          </div>
          {isCoordinator && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowCreateForm((prev) => !prev)
                setCreateError('')
                setCreateSuccess('')
              }}
            >
              {showCreateForm ? 'Cancel' : '+ New Organization'}
            </button>
          )}
        </header>

        {createSuccess && <div className="alert-success">{createSuccess}</div>}

        {isCoordinator && showCreateForm && (
          <div className="create-org-card">
            <h3>Create New Organization</h3>
            <p className="create-org-subtitle">Add your NGO or community organization to ServeHub.</p>

            {createError && <div className="alert-error">{createError}</div>}

            <form onSubmit={handleCreateSubmit} className="create-org-form">
              <div className="form-group">
                <label htmlFor="orgName">Organization Name *</label>
                <input
                  type="text"
                  id="orgName"
                  placeholder="e.g. Green Earth Foundation"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="orgDesc">Description</label>
                <textarea
                  id="orgDesc"
                  rows="3"
                  placeholder="Briefly describe your organization's mission and goals..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  disabled={creating}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="filter-bar">
          <input
            type="text"
            className="filter-input"
            placeholder="Search organizations by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error && <div className="alert-error">{error}</div>}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading organizations...</p>
          </div>
        ) : filteredOrganizations.length > 0 ? (
          <div className="organizations-grid">
            {filteredOrganizations.map((org) => (
              <div key={org.id} className="org-card">
                <div className="org-card-header">
                  <span className="org-badge">Verified Partner</span>
                  <h3>{org.name}</h3>
                </div>
                <p className="org-card-desc">
                  {org.description || 'No description provided for this organization.'}
                </p>
                <div className="org-card-footer">
                  <span className="org-date">
                    Added {org.created_at ? new Date(org.created_at).toLocaleDateString() : 'Recently'}
                  </span>
                  <Link to={`/organizations/${org.id}`} className="btn btn-secondary btn-sm">
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No organizations found.</p>
            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

export default Organizations
