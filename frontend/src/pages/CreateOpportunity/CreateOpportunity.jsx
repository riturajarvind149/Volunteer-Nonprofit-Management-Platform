import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOrganizationsApi } from '../../services/api'
import './CreateOpportunity.css'

const CATEGORIES = ['Hunger & Food', 'Education', 'Environment', 'Animal Welfare', 'Community Support', 'Health & Wellness', 'Arts & Culture', 'Other']

const EMPTY = { organization_id: '', title: '', description: '', category: '', event_date: '', start_time: '', end_time: '', location: '', address: '', capacity: '' }

function CreateOpportunity() {
  const { user, token, loading: authLoading, isAuthenticated } = useAuth()
  const { createOpportunity } = useOpportunities()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orgs, setOrgs] = useState([])
  const [orgsLoading, setOrgsLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setOrgsLoading(true)
    getOrganizationsApi(token)
      .then((res) => setOrgs(res?.data?.organizations || []))
      .catch(() => setOrgs([]))
      .finally(() => setOrgsLoading(false))
  }, [token])

  if (authLoading) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role !== 'COORDINATOR') {
    return (
      <main className="create-opp-page">
        <div className="create-opp-container">
          <div className="access-denied">
            <h2>Access Restricted</h2>
            <p>Only NGO Coordinators can post volunteer opportunities.</p>
            <Link to="/opportunities" className="btn btn-secondary">Browse Opportunities</Link>
          </div>
        </div>
      </main>
    )
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (serverError) setServerError('')
  }

  const validate = () => {
    const errs = {}
    if (!form.organization_id) errs.organization_id = 'Select an organization'
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.event_date) errs.event_date = 'Event date is required'
    if (!form.start_time) errs.start_time = 'Start time is required'
    if (!form.end_time) errs.end_time = 'End time is required'
    if (form.start_time && form.end_time && form.start_time >= form.end_time) errs.end_time = 'End time must be after start time'
    if (!form.location.trim()) errs.location = 'Location is required'
    const cap = Number(form.capacity)
    if (!form.capacity || isNaN(cap) || cap < 1 || !Number.isInteger(cap)) errs.capacity = 'Capacity must be a positive whole number'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      await createOpportunity({ ...form, capacity: Number(form.capacity) })
      navigate('/opportunities', { state: { message: 'Opportunity created successfully!' } })
    } catch (err) {
      setServerError(err.message || 'Failed to create opportunity. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="create-opp-page">
      <div className="create-opp-container">
        <Link to="/opportunities" className="back-btn">← Back to Opportunities</Link>

        <div className="create-opp-card">
          <div className="create-opp-header">
            <h1>Post a New Opportunity</h1>
            <p>Share a volunteer opportunity with the ServeHub community.</p>
          </div>

          {serverError && <div className="alert-error">{serverError}</div>}

          <form onSubmit={handleSubmit} className="create-opp-form" noValidate>
            <div className="form-section">
              <h2>Basic Details</h2>

              <div className="form-group">
                <label htmlFor="organization_id">Organization *</label>
                {orgsLoading ? (
                  <p className="field-note">Loading your organizations...</p>
                ) : orgs.length === 0 ? (
                  <p className="field-note field-warn">
                    You have no organizations yet. <Link to="/organizations">Create one first →</Link>
                  </p>
                ) : (
                  <select id="organization_id" name="organization_id" value={form.organization_id} onChange={handleChange} className={errors.organization_id ? 'input-error' : ''}>
                    <option value="">Select an organization</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                )}
                {errors.organization_id && <span className="error-text">{errors.organization_id}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input id="title" name="title" type="text" placeholder="e.g. Community Food Drive" value={form.title} onChange={handleChange} className={errors.title ? 'input-error' : ''} />
                {errors.title && <span className="error-text">{errors.title}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select id="category" name="category" value={form.category} onChange={handleChange}>
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" rows="4" placeholder="Describe the volunteer activity, its purpose, and what volunteers will do..." value={form.description} onChange={handleChange} />
              </div>
            </div>

            <div className="form-section">
              <h2>Date & Time</h2>
              <div className="form-row-3">
                <div className="form-group">
                  <label htmlFor="event_date">Event Date *</label>
                  <input id="event_date" name="event_date" type="date" value={form.event_date} onChange={handleChange} className={errors.event_date ? 'input-error' : ''} />
                  {errors.event_date && <span className="error-text">{errors.event_date}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="start_time">Start Time *</label>
                  <input id="start_time" name="start_time" type="time" value={form.start_time} onChange={handleChange} className={errors.start_time ? 'input-error' : ''} />
                  {errors.start_time && <span className="error-text">{errors.start_time}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="end_time">End Time *</label>
                  <input id="end_time" name="end_time" type="time" value={form.end_time} onChange={handleChange} className={errors.end_time ? 'input-error' : ''} />
                  {errors.end_time && <span className="error-text">{errors.end_time}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2>Location & Capacity</h2>
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="location">Location / Venue *</label>
                  <input id="location" name="location" type="text" placeholder="e.g. Downtown Community Center" value={form.location} onChange={handleChange} className={errors.location ? 'input-error' : ''} />
                  {errors.location && <span className="error-text">{errors.location}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="capacity">Volunteer Spots *</label>
                  <input id="capacity" name="capacity" type="number" min="1" placeholder="e.g. 20" value={form.capacity} onChange={handleChange} className={errors.capacity ? 'input-error' : ''} />
                  {errors.capacity && <span className="error-text">{errors.capacity}</span>}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="address">Full Address</label>
                <input id="address" name="address" type="text" placeholder="e.g. 123 Main St, Springfield" value={form.address} onChange={handleChange} />
              </div>
            </div>

            <div className="form-actions">
              <Link to="/opportunities" className="btn btn-secondary">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={submitting || orgs.length === 0}>
                {submitting ? 'Publishing...' : 'Publish Opportunity'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

export default CreateOpportunity
