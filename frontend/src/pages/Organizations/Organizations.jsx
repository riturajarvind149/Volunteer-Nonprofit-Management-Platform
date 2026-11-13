import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationsApi, createOrganizationApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, OrgInitials } from '../../components/ui'
import { formatDate, pluralize } from '../../utils/format'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import './Organizations.css'

function CreateOrganizationForm({ onCreated, onCancel }) {
  const { token } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Enter the organization’s name.')
      return
    }
    setNameError('')
    setError('')
    setSaving(true)
    try {
      const res = await createOrganizationApi({ name: name.trim(), description: description.trim() }, token)
      const created = res?.data?.organization
      onCreated(created?.name || name.trim(), created?.verification_status)
    } catch (err) {
      setError(err.message || 'The organization could not be created.')
      setSaving(false)
    }
  }

  return (
    <form className="panel org-create" onSubmit={handleSubmit} noValidate>
      <div className="panel-header">
        <h2>New organization</h2>
      </div>
      <div className="panel-body org-create-body">
        {error && <Alert>{error}</Alert>}
        <div className="field">
          <label className="field-label" htmlFor="org-name">Name<span className="req" aria-hidden="true">*</span></label>
          <input
            id="org-name"
            className="input"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError('') }}
            disabled={saving}
            maxLength={255}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'org-name-error' : undefined}
            required
          />
          {nameError && <span id="org-name-error" className="field-error">{nameError}</span>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="org-desc">Description<span className="opt">(optional)</span></label>
          <textarea
            id="org-desc"
            className="textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            aria-describedby="org-desc-hint"
          />
          <span id="org-desc-hint" className="field-hint">Shown to volunteers on the organization’s page.</span>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create organization'}</button>
        </div>
      </div>
    </form>
  )
}

function Organizations() {
  const { user, token } = useAuth()
  const [params, setParams] = useSearchParams()
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  const isCoordinator = user?.role === 'COORDINATOR'
  const showForm = isCoordinator && params.get('new') === '1'
  const setShowForm = (open) => setParams(open ? { new: '1' } : {}, { replace: true })

  const debouncedQuery = useDebouncedValue(query.trim(), 300)

  const load = useCallback(async () => {
    setError('')
    try {
      // Server-side search; approved organizations plus a coordinator's own.
      const res = await getOrganizationsApi(token, { q: debouncedQuery, limit: 100 })
      setOrganizations(res?.data?.organizations || [])
    } catch (err) {
      setError(err.message || 'Organizations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, debouncedQuery])

  useEffect(() => { load() }, [load])

  const handleCreated = (name, verificationStatus) => {
    setShowForm(false)
    setNotice(
      verificationStatus === 'PENDING'
        ? `“${name}” was created and sent for verification. You can prepare opportunities as drafts now; you’ll be notified when it’s approved and can publish.`
        : `“${name}” was created. You can now publish opportunities under it.`
    )
    load()
  }

  const filtered = organizations

  return (
    <div className="page">
      <PageHeader
        title="Organizations"
        description="Nonprofits and community groups that publish opportunities on ServeHub."
        actions={isCoordinator && !showForm && (
          <button type="button" className="btn btn-primary" onClick={() => { setNotice(''); setShowForm(true) }}>
            <Icon name="plus" size={15} /> New organization
          </button>
        )}
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {showForm && <CreateOrganizationForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />}

      <div className="org-toolbar">
        <label className="search">
          <span className="sr-only">Search organizations</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            className="input"
            placeholder="Search by name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {!loading && <p className="muted" aria-live="polite">{pluralize(filtered.length, 'organization')}</p>}
      </div>

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading organizations…" />
      ) : filtered.length === 0 ? (
        <div className="panel">
          {organizations.length === 0 && !debouncedQuery ? (
            <EmptyState icon="building" title="No organizations yet">
              {isCoordinator ? 'Create the first one to start publishing opportunities.' : 'Organizations appear here once a coordinator registers one.'}
            </EmptyState>
          ) : (
            <EmptyState
              icon="search"
              title={`No organizations match “${query}”`}
              action={<button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>Clear search</button>}
            />
          )}
        </div>
      ) : (
        <ul role="list" className="org-list">
          {filtered.map((org) => (
            <li key={org.id}>
              <Link to={`/organizations/${org.id}`} className="org-row">
                <OrgInitials name={org.name} />
                <div className="org-row-main">
                  <h2 className="org-row-name">
                    {org.name}
                    {org.coordinator_id === user?.id && <span className="badge badge-info">Yours</span>}
                    {org.coordinator_id === user?.id && org.verification_status === 'PENDING' && (
                      <span className="badge badge-warning">Pending verification</span>
                    )}
                    {org.coordinator_id === user?.id && ['REJECTED', 'SUSPENDED'].includes(org.verification_status) && (
                      <span className="badge badge-danger">{org.verification_status === 'REJECTED' ? 'Rejected' : 'Suspended'}</span>
                    )}
                  </h2>
                  <p className="org-row-desc">{org.description || 'No description provided.'}</p>
                  {Number(org.open_opportunities) > 0 && (
                    <p className="org-row-open">{pluralize(Number(org.open_opportunities), 'open opportunity', 'open opportunities')}</p>
                  )}
                </div>
                <span className="org-row-date">Joined {formatDate(org.created_at, { day: undefined })}</span>
                <Icon name="chevron-right" size={18} className="org-row-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Organizations
