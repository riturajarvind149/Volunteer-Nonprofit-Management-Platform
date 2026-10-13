import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getManagedOpportunitiesApi, getOrganizationsApi, createOpportunityApi, updateOpportunityApi } from '../../services/api'
import { formatDate, formatTime } from '../../utils/format'
import './ManageOpportunities.css'

const CATEGORIES = [
  'Community Support', 'Hunger & Food', 'Education', 'Environment',
  'Animal Welfare', 'Health & Wellness', 'Arts & Culture',
]

const BLANK_FORM = {
  organization_id: '',
  title: '',
  description: '',
  category: 'Community Support',
  event_date: '',
  start_time: '09:00',
  end_time: '12:00',
  location: '',
  address: '',
  capacity: 10,
  status: 'PUBLISHED',
}

function ManageOpportunities({ initialMode = 'list' }) {
  const { id: urlId } = useParams()
  const navigate = useNavigate()
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { refetch: refetchGlobalOpportunities } = useOpportunities()

  const [opportunities, setOpportunities] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Single modal state: null = closed, 'create' = new, opp object = edit
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState('')
  const [bannerError, setBannerError] = useState('')

  const loadData = useCallback(async () => {
    if (!token || user?.role !== 'COORDINATOR') return
    setLoading(true)
    setError(null)
    try {
      const [oppsRes, orgsRes] = await Promise.all([
        getManagedOpportunitiesApi(token),
        getOrganizationsApi(token),
      ])
      const opps = oppsRes?.data?.opportunities || []
      const allOrgs = orgsRes?.data?.organizations || []
      const myOrgs = allOrgs.filter((org) => org.coordinator_id === user.id)
      setOpportunities(opps)
      setOrganizations(myOrgs)
    } catch (err) {
      setError(err.message || 'Failed to load managed opportunities from server')
    } finally {
      setLoading(false)
    }
  }, [token, user])

  useEffect(() => { loadData() }, [loadData])

  // Handle URL-based edit (/opportunities/:id/edit)
  useEffect(() => {
    if (urlId && opportunities.length > 0) {
      const found = opportunities.find((o) => String(o.id) === String(urlId))
      if (found) openEdit(found)
    }
  }, [urlId, opportunities]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Verifying coordinator access...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />

  function openCreate() {
    setBannerSuccess('')
    setBannerError('')
    setFormError('')
    setForm({ ...BLANK_FORM, organization_id: organizations[0]?.id || '' })
    setModal('create')
  }

  function openEdit(opp) {
    setBannerSuccess('')
    setBannerError('')
    setFormError('')
    const cleanTime = (t) => (t && t.length > 5 ? t.slice(0, 5) : t || '')
    const cleanDate = (d) => {
      if (!d) return ''
      try {
        const dt = new Date(d)
        return isNaN(dt.getTime()) ? d : dt.toISOString().split('T')[0]
      } catch { return d }
    }
    setForm({
      organization_id: opp.organization_id || '',
      title: opp.title || '',
      description: opp.description || '',
      category: opp.category || 'Community Support',
      event_date: cleanDate(opp.event_date),
      start_time: cleanTime(opp.start_time),
      end_time: cleanTime(opp.end_time),
      location: opp.location || '',
      address: opp.address || '',
      capacity: Number(opp.capacity) || 10,
      status: opp.status || 'PUBLISHED',
    })
    setModal(opp)
  }

  function closeModal() {
    if (submitting) return
    setModal(null)
    if (urlId) navigate('/manage-opportunities')
    if (initialMode === 'create') navigate('/manage-opportunities')
  }

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  function validateForm() {
    if (!form.title.trim() || form.title.trim().length < 2) return 'Title must be at least 2 characters.'
    if (!form.event_date) return 'Event date is required.'
    if (!form.start_time || !form.end_time) return 'Both start and end times are required.'
    if (form.end_time < form.start_time) return 'End time must not be earlier than start time.'
    const cap = Number(form.capacity)
    if (!cap || cap <= 0) return 'Capacity must be a positive integer greater than zero.'
    if (modal !== 'create') {
      const activeSignups = modal?.active_signups ?? 0
      if (cap < activeSignups) return `Cannot reduce capacity below active signups (${activeSignups}).`
    }
    if (modal === 'create' && !form.organization_id) return 'Please select an organization.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const validationError = validateForm()
    if (validationError) { setFormError(validationError); return }
    setFormError('')
    setSubmitting(true)
    try {
      const cap = Number(form.capacity)
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category || 'Community Support',
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location.trim() || 'Location TBD',
        address: form.address.trim() || null,
        capacity: cap,
        status: form.status || 'PUBLISHED',
      }
      if (modal === 'create') {
        payload.organization_id = form.organization_id
        await createOpportunityApi(payload, token)
        setBannerSuccess(`Opportunity "${payload.title}" created successfully!`)
      } else {
        await updateOpportunityApi(modal.id, payload, token)
        setBannerSuccess(`Opportunity "${payload.title}" updated successfully!`)
      }
      setModal(null)
      await loadData()
      refetchGlobalOpportunities?.()
      if (urlId || initialMode === 'create') navigate('/manage-opportunities')
    } catch (err) {
      setFormError(err.message || 'Failed to save opportunity. Please check your inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredOpportunities = opportunities.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || item.title?.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const counts = {
    total: opportunities.length,
    published: opportunities.filter((o) => o.status === 'PUBLISHED').length,
    draft: opportunities.filter((o) => o.status === 'DRAFT').length,
    completed: opportunities.filter((o) => o.status === 'COMPLETED').length,
    cancelled: opportunities.filter((o) => o.status === 'CANCELLED').length,
    volunteers: opportunities.reduce((acc, o) => acc + (Number(o.active_signups) || 0), 0),
  }

  const isEditing = modal && modal !== 'create'

  return (
    <div className="manage-opps-page">
      <div className="manage-opps-container">
        <header className="manage-opps-header">
          <div>
            <h1>Manage Opportunities</h1>
            <p>Create, monitor, and update volunteer events for your organizations.</p>
          </div>
          <div className="header-action-group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
              disabled={organizations.length === 0}
            >
              + Create Opportunity
            </button>
            <Link to="/organizations" className="btn btn-secondary">My Organizations</Link>
          </div>
        </header>

        {bannerSuccess && <div className="alert-success" role="alert">{bannerSuccess}</div>}
        {bannerError && <div className="alert-error" role="alert">{bannerError}</div>}
        {error && (
          <div className="alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={loadData}>Retry</button>
          </div>
        )}

        {!loading && organizations.length === 0 && (
          <div className="alert-error">
            <strong>Organization Required:</strong> You do not own any organizations yet. You must{' '}
            <Link to="/organizations" style={{ textDecoration: 'underline', fontWeight: 700, color: 'inherit' }}>
              create an organization
            </Link>{' '}
            before you can publish volunteer opportunities.
          </div>
        )}

        <section className="manage-stats-grid">
          {[
            { label: 'Total Managed', value: counts.total },
            { label: 'Published (Active)', value: counts.published },
            { label: 'Drafts', value: counts.draft },
            { label: 'Volunteers Registered', value: counts.volunteers },
          ].map(({ label, value }) => (
            <div key={label} className="manage-stat-card">
              <span className="manage-stat-label">{label}</span>
              <span className="manage-stat-value">{value}</span>
            </div>
          ))}
        </section>

        <section className="manage-controls">
          <nav className="manage-tabs" aria-label="Status filter">
            {[
              { key: 'all', label: 'All', count: counts.total },
              { key: 'PUBLISHED', label: 'Published', count: counts.published },
              { key: 'DRAFT', label: 'Drafts', count: counts.draft },
              { key: 'COMPLETED', label: 'Completed', count: counts.completed },
              { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                className={`tab-btn ${statusFilter === key ? 'active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label} <span className="tab-badge">{count}</span>
              </button>
            ))}
          </nav>
          <input
            type="text"
            className="manage-search-input"
            placeholder="Search by title, location, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </section>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading your managed opportunities...</p>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="empty-manage-card">
            <div className="empty-icon">📁</div>
            <h3>{statusFilter === 'all' ? 'No Opportunities Found' : `No ${statusFilter.toLowerCase()} opportunities`}</h3>
            <p>
              {opportunities.length === 0
                ? 'You have not created any opportunities yet.'
                : 'No opportunities match your current filter and search criteria.'}
            </p>
            {organizations.length > 0 ? (
              <button type="button" className="btn btn-primary" onClick={openCreate}>+ Create Your First Opportunity</button>
            ) : (
              <Link to="/organizations" className="btn btn-primary">+ Create an Organization First</Link>
            )}
          </div>
        ) : (
          <div className="manage-grid">
            {filteredOpportunities.map((opp) => {
              const activeSignups = opp.active_signups ?? 0
              const capacity = opp.capacity || 1
              const percentFilled = Math.min(Math.round((activeSignups / capacity) * 100), 100)
              return (
                <article key={opp.id} className="manage-card">
                  <div className="manage-card-header">
                    <span className={`status-badge badge-${opp.status?.toLowerCase() || 'published'}`}>{opp.status}</span>
                    <span className="opp-date-pill">{formatDate(opp.event_date, { weekday: 'short' })}</span>
                  </div>
                  <h2 className="manage-opp-title">
                    <Link to={`/opportunities/${opp.id}`}>{opp.title}</Link>
                  </h2>
                  <p className="manage-opp-org">Org: <strong>{opp.organization_name || 'My Organization'}</strong></p>
                  <div className="manage-opp-meta">
                    <div className="meta-row"><span>⏰</span><span>{formatTime(opp.start_time, opp.end_time)}</span></div>
                    <div className="meta-row"><span>📍</span><span>{opp.location || 'Location TBD'}</span></div>
                    {opp.category && <div className="meta-row"><span>🏷️</span><span>{opp.category}</span></div>}
                  </div>
                  <div className="capacity-container">
                    <div className="capacity-labels">
                      <span>Volunteers</span>
                      <span>{activeSignups} / {capacity} spots filled</span>
                    </div>
                    <div className="capacity-bar-bg">
                      <div className="capacity-bar-fill" style={{ width: `${percentFilled}%` }} />
                    </div>
                  </div>
                  <div className="manage-card-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(opp)}>✏️ Edit</button>
                    <Link to={`/opportunities/${opp.id}/attendees`} className="btn btn-outline btn-sm">👥 Attendees ({activeSignups})</Link>
                    <Link to={`/opportunities/${opp.id}`} className="btn btn-outline btn-sm">View →</Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Create / Edit Modal */}
        {modal && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="opportunity-form-card">
              <div className="modal-header">
                <h2 id="modal-title">
                  {modal === 'create' ? 'Create New Volunteer Opportunity' : `Edit Opportunity: ${modal.title}`}
                </h2>
                <button type="button" className="btn-close-modal" onClick={closeModal} disabled={submitting} aria-label="Close">✕</button>
              </div>

              {formError && (
                <div style={{ margin: '1rem 1.5rem 0' }} className="alert-error" role="alert">{formError}</div>
              )}

              <form onSubmit={handleSubmit} className="opportunity-form">
                {modal === 'create' && (
                  <div className="form-group">
                    <label htmlFor="formOrg">Organization *</label>
                    <select id="formOrg" value={form.organization_id} onChange={(e) => setField('organization_id', e.target.value)} disabled={submitting} required>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                    <span className="form-hint">Opportunities must belong to one of your organizations.</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="formTitle">Opportunity Title *</label>
                  <input
                    type="text" id="formTitle" placeholder="e.g. Community Garden Spring Planting"
                    value={form.title} onChange={(e) => setField('title', e.target.value)}
                    disabled={submitting} required minLength={2} maxLength={255}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="formDesc">Description</label>
                  <textarea
                    id="formDesc" rows="3" placeholder="Describe tasks, objectives, what volunteers should bring, etc."
                    value={form.description} onChange={(e) => setField('description', e.target.value)}
                    disabled={submitting} maxLength={5000}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="formCategory">Category</label>
                    <select id="formCategory" value={form.category} onChange={(e) => setField('category', e.target.value)} disabled={submitting}>
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="formStatus">Status</label>
                    <select id="formStatus" value={form.status} onChange={(e) => setField('status', e.target.value)} disabled={submitting}>
                      <option value="PUBLISHED">PUBLISHED (Visible to Volunteers)</option>
                      <option value="DRAFT">DRAFT (Hidden)</option>
                      {isEditing && <option value="COMPLETED">COMPLETED</option>}
                      {isEditing && <option value="CANCELLED">CANCELLED</option>}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="formDate">Event Date *</label>
                    <input type="date" id="formDate" value={form.event_date} onChange={(e) => setField('event_date', e.target.value)} disabled={submitting} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="formCapacity">
                      Volunteer Capacity *{isEditing && ` (Active: ${modal.active_signups ?? 0})`}
                    </label>
                    <input
                      type="number" id="formCapacity" min={isEditing ? Math.max(1, modal.active_signups ?? 1) : 1}
                      value={form.capacity} onChange={(e) => setField('capacity', e.target.value)}
                      disabled={submitting} required
                    />
                    {isEditing && (
                      <span className="form-hint">Cannot be reduced below active signups ({modal.active_signups ?? 0}).</span>
                    )}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="formStartTime">Start Time *</label>
                    <input type="time" id="formStartTime" value={form.start_time} onChange={(e) => setField('start_time', e.target.value)} disabled={submitting} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="formEndTime">End Time *</label>
                    <input type="time" id="formEndTime" value={form.end_time} onChange={(e) => setField('end_time', e.target.value)} disabled={submitting} required />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="formLocation">Location Name</label>
                    <input type="text" id="formLocation" placeholder="e.g. City Park East Gate" value={form.location} onChange={(e) => setField('location', e.target.value)} disabled={submitting} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="formAddress">Full Street Address</label>
                    <input type="text" id="formAddress" placeholder="e.g. 123 Community Blvd, Suite 400" value={form.address} onChange={(e) => setField('address', e.target.value)} disabled={submitting} />
                  </div>
                </div>

                <div className="form-actions-row">
                  <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting
                      ? (modal === 'create' ? 'Creating Opportunity...' : 'Saving Changes...')
                      : (modal === 'create' ? 'Create Opportunity' : 'Save Changes')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManageOpportunities
