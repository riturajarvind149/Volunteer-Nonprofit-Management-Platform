import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getMyOrganizationsApi, getOpportunityByIdApi } from '../../services/api'
import { CATEGORIES } from '../../utils/categories'
import { PageHeader, LoadingState, EmptyState, Alert } from '../../components/ui'
import { toInputDate } from '../../utils/format'
import { parseSkills } from '../../utils/skills'
import './OpportunityForm.css'


const BLANK = {
  organization_id: '',
  title: '',
  description: '',
  category: 'Community Support',
  event_date: '',
  start_time: '09:00',
  end_time: '12:00',
  location: '',
  address: '',
  capacity: '10',
  status: 'PUBLISHED',
  skills: '',
  cancellation_reason: '',
}

function fromOpportunity(o) {
  return {
    organization_id: o.organization_id || '',
    title: o.title || '',
    description: o.description || '',
    category: o.category || '',
    event_date: toInputDate(o.event_date),
    start_time: (o.start_time || '').slice(0, 5),
    end_time: (o.end_time || '').slice(0, 5),
    location: o.location === 'Location TBD' ? '' : o.location || '',
    address: o.address || '',
    capacity: String(o.capacity ?? ''),
    status: o.status || 'DRAFT',
    skills: (o.skills_required || []).join(', '),
    cancellation_reason: o.cancellation_reason || '',
  }
}

function validate(form, { isEdit, activeSignups }) {
  const errors = {}
  if (!isEdit && !form.organization_id) errors.organization_id = 'Choose the organization running this opportunity.'
  if (form.title.trim().length < 2) errors.title = 'Enter a title of at least 2 characters.'
  if (!form.event_date) errors.event_date = 'Choose the date of the event.'
  if (!form.start_time) errors.start_time = 'Enter a start time.'
  if (!form.end_time) errors.end_time = 'Enter an end time.'
  else if (form.start_time && form.end_time < form.start_time) errors.end_time = 'The end time can’t be earlier than the start time.'
  const capacity = Number(form.capacity)
  if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Enter a whole number of 1 or more.'
  else if (isEdit && capacity < activeSignups) errors.capacity = `${activeSignups} volunteers are already registered, so capacity can’t go below that.`
  const skills = parseSkills(form.skills)
  if (skills.some((s) => s.length > 50)) errors.skills = 'Keep each skill under 50 characters.'
  if (form.cancellation_reason.length > 1000) errors.cancellation_reason = 'Keep the reason under 1000 characters.'
  return errors
}

function Field({ id, label, required, optional, hint, error, children }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true">*</span>}
        {optional && <span className="opt">(optional)</span>}
      </label>
      {children}
      {hint && !error && <span id={`${id}-hint`} className="field-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="field-error">{error}</span>}
    </div>
  )
}

function OpportunityForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [searchParams] = useSearchParams()
  const orgParam = searchParams.get('org')
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const { createOpportunity, updateOpportunity } = useOpportunities()

  const [form, setForm] = useState(BLANK)
  const [organizations, setOrganizations] = useState([])
  const [original, setOriginal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [orgsRes, oppRes] = await Promise.all([
          getMyOrganizationsApi(token),
          isEdit ? getOpportunityByIdApi(id, token) : Promise.resolve(null),
        ])
        if (!active) return
        const mine = (orgsRes?.data?.organizations || []).filter((org) => org.coordinator_id === user.id)
        setOrganizations(mine)
        if (isEdit) {
          const opportunity = oppRes?.data?.opportunity
          setOriginal(opportunity)
          if (opportunity) setForm(fromOpportunity(opportunity))
        } else {
          const preselected = mine.find((org) => org.id === orgParam) || mine[0]
          setForm({
            ...BLANK,
            organization_id: preselected?.id || '',
            // Unverified organizations can only save drafts.
            status: preselected && preselected.verification_status && preselected.verification_status !== 'APPROVED' ? 'DRAFT' : 'PUBLISHED',
          })
        }
      } catch (err) {
        if (active) setLoadError(err.message || 'The form could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [id, isEdit, token, user.id, orgParam])

  if (loading) return <LoadingState label="Loading…" />

  const back = { to: '/manage-opportunities', label: 'Opportunities' }

  if (loadError || (isEdit && !original)) {
    return (
      <div className="page page-narrow">
        <PageHeader title={isEdit ? 'Edit opportunity' : 'New opportunity'} back={back} />
        <Alert>{loadError || 'This opportunity could not be found.'}</Alert>
      </div>
    )
  }

  if (isEdit && original.coordinator_id !== user.id) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Edit opportunity" back={back} />
        <div className="panel">
          <EmptyState icon="shield" title="You can’t edit this opportunity">
            Only the coordinator of the organization that published it can make changes.
          </EmptyState>
        </div>
      </div>
    )
  }

  if (!isEdit && organizations.length === 0) {
    return (
      <div className="page page-narrow">
        <PageHeader title="New opportunity" back={back} />
        <div className="panel">
          <EmptyState
            icon="building"
            title="Create an organization first"
            action={<Link to="/organizations?new=1" className="btn btn-primary">Create organization</Link>}
          >
            Every opportunity belongs to an organization you manage.
          </EmptyState>
        </div>
      </div>
    )
  }

  const activeSignups = Number(original?.active_signups || 0)
  const selectedOrg = organizations.find((org) => org.id === (isEdit ? original?.organization_id : form.organization_id))
  const orgVerified = !selectedOrg?.verification_status || selectedOrg.verification_status === 'APPROVED'
  const canPublish = orgVerified || original?.status === 'PUBLISHED'
  const cancelling = isEdit && form.status === 'CANCELLED' && original?.status !== 'CANCELLED'
  const scheduleChanged = isEdit && original && (
    form.event_date !== toInputDate(original.event_date)
    || form.start_time !== (original.start_time || '').slice(0, 5)
    || form.end_time !== (original.end_time || '').slice(0, 5)
    || form.location.trim() !== fromOpportunity(original).location
  )

  const setField = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // Switching to an unverified organization can't keep "Published".
      if (field === 'organization_id') {
        const org = organizations.find((o) => o.id === value)
        if (org?.verification_status && org.verification_status !== 'APPROVED' && next.status === 'PUBLISHED') next.status = 'DRAFT'
      }
      return next
    })
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const inputProps = (field) => ({
    id: field,
    value: form[field],
    onChange: setField(field),
    disabled: saving,
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${field}-error` : `${field}-hint`,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate(form, { isEdit, activeSignups })
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      document.getElementById(Object.keys(validationErrors)[0])?.focus()
      return
    }

    setSubmitError('')
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category || null,
      event_date: form.event_date,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location.trim() || 'Location TBD',
      address: form.address.trim() || null,
      capacity: Number(form.capacity),
      status: form.status,
      skills_required: parseSkills(form.skills),
    }
    if (isEdit && form.status === 'CANCELLED') {
      payload.cancellation_reason = form.cancellation_reason.trim() || null
    }
    try {
      if (isEdit) await updateOpportunity(id, payload)
      else await createOpportunity({ ...payload, organization_id: form.organization_id })
      navigate('/manage-opportunities', {
        state: {
          notice: cancelling
            ? `“${payload.title}” was cancelled. Registered volunteers have been notified.`
            : isEdit
              ? `Changes to “${payload.title}” were saved.${scheduleChanged && activeSignups > 0 ? ' Registered volunteers were notified of the new details.' : ''}`
              : `“${payload.title}” was ${payload.status === 'DRAFT' ? 'saved as a draft' : 'created'}.`,
        },
      })
    } catch (err) {
      setSubmitError(err.message || 'The opportunity could not be saved. Check the details and try again.')
      setSaving(false)
    }
  }

  const categoryOptions = form.category && !CATEGORIES.includes(form.category) ? [form.category, ...CATEGORIES] : CATEGORIES

  return (
    <div className="page opp-form-page">
      <PageHeader
        title={isEdit ? 'Edit opportunity' : 'New opportunity'}
        description={isEdit ? original.title : 'Fields marked * are required.'}
        back={back}
      />

      {submitError && <Alert>{submitError}</Alert>}

      <form className="opp-form" onSubmit={handleSubmit} noValidate>
        <section className="opp-form-section" aria-labelledby="basics-title">
          <div className="opp-form-intro">
            <h2 id="basics-title">Basics</h2>
            <p>What volunteers will see first when browsing.</p>
          </div>
          <div className="opp-form-fields">
            {!isEdit && (
              <Field id="organization_id" label="Organization" required error={errors.organization_id}>
                <select className="select" {...inputProps('organization_id')}>
                  {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </Field>
            )}
            <Field id="title" label="Title" required error={errors.title} hint="For example: Saturday food bank sorting shift">
              <input className="input" maxLength={255} {...inputProps('title')} />
            </Field>
            <Field id="category" label="Category" error={errors.category}>
              <select className="select" {...inputProps('category')}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="description" label="Description" optional hint="Tasks, what to bring, who to ask for on arrival.">
              <textarea className="textarea" rows={6} maxLength={5000} {...inputProps('description')} />
            </Field>
            <Field
              id="skills"
              label="Helpful skills"
              optional
              error={errors.skills}
              hint="Separate with commas, e.g. First aid, Lifting, Hindi. Volunteers can filter by these."
            >
              <input className="input" maxLength={1000} {...inputProps('skills')} />
            </Field>
          </div>
        </section>

        <section className="opp-form-section" aria-labelledby="when-title">
          <div className="opp-form-intro">
            <h2 id="when-title">When and where</h2>
            <p>Shown on the listing and in each volunteer’s schedule.</p>
          </div>
          <div className="opp-form-fields">
            <div className="form-row">
              <Field id="event_date" label="Date" required error={errors.event_date}>
                <input type="date" className="input" {...inputProps('event_date')} />
              </Field>
              <Field id="start_time" label="Starts" required error={errors.start_time}>
                <input type="time" className="input" {...inputProps('start_time')} />
              </Field>
              <Field id="end_time" label="Ends" required error={errors.end_time}>
                <input type="time" className="input" {...inputProps('end_time')} />
              </Field>
            </div>
            <Field id="location" label="Location name" optional hint="Leave blank to show “Location TBD”.">
              <input className="input" maxLength={255} {...inputProps('location')} />
            </Field>
            <Field id="address" label="Street address" optional>
              <input className="input" {...inputProps('address')} />
            </Field>
            {scheduleChanged && activeSignups > 0 && form.status === 'PUBLISHED' && (
              <Alert tone="info">
                {activeSignups} registered {activeSignups === 1 ? 'volunteer' : 'volunteers'} will be emailed about the new date, time or place when you save.
              </Alert>
            )}
          </div>
        </section>

        <section className="opp-form-section" aria-labelledby="capacity-title">
          <div className="opp-form-intro">
            <h2 id="capacity-title">Capacity and visibility</h2>
            <p>Registration closes automatically when every spot is taken.</p>
          </div>
          <div className="opp-form-fields">
            <Field
              id="capacity"
              label="Volunteer spots"
              required
              error={errors.capacity}
              hint={isEdit ? `${activeSignups} currently registered.` : undefined}
            >
              <input type="number" min={Math.max(1, activeSignups)} step={1} className="input opp-form-capacity" {...inputProps('capacity')} />
            </Field>
            <fieldset className="opp-form-status" disabled={saving}>
              <legend className="field-label">Status</legend>
              {[
                { value: 'PUBLISHED', label: 'Published', desc: 'Listed for volunteers and open for registration.' },
                { value: 'DRAFT', label: 'Draft', desc: 'Hidden from volunteers until you publish it.' },
                ...(isEdit ? [
                  { value: 'COMPLETED', label: 'Completed', desc: 'The event has taken place.' },
                  { value: 'CANCELLED', label: 'Cancelled', desc: 'The event won’t go ahead. Registration closes.' },
                ] : []),
              ].map((option) => {
                const locked = option.value === 'PUBLISHED' && !canPublish
                return (
                  <label key={option.value} className={`status-option${locked ? ' is-disabled' : ''}`}>
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={form.status === option.value}
                      onChange={setField('status')}
                      disabled={locked}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <span className="muted">
                        {locked
                          ? 'Available once an administrator verifies your organization. Save as a draft for now.'
                          : option.desc}
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
            {cancelling && (
              <div className="opp-form-cancel">
                <Alert tone="info">
                  {activeSignups > 0
                    ? `${activeSignups} registered ${activeSignups === 1 ? 'volunteer' : 'volunteers'} will be emailed that this event is cancelled.`
                    : 'Nobody is registered yet, so no one needs to be notified.'}
                </Alert>
                <Field
                  id="cancellation_reason"
                  label="Reason for cancelling"
                  optional
                  error={errors.cancellation_reason}
                  hint="Included in the email and shown on the listing, e.g. “Heavy rain forecast”."
                >
                  <textarea className="textarea" rows={3} maxLength={1000} {...inputProps('cancellation_reason')} />
                </Field>
              </div>
            )}
          </div>
        </section>

        <div className="opp-form-footer">
          <Link to="/manage-opportunities" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className={`btn btn-lg ${cancelling ? 'btn-danger' : 'btn-primary'}`} disabled={saving}>
            {saving ? 'Saving…' : cancelling ? 'Cancel this event' : isEdit ? 'Save changes' : form.status === 'DRAFT' ? 'Save draft' : 'Publish opportunity'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default OpportunityForm
