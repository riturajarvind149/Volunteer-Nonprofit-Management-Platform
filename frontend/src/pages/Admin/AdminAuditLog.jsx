import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getAuditLogsApi } from '../../services/api'
import Pagination from '../../components/Pagination'
import { PageHeader, LoadingState, Alert, EmptyState } from '../../components/ui'
import './Admin.css'

const ACTION_LABELS = {
  ORGANIZATION_APPROVED: 'Approved organization',
  ORGANIZATION_REJECTED: 'Rejected organization',
  ORGANIZATION_SUSPENDED: 'Suspended organization',
  ORGANIZATION_PENDING: 'Reset organization to pending',
  USER_SUSPENDED: 'Suspended user',
  USER_REACTIVATED: 'Reactivated user',
}

/** One-line human summary of an audit entry's details JSON. */
function describe(entry) {
  const d = entry.details || {}
  const parts = []
  if (d.email) parts.push(d.email)
  if (d.from) parts.push(`was ${String(d.from).toLowerCase()}`)
  if (d.note) parts.push(`note: “${d.note}”`)
  return parts.join(' · ')
}

function AdminAuditLog() {
  const { token } = useAuth()
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ logs: [], pagination: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAuditLogsApi(token, { page, limit: 30 })
      setData({ logs: res?.data?.logs || [], pagination: res?.data?.pagination || null })
    } catch (err) {
      setError(err.message || 'The audit log could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token, page])

  useEffect(() => { load() }, [load])

  const { logs, pagination } = data

  return (
    <div className="page">
      <PageHeader title="Audit log" description="Every administrator decision, newest first. Entries can’t be edited or deleted from the app." />
      {error && <Alert onRetry={load}>{error}</Alert>}

      <section className="panel">
        {loading ? (
          <LoadingState label="Loading audit log…" />
        ) : logs.length === 0 ? (
          <EmptyState icon="file-text" title="No administrator actions yet">
            Approvals, rejections and suspensions will be recorded here.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="When" className="num">
                      {new Date(entry.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td data-label="Administrator" className="cell-lead">
                      <span className="cell-primary">{entry.actor_name || 'Deleted account'}</span>
                      {entry.actor_email && <span className="cell-sub">{entry.actor_email}</span>}
                    </td>
                    <td data-label="Action">{ACTION_LABELS[entry.action] || entry.action}</td>
                    <td data-label="Details" className="admin-audit-details">{describe(entry) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && <Pagination pagination={pagination} onPage={setPage} noun="entries" />}
    </div>
  )
}

export default AdminAuditLog
