import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { closeOrganizationApi, getAdminOrganizationsApi, reviewOrganizationApi } from '../../services/api'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import Icon from '../../components/Icon'
import Pagination from '../../components/Pagination'
import { PageHeader, LoadingState, Alert, EmptyState, OrgInitials, StatusBadge } from '../../components/ui'
import { formatDate } from '../../utils/format'
import { registrationTypeLabel } from '../../utils/ngo'
import { useAutoLoad } from '../../hooks/useAutoLoad'
import './Admin.css'

const STATUS_TABS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'CLOSED', label: 'Closed' },
  { key: '', label: 'All' },
]

const VERIFICATION_LABELS = { PENDING: 'Pending review', APPROVED: 'Approved', REJECTED: 'Rejected', SUSPENDED: 'Suspended', CLOSED: 'Closed' }

/** Which decisions make sense from each state. */
const ACTIONS = {
  PENDING: [
    { status: 'APPROVED', label: 'Approve', tone: 'primary' },
    { status: 'REJECTED', label: 'Reject', tone: 'danger', needsNote: true },
  ],
  APPROVED: [{ status: 'SUSPENDED', label: 'Suspend', tone: 'danger', needsNote: true }],
  REJECTED: [{ status: 'APPROVED', label: 'Approve', tone: 'primary' }],
  SUSPENDED: [{ status: 'APPROVED', label: 'Reinstate', tone: 'primary' }],
}

/** Closing is final, so it is offered separately and asks for confirmation. */
const CLOSE_ACTION = { status: 'CLOSED', label: 'Close NGO', tone: 'danger', needsNote: true, close: true }

function ReviewPanel({ org, onDone }) {
  const { token } = useAuth()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [confirmingClose, setConfirmingClose] = useState(false)
  const closed = org.verification_status === 'CLOSED'

  const decide = async (action) => {
    if (action.needsNote && !note.trim()) {
      setError(`Add a note explaining why — it’s emailed to the NGO admin.`)
      return
    }
    if (action.close && !confirmingClose) {
      setError('')
      setConfirmingClose(true)
      return
    }
    setBusy(action.status)
    setError('')
    try {
      if (action.close) {
        const res = await closeOrganizationApi(org.id, note.trim(), token)
        onDone(org, res?.data?.organization, action, res?.data?.cancelled_events ?? 0)
        return
      }
      const res = await reviewOrganizationApi(org.id, action.status, note.trim() || undefined, token)
      onDone(org, res?.data?.organization, action)
    } catch (err) {
      setError(err.message || 'The decision could not be saved.')
      setBusy(null)
    }
  }

  const website = org.website && /^https?:\/\//i.test(org.website) ? org.website : null

  return (
    <div className="admin-review">
      <dl className="admin-review-facts">
        <div>
          <dt>NGO admin</dt>
          <dd>
            {org.owner_email ? (
              <>
                {org.owner_name} · <a href={`mailto:${org.owner_email}`}>{org.owner_email}</a>
                {org.owner_phone && <> · <a href={`tel:${org.owner_phone.replace(/[^+\d]/g, '')}`}>{org.owner_phone}</a></>}
              </>
            ) : (
              <span className="muted">None — the team was removed when the NGO closed</span>
            )}
          </dd>
        </div>
        <div><dt>Type</dt><dd>{registrationTypeLabel(org.registration_type) || <span className="muted">Not given</span>}</dd></div>
        <div>
          <dt>Registration no. / Darpan ID</dt>
          <dd>{org.registration_number || <span className="muted">Not given</span>}</dd>
        </div>
        {org.city && <div><dt>City</dt><dd>{org.city}</dd></div>}
        <div><dt>Submitted</dt><dd>{formatDate(org.created_at, { month: 'long' })}</dd></div>
        {org.closed_at && <div><dt>Closed</dt><dd>{formatDate(org.closed_at, { month: 'long' })}</dd></div>}
        <div><dt>Opportunities</dt><dd>{org.opportunity_count}</dd></div>
        {org.email && <div><dt>Contact email</dt><dd>{org.email}</dd></div>}
        {org.phone && <div><dt>Phone</dt><dd>{org.phone}</dd></div>}
        {website && <div><dt>Website</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{website}</a></dd></div>}
        {org.address && <div><dt>Address</dt><dd>{org.address}</dd></div>}
      </dl>
      <p className="admin-review-desc">{org.description || <span className="muted">No description provided.</span>}</p>
      {org.verification_note && (
        <p className="admin-review-prev"><strong>{closed ? 'Reason for closing:' : 'Previous note:'}</strong> {org.verification_note}</p>
      )}

      {closed ? (
        <p className="muted">This NGO is closed. Closed NGOs can’t be reviewed or reopened.</p>
      ) : (
        <div className="field">
          <label className="field-label" htmlFor={`note-${org.id}`}>
            Note to the NGO admin <span className="opt">(required to reject, suspend or close)</span>
          </label>
          <textarea
            id={`note-${org.id}`}
            className="textarea"
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => { setNote(e.target.value); setError('') }}
            disabled={Boolean(busy)}
          />
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {confirmingClose && (
        <Alert tone="warning">
          Closing “{org.name}” cancels all its upcoming events (registered volunteers are emailed), clears their
          waitlists and removes its NGO admin and coordinators. Past events and hours are kept. This can’t be undone.
        </Alert>
      )}

      <div className="admin-review-actions">
        {(ACTIONS[org.verification_status] || []).map((action) => (
          <button
            key={action.status}
            type="button"
            className={`btn btn-sm btn-${action.tone}`}
            onClick={() => decide(action)}
            disabled={Boolean(busy)}
          >
            {busy === action.status ? 'Saving…' : action.label}
          </button>
        ))}
        {!closed && (
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => decide(CLOSE_ACTION)}
            disabled={Boolean(busy)}
          >
            {busy === 'CLOSED' ? 'Closing…' : confirmingClose ? 'Yes, close this NGO' : CLOSE_ACTION.label}
          </button>
        )}
        {confirmingClose && !busy && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingClose(false)}>
            Keep it open
          </button>
        )}
        {!closed && <Link to={`/organizations/${org.id}`} className="btn btn-ghost btn-sm">View public page</Link>}
      </div>
    </div>
  )
}

function AdminOrganizations() {
  const { token } = useAuth()
  const [status, setStatus] = useState('PENDING')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ organizations: [], pagination: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminOrganizationsApi(token, { status, q: debouncedQuery, page, limit: 20 })
      setData({ organizations: res?.data?.organizations || [], pagination: res?.data?.pagination || null })
    } catch (err) {
      setError(err.message || 'Organizations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, status, debouncedQuery, page])

  useAutoLoad(load)

  const changeTab = (key) => {
    setStatus(key)
    setPage(1)
    setOpenId(null)
  }

  const handleDone = (org, updated, action, cancelledEvents = 0) => {
    setOpenId(null)
    const cancelledText = cancelledEvents === 1 ? '1 upcoming event was' : `${cancelledEvents} upcoming events were`
    setNotice({
      tone: 'success',
      text: action.close
        ? `“${org.name}” was closed. ${cancelledText} cancelled and everyone affected has been emailed.`
        : `“${org.name}” is now ${VERIFICATION_LABELS[updated?.verification_status || action.status].toLowerCase()}. The NGO admin has been emailed.`,
    })
    load()
  }

  const { organizations, pagination } = data

  return (
    <div className="page">
      <PageHeader
        title="Organization review"
        description="Approve organizations before they can publish opportunities. Rejections and suspensions need a note, which is emailed to the NGO admin."
      />

      <div className="admin-toolbar">
        <div className="segmented" role="group" aria-label="Verification status">
          {STATUS_TABS.map((t) => (
            <button key={t.key || 'all'} type="button" aria-pressed={status === t.key} onClick={() => changeTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="search admin-search">
          <span className="sr-only">Search organizations</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            className="input"
            placeholder="NGO name or NGO admin email"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
        </label>
      </div>

      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
      {error && <Alert onRetry={load}>{error}</Alert>}

      <section className="panel">
        {loading ? (
          <LoadingState label="Loading organizations…" />
        ) : organizations.length === 0 ? (
          <EmptyState icon={status === 'PENDING' ? 'check-circle' : 'building'} title={status === 'PENDING' && !debouncedQuery ? 'No organizations waiting for review' : 'No organizations found'}>
            {debouncedQuery ? 'Try a different search.' : 'Organizations with this status will be listed here.'}
          </EmptyState>
        ) : (
          <ul role="list" className="admin-org-list">
            {organizations.map((org) => {
              const open = openId === org.id
              return (
                <li key={org.id} className={open ? 'is-open' : undefined}>
                  <button
                    type="button"
                    className="admin-org-row"
                    aria-expanded={open}
                    aria-controls={`review-${org.id}`}
                    onClick={() => setOpenId(open ? null : org.id)}
                  >
                    <OrgInitials name={org.name} />
                    <span className="admin-org-main">
                      <span className="cell-primary">{org.name}</span>
                      <span className="cell-sub">{org.owner_email ? `${org.owner_name} · ${org.owner_email}` : 'No team'}</span>
                    </span>
                    <StatusBadge status={org.verification_status} label={VERIFICATION_LABELS[org.verification_status]} />
                    <span className="admin-org-date muted">{formatDate(org.created_at)}</span>
                    <Icon name="chevron-right" size={16} className="admin-org-chevron" />
                  </button>
                  {open && (
                    <div id={`review-${org.id}`}>
                      <ReviewPanel org={org} onDone={handleDone} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {!loading && <Pagination pagination={pagination} onPage={setPage} noun="organizations" />}
    </div>
  )
}

export default AdminOrganizations
