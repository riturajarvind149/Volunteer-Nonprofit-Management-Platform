import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import {
  getManagedOpportunitiesApi,
  getOrganizationsApi,
  createOpportunityApi,
  updateOpportunityApi,
} from '../../services/api'
import './ManageOpportunities.css'

const CATEGORIES = [
  'Community Support',
  'Hunger & Food',
  'Education',
  'Environment',
  'Animal Welfare',
  'Health & Wellness',
  'Arts & Culture',
]

function ManageOpportunities({ initialMode = 'list' }) {
  const { id: urlId } = useParams()
  const navigate = useNavigate()
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { refetch: refetchGlobalOpportunities } = useOpportunities()

  const [opportunities, setOpportunities] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'PUBLISHED' | 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & Forms
  const [isCreateOpen, setIsCreateOpen] = useState(initialMode === 'create')
  const [editingOpportunity, setEditingOpportunity] = useState(null)

  // Action Banners
  const [bannerSuccess, setBannerSuccess] = useState('')
  const [bannerError, setBannerError] = useState('')

  // Form State - Create
  const [createForm, setCreateForm] = useState({
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
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createFormError, setCreateFormError] = useState('')

  // Form State - Edit
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location: '',
    address: '',
    capacity: 10,
    status: 'PUBLISHED',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editFormError, setEditFormError] = useState('')

  // ── Load Coordinator's Managed Data ─────────────────────────────────────
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
      setOpportunities(opps)

      // Filter organizations to those owned by this coordinator
      const allOrgs = orgsRes?.data?.organizations || []
      const myOrgs = allOrgs.filter((org) => org.coordinator_id === user.id)
      setOrganizations(myOrgs)

      // Pre-select first organization if available for create form
      if (myOrgs.length > 0 && !createForm.organization_id) {
        setCreateForm((prev) => ({ ...prev, organization_id: myOrgs[0].id }))
      }
    } catch (err) {
      setError(err.message || 'Failed to load managed opportunities from server')
    } finally {
      setLoading(false)
    }
  }, [token, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle URL-based edit parameter
  useEffect(() => {
    if (urlId && opportunities.length > 0) {
      const found = opportunities.find((o) => String(o.id) === String(urlId))
      if (found) {
        handleOpenEdit(found)
      }
    }
  }, [urlId, opportunities])

  // ── Auth & Role Protection ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <main className="manage-opps-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Verifying coordinator access...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'COORDINATOR') {
    return <Navigate to="/dashboard" replace />
  }

  // ── Create Opportunity Handlers ─────────────────────────────────────────
  const handleOpenCreate = () => {
    setBannerSuccess('')
    setBannerError('')
    setCreateFormError('')
    if (organizations.length > 0 && !createForm.organization_id) {
      setCreateForm((prev) => ({ ...prev, organization_id: organizations[0].id }))
    }
    setIsCreateOpen(true)
  }

  const handleCloseCreate = () => {
    if (createSubmitting) return
    setIsCreateOpen(false)
    if (initialMode === 'create') {
      navigate('/manage-opportunities')
    }
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (createSubmitting) return

    setCreateFormError('')
    setBannerSuccess('')
    setBannerError('')

    // Client-side validation
    if (!createForm.organization_id) {
      setCreateFormError('Please select an organization for this opportunity.')
      return
    }
    if (!createForm.title.trim() || createForm.title.trim().length < 2) {
      setCreateFormError('Title must be at least 2 characters.')
      return
    }
    if (!createForm.event_date) {
      setCreateFormError('Event date is required.')
      return
    }
    if (!createForm.start_time || !createForm.end_time) {
      setCreateFormError('Both start and end times are required.')
      return
    }
    if (createForm.end_time < createForm.start_time) {
      setCreateFormError('End time must not be earlier than start time.')
      return
    }
    const capNum = Number(createForm.capacity)
    if (!capNum || capNum <= 0) {
      setCreateFormError('Capacity must be a positive integer greater than zero.')
      return
    }

    setCreateSubmitting(true)
    try {
      const payload = {
        organization_id: createForm.organization_id,
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        category: createForm.category || 'Community Support',
        event_date: createForm.event_date,
        start_time: createForm.start_time,
        end_time: createForm.end_time,
        location: createForm.location.trim() || 'Location TBD',
        address: createForm.address.trim() || null,
        capacity: capNum,
        status: createForm.status || 'PUBLISHED',
      }

      await createOpportunityApi(payload, token)
      setBannerSuccess(`Opportunity "${payload.title}" created successfully!`)
      setIsCreateOpen(false)
      // Reset form
      setCreateForm({
        organization_id: organizations[0]?.id || '',
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
      })
      await loadData()
      if (refetchGlobalOpportunities) refetchGlobalOpportunities()
      if (initialMode === 'create') {
        navigate('/manage-opportunities')
      }
    } catch (err) {
      setCreateFormError(err.message || 'Failed to create opportunity. Please check your inputs.')
    } finally {
      setCreateSubmitting(false)
    }
  }

  // ── Edit Opportunity Handlers ───────────────────────────────────────────
  const handleOpenEdit = (opp) => {
    setBannerSuccess('')
    setBannerError('')
    setEditFormError('')
    setEditingOpportunity(opp)

    // Normalize time to HH:MM for time inputs
    const cleanTime = (t) => (t && t.length > 5 ? t.slice(0, 5) : t || '')
    // Normalize date to YYYY-MM-DD
    const cleanDate = (d) => {
      if (!d) return ''
      try {
        const dt = new Date(d)
        if (isNaN(dt.getTime())) return d
        return dt.toISOString().split('T')[0]
      } catch {
        return d
      }
    }

    setEditForm({
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
  }

  const handleCloseEdit = () => {
    if (editSubmitting) return
    setEditingOpportunity(null)
    if (urlId) {
      navigate('/manage-opportunities')
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingOpportunity || editSubmitting) return

    setEditFormError('')
    setBannerSuccess('')
    setBannerError('')

    if (!editForm.title.trim() || editForm.title.trim().length < 2) {
      setEditFormError('Title must be at least 2 characters.')
      return
    }
    if (!editForm.event_date) {
      setEditFormError('Event date is required.')
      return
    }
    if (!editForm.start_time || !editForm.end_time) {
      setEditFormError('Both start and end times are required.')
      return
    }
    if (editForm.end_time < editForm.start_time) {
      setEditFormError('End time must not be earlier than start time.')
      return
    }
    const capNum = Number(editForm.capacity)
    if (!capNum || capNum <= 0) {
      setEditFormError('Capacity must be a positive integer greater than zero.')
      return
    }

    // Active signups check
    const activeSignups = editingOpportunity.active_signups ?? 0
    if (capNum < activeSignups) {
      setEditFormError(
        `Cannot reduce capacity to ${capNum}. There are currently ${activeSignups} registered volunteer(s).`
      )
      return
    }

    setEditSubmitting(true)
    try {
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        category: editForm.category,
        event_date: editForm.event_date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        location: editForm.location.trim() || 'Location TBD',
        address: editForm.address.trim() || null,
        capacity: capNum,
        status: editForm.status,
      }

      await updateOpportunityApi(editingOpportunity.id, payload, token)
      setBannerSuccess(`Opportunity "${payload.title}" updated successfully!`)
      setEditingOpportunity(null)
      await loadData()
      if (refetchGlobalOpportunities) refetchGlobalOpportunities()
      if (urlId) {
        navigate('/manage-opportunities')
      }
    } catch (err) {
      setEditFormError(err.message || 'Failed to update opportunity. Please verify all fields.')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Filtered & Derived Opportunities ────────────────────────────────────
  const filteredOpportunities = opportunities.filter((item) => {
    const matchesStatus =
      statusFilter === 'all' ? true : item.status === statusFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      item.title?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  // Summary Metrics
  const totalCount = opportunities.length
  const publishedCount = opportunities.filter((o) => o.status === 'PUBLISHED').length
  const draftCount = opportunities.filter((o) => o.status === 'DRAFT').length
  const totalVolunteers = opportunities.reduce(
    (acc, o) => acc + (Number(o.active_signups) || 0),
    0
  )

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'Date TBD'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatTimeDisplay = (st, et) => {
    if (!st) return ''
    const fmt = (t) => {
      const [h, m] = t.split(':')
      const d = new Date()
      d.setHours(Number(h), Number(m))
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    if (et) return `${fmt(st)} – ${fmt(et)}`
    return fmt(st)
  }

  return (
    <main className="manage-opps-page">
      <div className="manage-opps-container">
        {/* Header */}
        <header className="manage-opps-header">
          <div>
            <h1>Manage Opportunities</h1>
            <p>Create, monitor, and update volunteer events for your organizations.</p>
          </div>
          <div className="header-action-group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreate}
              disabled={organizations.length === 0}
            >
              + Create Opportunity
            </button>
            <Link to="/organizations" className="btn btn-secondary">
              My Organizations
            </Link>
          </div>
        </header>

        {/* Global Action Banners */}
        {bannerSuccess && (
          <div className="alert-success" role="alert">
            {bannerSuccess}
          </div>
        )}
        {bannerError && (
          <div className="alert-error" role="alert">
            {bannerError}
          </div>
        )}
        {error && (
          <div className="alert-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={loadData}>
              Retry
            </button>
          </div>
        )}

        {/* Missing Organizations Guidance Notice */}
        {!loading && organizations.length === 0 && (
          <div className="alert-error">
            <strong>Organization Required:</strong> You do not own any organizations yet. You must{' '}
            <Link to="/organizations" style={{ textDecoration: 'underline', fontWeight: 700, color: 'inherit' }}>
              create an organization
            </Link>{' '}
            before you can publish volunteer opportunities.
          </div>
        )}

        {/* Stat Metric Cards */}
        <section className="manage-stats-grid">
          <div className="manage-stat-card">
            <span className="manage-stat-label">Total Managed</span>
            <span className="manage-stat-value">{totalCount}</span>
          </div>
          <div className="manage-stat-card">
            <span className="manage-stat-label">Published (Active)</span>
            <span className="manage-stat-value">{publishedCount}</span>
          </div>
          <div className="manage-stat-card">
            <span className="manage-stat-label">Drafts</span>
            <span className="manage-stat-value">{draftCount}</span>
          </div>
          <div className="manage-stat-card">
            <span className="manage-stat-label">Volunteers Registered</span>
            <span className="manage-stat-value">{totalVolunteers}</span>
          </div>
        </section>

        {/* Filters & Search Control Bar */}
        <section className="manage-controls">
          <nav className="manage-tabs" aria-label="Status filter">
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All <span className="tab-badge">{opportunities.length}</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'PUBLISHED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PUBLISHED')}
            >
              Published <span className="tab-badge">{publishedCount}</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'DRAFT' ? 'active' : ''}`}
              onClick={() => setStatusFilter('DRAFT')}
            >
              Drafts <span className="tab-badge">{draftCount}</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('COMPLETED')}
            >
              Completed{' '}
              <span className="tab-badge">
                {opportunities.filter((o) => o.status === 'COMPLETED').length}
              </span>
            </button>
            <button
              type="button"
              className={`tab-btn ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('CANCELLED')}
            >
              Cancelled{' '}
              <span className="tab-badge">
                {opportunities.filter((o) => o.status === 'CANCELLED').length}
              </span>
            </button>
          </nav>

          <input
            type="text"
            className="manage-search-input"
            placeholder="Search by title, location, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </section>

        {/* Content Body */}
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading your managed opportunities...</p>
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="empty-manage-card">
            <div className="empty-icon">📁</div>
            <h3>
              {statusFilter === 'all'
                ? 'No Opportunities Found'
                : `No ${statusFilter.toLowerCase()} opportunities`}
            </h3>
            <p>
              {opportunities.length === 0
                ? 'You have not created any opportunities yet. Create an opportunity to recruit volunteers for your community initiatives!'
                : 'No opportunities match your current filter and search criteria.'}
            </p>
            {organizations.length > 0 ? (
              <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
                + Create Your First Opportunity
              </button>
            ) : (
              <Link to="/organizations" className="btn btn-primary">
                + Create an Organization First
              </Link>
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
                    <span className={`status-badge badge-${opp.status?.toLowerCase() || 'published'}`}>
                      {opp.status}
                    </span>
                    <span className="opp-date-pill">{formatDateDisplay(opp.event_date)}</span>
                  </div>

                  <h2 className="manage-opp-title">
                    <Link to={`/opportunities/${opp.id}`}>{opp.title}</Link>
                  </h2>

                  <p className="manage-opp-org">
                    Org: <strong>{opp.organization_name || 'My Organization'}</strong>
                  </p>

                  <div className="manage-opp-meta">
                    <div className="meta-row">
                      <span>⏰</span>
                      <span>{formatTimeDisplay(opp.start_time, opp.end_time)}</span>
                    </div>
                    <div className="meta-row">
                      <span>📍</span>
                      <span>{opp.location || 'Location TBD'}</span>
                    </div>
                    {opp.category && (
                      <div className="meta-row">
                        <span>🏷️</span>
                        <span>{opp.category}</span>
                      </div>
                    )}
                  </div>

                  {/* Capacity Bar */}
                  <div className="capacity-container">
                    <div className="capacity-labels">
                      <span>Volunteers</span>
                      <span>
                        {activeSignups} / {capacity} spots filled
                      </span>
                    </div>
                    <div className="capacity-bar-bg">
                      <div className="capacity-bar-fill" style={{ width: `${percentFilled}%` }} />
                    </div>
                  </div>

                  <div className="manage-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEdit(opp)}
                    >
                      ✏️ Edit Opportunity
                    </button>
                    <Link to={`/opportunities/${opp.id}`} className="btn btn-outline btn-sm">
                      Public View →
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* ── CREATE OPPORTUNITY MODAL ────────────────────────────────────── */}
        {isCreateOpen && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <div className="opportunity-form-card">
              <div className="modal-header">
                <h2 id="create-title">Create New Volunteer Opportunity</h2>
                <button
                  type="button"
                  className="btn-close-modal"
                  onClick={handleCloseCreate}
                  disabled={createSubmitting}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {createFormError && (
                <div style={{ margin: '1rem 1.5rem 0' }} className="alert-error" role="alert">
                  {createFormError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="opportunity-form">
                {/* Organization Selection */}
                <div className="form-group">
                  <label htmlFor="createOrg">Organization *</label>
                  <select
                    id="createOrg"
                    value={createForm.organization_id}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, organization_id: e.target.value }))
                    }
                    disabled={createSubmitting}
                    required
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">Opportunities must belong to one of your organizations.</span>
                </div>

                {/* Title */}
                <div className="form-group">
                  <label htmlFor="createTitle">Opportunity Title *</label>
                  <input
                    type="text"
                    id="createTitle"
                    placeholder="e.g. Community Garden Spring Planting"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    disabled={createSubmitting}
                    required
                    minLength={2}
                    maxLength={255}
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label htmlFor="createDesc">Description</label>
                  <textarea
                    id="createDesc"
                    rows="3"
                    placeholder="Describe tasks, objectives, what volunteers should bring, etc."
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    disabled={createSubmitting}
                    maxLength={5000}
                  />
                </div>

                {/* Category & Status */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="createCategory">Category</label>
                    <select
                      id="createCategory"
                      value={createForm.category}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, category: e.target.value }))
                      }
                      disabled={createSubmitting}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="createStatus">Status</label>
                    <select
                      id="createStatus"
                      value={createForm.status}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, status: e.target.value }))
                      }
                      disabled={createSubmitting}
                    >
                      <option value="PUBLISHED">PUBLISHED (Visible to Volunteers)</option>
                      <option value="DRAFT">DRAFT (Hidden)</option>
                    </select>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="createDate">Event Date *</label>
                    <input
                      type="date"
                      id="createDate"
                      value={createForm.event_date}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, event_date: e.target.value }))
                      }
                      disabled={createSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="createCapacity">Volunteer Capacity *</label>
                    <input
                      type="number"
                      id="createCapacity"
                      min="1"
                      value={createForm.capacity}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, capacity: e.target.value }))
                      }
                      disabled={createSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="createStartTime">Start Time *</label>
                    <input
                      type="time"
                      id="createStartTime"
                      value={createForm.start_time}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, start_time: e.target.value }))
                      }
                      disabled={createSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="createEndTime">End Time *</label>
                    <input
                      type="time"
                      id="createEndTime"
                      value={createForm.end_time}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, end_time: e.target.value }))
                      }
                      disabled={createSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Location & Address */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="createLocation">Location Name</label>
                    <input
                      type="text"
                      id="createLocation"
                      placeholder="e.g. City Park East Gate"
                      value={createForm.location}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, location: e.target.value }))
                      }
                      disabled={createSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="createAddress">Full Street Address</label>
                    <input
                      type="text"
                      id="createAddress"
                      placeholder="e.g. 123 Community Blvd, Suite 400"
                      value={createForm.address}
                      onChange={(e) =>
                        setCreateForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                      disabled={createSubmitting}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="form-actions-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseCreate}
                    disabled={createSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createSubmitting}>
                    {createSubmitting ? 'Creating Opportunity...' : 'Create Opportunity'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── EDIT OPPORTUNITY MODAL ──────────────────────────────────────── */}
        {editingOpportunity && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="opportunity-form-card">
              <div className="modal-header">
                <h2 id="edit-title">Edit Opportunity: {editingOpportunity.title}</h2>
                <button
                  type="button"
                  className="btn-close-modal"
                  onClick={handleCloseEdit}
                  disabled={editSubmitting}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {editFormError && (
                <div style={{ margin: '1rem 1.5rem 0' }} className="alert-error" role="alert">
                  {editFormError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="opportunity-form">
                {/* Title */}
                <div className="form-group">
                  <label htmlFor="editTitle">Opportunity Title *</label>
                  <input
                    type="text"
                    id="editTitle"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    disabled={editSubmitting}
                    required
                    minLength={2}
                    maxLength={255}
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label htmlFor="editDesc">Description</label>
                  <textarea
                    id="editDesc"
                    rows="3"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    disabled={editSubmitting}
                    maxLength={5000}
                  />
                </div>

                {/* Category & Status */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="editCategory">Category</label>
                    <select
                      id="editCategory"
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, category: e.target.value }))
                      }
                      disabled={editSubmitting}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="editStatus">Status</label>
                    <select
                      id="editStatus"
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, status: e.target.value }))
                      }
                      disabled={editSubmitting}
                    >
                      <option value="PUBLISHED">PUBLISHED</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>

                {/* Date & Capacity */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="editDate">Event Date *</label>
                    <input
                      type="date"
                      id="editDate"
                      value={editForm.event_date}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, event_date: e.target.value }))
                      }
                      disabled={editSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="editCapacity">
                      Volunteer Capacity * (Active signups: {editingOpportunity.active_signups ?? 0})
                    </label>
                    <input
                      type="number"
                      id="editCapacity"
                      min={Math.max(1, editingOpportunity.active_signups ?? 1)}
                      value={editForm.capacity}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, capacity: e.target.value }))
                      }
                      disabled={editSubmitting}
                      required
                    />
                    <span className="form-hint">
                      Cannot be reduced below active signups count ({editingOpportunity.active_signups ?? 0}).
                    </span>
                  </div>
                </div>

                {/* Time */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="editStartTime">Start Time *</label>
                    <input
                      type="time"
                      id="editStartTime"
                      value={editForm.start_time}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, start_time: e.target.value }))
                      }
                      disabled={editSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="editEndTime">End Time *</label>
                    <input
                      type="time"
                      id="editEndTime"
                      value={editForm.end_time}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, end_time: e.target.value }))
                      }
                      disabled={editSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Location & Address */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="editLocation">Location Name</label>
                    <input
                      type="text"
                      id="editLocation"
                      value={editForm.location}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, location: e.target.value }))
                      }
                      disabled={editSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="editAddress">Address</label>
                    <input
                      type="text"
                      id="editAddress"
                      value={editForm.address}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                      disabled={editSubmitting}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="form-actions-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseEdit}
                    disabled={editSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                    {editSubmitting ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default ManageOpportunities
