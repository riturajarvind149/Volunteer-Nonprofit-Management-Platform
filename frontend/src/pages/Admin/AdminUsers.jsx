import { Fragment, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getAdminUsersApi, setUserActiveApi } from '../../services/api'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import Icon from '../../components/Icon'
import Pagination from '../../components/Pagination'
import { PageHeader, LoadingState, Alert, EmptyState, StatusBadge } from '../../components/ui'
import { formatDate } from '../../utils/format'
import VolunteerReviewPanel from './VolunteerReviewPanel'
import './Admin.css'

const ROLE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'VOLUNTEER', label: 'Volunteers' },
  { key: 'COORDINATOR', label: 'Coordinators' },
  { key: 'ADMIN', label: 'Admins' },
]

const ROLE_LABELS = { VOLUNTEER: 'Volunteer', COORDINATOR: 'Coordinator', ADMIN: 'Admin' }

const VERIFICATION_FILTERS = [
  { key: '', label: 'Any status' },
  { key: 'UNVERIFIED', label: 'Not reviewed' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'FLAGGED', label: 'Flagged' },
]

const COLUMNS = 7

function AdminUsers() {
  const { token, user: me } = useAuth()
  const [role, setRole] = useState('')
  const [verification, setVerification] = useState('')
  const [openId, setOpenId] = useState(null)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ users: [], pagination: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { q: debouncedQuery, role, page, limit: 25 }
      if (role === 'VOLUNTEER' && verification) params.verification = verification
      const res = await getAdminUsersApi(token, params)
      setData({ users: res?.data?.users || [], pagination: res?.data?.pagination || null })
    } catch (err) {
      setError(err.message || 'Users could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, debouncedQuery, role, verification, page])

  const handleReviewed = (target, updated, action) => {
    setData((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === target.id ? { ...u, ...updated } : u)),
    }))
    setOpenId(null)
    const text = {
      VERIFIED: `${target.full_name} is marked as a verified volunteer.`,
      FLAGGED: `${target.full_name} was flagged and can’t register for new opportunities.`,
      UNVERIFIED: `${target.full_name} is back to not reviewed.`,
    }[action.status]
    setNotice({ tone: 'success', text })
  }

  useEffect(() => { load() }, [load])

  const setActive = async (target, isActive) => {
    setBusyId(target.id)
    setNotice(null)
    try {
      const res = await setUserActiveApi(target.id, isActive, token)
      const updated = res?.data?.user
      setData((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === target.id ? { ...u, ...updated, is_active: isActive } : u)),
      }))
      setConfirmingId(null)
      setNotice({
        tone: 'success',
        text: isActive
          ? `${target.full_name} can sign in again.`
          : `${target.full_name} was suspended and signed out of every device.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'The account could not be updated.' })
    } finally {
      setBusyId(null)
    }
  }

  const { users, pagination } = data

  return (
    <div className="page">
      <PageHeader title="Users" description="Find accounts, check that volunteers are real people, and suspend anyone misusing the platform. Suspended users are signed out immediately and can’t sign in." />

      <div className="admin-toolbar">
        <div className="admin-filters">
          <div className="segmented" role="group" aria-label="Role">
            {ROLE_FILTERS.map((r) => (
              <button key={r.key || 'all'} type="button" aria-pressed={role === r.key} onClick={() => { setRole(r.key); setPage(1); setOpenId(null) }}>
                {r.label}
              </button>
            ))}
          </div>
          {role === 'VOLUNTEER' && (
            <div className="segmented" role="group" aria-label="Verification">
              {VERIFICATION_FILTERS.map((v) => (
                <button key={v.key || 'any'} type="button" aria-pressed={verification === v.key} onClick={() => { setVerification(v.key); setPage(1); setOpenId(null) }}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="search admin-search">
          <span className="sr-only">Search users</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            className="input"
            placeholder="Name or email"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
        </label>
      </div>

      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
      {error && <Alert onRetry={load}>{error}</Alert>}

      <section className="panel">
        {loading ? (
          <LoadingState label="Loading users…" />
        ) : users.length === 0 ? (
          <EmptyState icon="users" title="No users found">Try a different name, email or role.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                  <th>Identity</th>
                  <th>Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me?.id
                  const busy = busyId === u.id
                  const isVolunteer = u.role === 'VOLUNTEER'
                  const open = openId === u.id
                  return (
                    <Fragment key={u.id}>
                    <tr>
                      <td data-label="User" className="cell-lead">
                        <span className="cell-primary">{u.full_name}{isSelf && <span className="badge badge-info admin-you">You</span>}</span>
                        <span className="cell-sub">{u.email}{!u.email_verified_at && ' · email not verified'}</span>
                      </td>
                      <td data-label="Role">{ROLE_LABELS[u.role] || u.role}</td>
                      <td data-label="Joined" className="num">{formatDate(u.created_at)}</td>
                      <td data-label="Last sign-in" className="num">{u.last_login_at ? formatDate(u.last_login_at) : 'Never'}</td>
                      <td data-label="Identity">
                        {isVolunteer ? (
                          <div className="admin-identity">
                            <StatusBadge status={u.verification_status || 'UNVERIFIED'} />
                            {u.missing_details?.length > 0 && <span className="cell-sub">Details incomplete</span>}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              aria-expanded={open}
                              aria-controls={`vreview-${u.id}`}
                              onClick={() => { setNotice(null); setOpenId(open ? null : u.id) }}
                            >
                              {open ? 'Hide details' : 'Review details'}
                            </button>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td data-label="Status"><StatusBadge status={u.is_active ? 'ACTIVE' : 'SUSPENDED'} /></td>
                      <td data-label="">
                        {isSelf || u.role === 'ADMIN' ? (
                          <span className="muted admin-na">—</span>
                        ) : confirmingId === u.id ? (
                          <div className="admin-confirm" role="group" aria-label={`Confirm suspending ${u.full_name}`}>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => setActive(u, false)} disabled={busy}>
                              {busy ? 'Suspending…' : 'Yes, suspend'}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)} disabled={busy}>Keep</button>
                          </div>
                        ) : u.is_active ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNotice(null); setConfirmingId(u.id) }}>
                            Suspend
                          </button>
                        ) : (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActive(u, true)} disabled={busy}>
                            {busy ? 'Reactivating…' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="admin-review-row">
                        <td colSpan={COLUMNS} id={`vreview-${u.id}`}>
                          <VolunteerReviewPanel volunteer={u} onDone={handleReviewed} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && <Pagination pagination={pagination} onPage={setPage} noun="users" />}
    </div>
  )
}

export default AdminUsers
