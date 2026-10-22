import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getMySignupsApi } from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, DateBlock, StatusBadge } from '../../components/ui'
import { formatDate, formatTime, isUpcoming, compareByDate } from '../../utils/format'
import './MySignups.css'

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
]

const EMPTY_COPY = {
  upcoming: { title: 'No upcoming registrations', body: 'When you register for an opportunity, it will appear here until the day it takes place.' },
  past: { title: 'No past shifts yet', body: 'Shifts move here once their date has passed. Hours for them are logged by the coordinator.' },
  cancelled: { title: 'No cancelled registrations', body: 'Registrations you or a coordinator cancel are kept here for reference.' },
}

function MySignups() {
  const { token } = useAuth()
  const { cancelSignUp } = useOpportunities()
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('upcoming')
  const [confirmingId, setConfirmingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getMySignupsApi(token)
      const rows = (res?.data?.signups || []).map((s) => ({ ...s, event_date: s.opportunity_event_date }))
      setSignups(rows)
    } catch (err) {
      setError(err.message || 'Your registrations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleCancel = async (signup) => {
    setCancellingId(signup.id)
    setNotice(null)
    try {
      await cancelSignUp(signup.opportunity_id)
      setSignups((prev) => prev.map((s) => (s.id === signup.id ? { ...s, status: 'CANCELLED' } : s)))
      setConfirmingId(null)
      setNotice({ tone: 'success', text: `Your registration for “${signup.opportunity_title}” was cancelled.` })
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'The registration could not be cancelled.' })
    } finally {
      setCancellingId(null)
    }
  }

  const groups = {
    upcoming: signups.filter((s) => s.status !== 'CANCELLED' && isUpcoming(s.event_date)).sort(compareByDate),
    past: signups.filter((s) => s.status !== 'CANCELLED' && !isUpcoming(s.event_date)).sort((a, b) => compareByDate(b, a)),
    cancelled: signups.filter((s) => s.status === 'CANCELLED'),
  }
  const rows = groups[tab]

  return (
    <div className="page">
      <PageHeader
        title="My registrations"
        description="Every opportunity you’ve registered for, split by whether it has happened yet."
        actions={<Link to="/opportunities" className="btn btn-secondary"><Icon name="search" size={15} />Browse opportunities</Link>}
      />

      <div className="segmented" role="group" aria-label="Show registrations">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => { setTab(t.key); setConfirmingId(null) }}
          >
            {t.label}
            <span className="count">{groups[t.key].length}</span>
          </button>
        ))}
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading your registrations…" />
      ) : rows.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="registrations"
            title={EMPTY_COPY[tab].title}
            action={tab === 'upcoming' && <Link to="/opportunities" className="btn btn-primary">Find an opportunity</Link>}
          >
            {EMPTY_COPY[tab].body}
          </EmptyState>
        </div>
      ) : (
        <ul role="list" className="panel reg-list" aria-label={`${TABS.find((t) => t.key === tab).label} registrations`}>
          {rows.map((s) => {
            const time = formatTime(s.opportunity_start_time, s.opportunity_end_time)
            const confirming = confirmingId === s.id
            return (
              <li key={s.id} className={`reg-item${s.status === 'CANCELLED' ? ' is-cancelled' : ''}`}>
                <DateBlock date={s.event_date} />
                <div className="reg-main">
                  <h2 className="reg-title">
                    <Link to={`/opportunities/${s.opportunity_id}`}>{s.opportunity_title}</Link>
                  </h2>
                  <div className="meta-line">
                    {s.organization_name && <span><Icon name="building" size={14} />{s.organization_name}</span>}
                    {time && <span><Icon name="clock" size={14} />{time}</span>}
                    {s.opportunity_location && <span><Icon name="map-pin" size={14} />{s.opportunity_location}</span>}
                  </div>
                  <p className="reg-registered">Registered {formatDate(s.created_at)}</p>

                  {confirming && (
                    <div className="reg-confirm" role="group" aria-label="Confirm cancellation">
                      <p>Cancel this registration? Your spot will be released.</p>
                      <div>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(s)} disabled={cancellingId === s.id}>
                          {cancellingId === s.id ? 'Cancelling…' : 'Yes, cancel'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)} disabled={cancellingId === s.id}>
                          Keep registration
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="reg-side">
                  <StatusBadge status={s.status} />
                  {tab === 'upcoming' && !confirming && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNotice(null); setConfirmingId(s.id) }}>
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {tab === 'past' && groups.past.length > 0 && (
        <p className="muted reg-footnote">
          Hours for past shifts are recorded by the coordinator. Follow them on <Link to="/my-hours">My hours</Link>.
        </p>
      )}
    </div>
  )
}

export default MySignups
