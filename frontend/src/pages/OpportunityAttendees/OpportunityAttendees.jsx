import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  getManagedOpportunitiesApi,
  getOpportunityAttendeesApi,
  getOpportunityByIdApi,
  updateSignupStatusApi,
  recordHoursApi,
} from '../../services/api'
import Icon from '../../components/Icon'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge, CapacityMeter } from '../../components/ui'
import { formatDate, formatTime, formatHours, isUpcoming, compareByDate, pluralize } from '../../utils/format'
import './OpportunityAttendees.css'

function RosterPicker() {
  const { token } = useAuth()
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getManagedOpportunitiesApi(token)
      setOpportunities(res?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Your opportunities could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const upcoming = opportunities.filter((o) => isUpcoming(o.event_date)).sort(compareByDate)
  const past = opportunities.filter((o) => !isUpcoming(o.event_date)).sort((a, b) => compareByDate(b, a))

  const renderTable = (rows, caption) => (
    <section className="panel" aria-label={caption}>
      <div className="panel-header"><h2>{caption}</h2><span className="muted">{pluralize(rows.length, 'event')}</span></div>
      <div className="table-wrap">
        <table className="table table-stack">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opportunity</th>
              <th>Registered</th>
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td data-label="Date" className="num">{formatDate(o.event_date)}</td>
                <td data-label="Opportunity" className="cell-lead">
                  <span className="cell-primary">{o.title}</span>
                  <span className="cell-sub">{o.organization_name}</span>
                </td>
                <td data-label="Registered" className="num">{o.active_signups} / {o.capacity}</td>
                <td data-label="Status"><StatusBadge status={o.status} /></td>
                <td data-label="">
                  <Link to={`/opportunities/${o.id}/attendees`} className="btn btn-secondary btn-sm">Open roster</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )

  return (
    <div className="page">
      <PageHeader title="Rosters" description="Choose an event to see who registered, manage signups and log hours." />
      {error && <Alert onRetry={load}>{error}</Alert>}
      {loading ? (
        <LoadingState label="Loading events…" />
      ) : opportunities.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="users"
            title="No events yet"
            action={<Link to="/opportunities/create" className="btn btn-primary">Create an opportunity</Link>}
          >
            Rosters appear once you’ve created an opportunity.
          </EmptyState>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && renderTable(upcoming, 'Upcoming events')}
          {past.length > 0 && renderTable(past, 'Past events')}
        </>
      )}
    </div>
  )
}

function Roster({ opportunityId }) {
  const { token } = useAuth()
  const [opportunity, setOpportunity] = useState(null)
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [hoursInput, setHoursInput] = useState({})
  const [hoursErrors, setHoursErrors] = useState({})
  const [logged, setLogged] = useState({})
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [rosterRes, oppRes] = await Promise.all([
        getOpportunityAttendeesApi(opportunityId, token),
        getOpportunityByIdApi(opportunityId, token),
      ])
      setSignups(rosterRes?.data?.signups || [])
      setOpportunity(oppRes?.data?.opportunity || rosterRes?.data?.opportunity || null)
    } catch (err) {
      setError(err.message || 'This roster could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [opportunityId, token])

  useEffect(() => { load() }, [load])

  const changeStatus = async (signup, status) => {
    setBusyId(signup.id)
    setNotice(null)
    try {
      await updateSignupStatusApi(signup.id, status, token)
      setSignups((prev) => prev.map((s) => (s.id === signup.id ? { ...s, status } : s)))
      setConfirmingId(null)
      setNotice({
        tone: 'success',
        text: status === 'CANCELLED'
          ? `${signup.volunteer_name}’s registration was cancelled.`
          : `${signup.volunteer_name}’s registration was restored.`,
      })
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'The registration could not be updated.' })
    } finally {
      setBusyId(null)
    }
  }

  const logHours = async (e, signup) => {
    e.preventDefault()
    const value = Number(hoursInput[signup.id])
    if (!hoursInput[signup.id] || Number.isNaN(value) || value <= 0 || value > 9999) {
      setHoursErrors((prev) => ({ ...prev, [signup.id]: 'Enter hours greater than 0.' }))
      return
    }
    setHoursErrors((prev) => ({ ...prev, [signup.id]: '' }))
    setBusyId(signup.id)
    setNotice(null)
    try {
      await recordHoursApi(signup.id, { hours: value, status: 'RECORDED' }, token)
      setHoursInput((prev) => ({ ...prev, [signup.id]: '' }))
      setLogged((prev) => ({ ...prev, [signup.id]: (prev[signup.id] || 0) + value }))
      setNotice({ tone: 'success', text: `${formatHours(value)} hours logged for ${signup.volunteer_name}. They’re now waiting for verification.` })
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'The hours could not be logged.' })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState label="Loading roster…" />

  const back = { to: '/volunteers', label: 'Rosters' }

  if (error && !opportunity) {
    return (
      <div className="page page-narrow">
        <PageHeader title="Roster" back={back} />
        <Alert onRetry={load}>{error}</Alert>
      </div>
    )
  }

  const active = signups.filter((s) => s.status !== 'CANCELLED')
  const cancelled = signups.length - active.length
  const time = formatTime(opportunity?.start_time, opportunity?.end_time)

  return (
    <div className="page">
      <PageHeader
        title={opportunity?.title || 'Roster'}
        back={back}
        actions={(
          <>
            <Link to={`/opportunities/${opportunityId}`} className="btn btn-ghost">View listing</Link>
            <Link to={`/opportunities/${opportunityId}/edit`} className="btn btn-secondary"><Icon name="edit" size={14} />Edit</Link>
          </>
        )}
      />

      <div className="roster-summary">
        <div className="meta-line">
          {opportunity?.event_date && <span><Icon name="calendar" size={14} />{formatDate(opportunity.event_date, { weekday: 'long', month: 'long' })}</span>}
          {time && <span><Icon name="clock" size={14} />{time}</span>}
          {opportunity?.location && <span><Icon name="map-pin" size={14} />{opportunity.location}</span>}
          {opportunity?.status && <StatusBadge status={opportunity.status} />}
        </div>
        {opportunity?.capacity && (
          <div className="roster-capacity">
            <span><strong className="num">{active.length}</strong> of {opportunity.capacity} spots filled{cancelled > 0 && ` · ${cancelled} cancelled`}</span>
            <CapacityMeter taken={active.length} capacity={opportunity.capacity} />
          </div>
        )}
      </div>

      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>

      <section className="panel">
        {signups.length === 0 ? (
          <EmptyState icon="users" title="No one has registered yet">
            Volunteers who register for this opportunity will be listed here.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table-stack roster-table">
              <thead>
                <tr>
                  <th>Volunteer</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Log hours</th>
                  <th><span className="sr-only">Registration actions</span></th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => {
                  const isCancelled = s.status === 'CANCELLED'
                  const busy = busyId === s.id
                  return (
                    <tr key={s.id} className={isCancelled ? 'is-cancelled' : undefined}>
                      <td data-label="Volunteer" className="cell-lead">
                        <span className="cell-primary">{s.volunteer_name}</span>
                        <a href={`mailto:${s.volunteer_email}`} className="cell-sub roster-email">{s.volunteer_email}</a>
                      </td>
                      <td data-label="Registered" className="num">{formatDate(s.created_at)}</td>
                      <td data-label="Status"><StatusBadge status={s.status} /></td>
                      <td data-label="Log hours">
                        {isCancelled ? (
                          <span className="muted">—</span>
                        ) : (
                          <form className="hours-form" onSubmit={(e) => logHours(e, s)} noValidate>
                            <label className="sr-only" htmlFor={`hours-${s.id}`}>Hours for {s.volunteer_name}</label>
                            <input
                              id={`hours-${s.id}`}
                              type="number"
                              inputMode="decimal"
                              min="0.25"
                              step="0.25"
                              className="input"
                              placeholder="0"
                              value={hoursInput[s.id] || ''}
                              onChange={(e) => setHoursInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              aria-invalid={Boolean(hoursErrors[s.id])}
                              disabled={busy}
                            />
                            <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>Log</button>
                            {logged[s.id] > 0 && <span className="hours-logged">{formatHours(logged[s.id])} h logged</span>}
                            {hoursErrors[s.id] && <span className="field-error hours-error">{hoursErrors[s.id]}</span>}
                          </form>
                        )}
                      </td>
                      <td data-label="">
                        {confirmingId === s.id ? (
                          <div className="roster-confirm">
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => changeStatus(s, 'CANCELLED')} disabled={busy}>
                              {busy ? 'Cancelling…' : 'Confirm cancel'}
                            </button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(null)} disabled={busy}>Keep</button>
                          </div>
                        ) : isCancelled ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeStatus(s, 'REGISTERED')} disabled={busy}>
                            {busy ? 'Restoring…' : 'Restore'}
                          </button>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingId(s.id)} disabled={busy}>
                            Cancel registration
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {active.length > 0 && (
        <p className="muted roster-footnote">
          Logged hours appear in <Link to="/coordinator-hours">Hours &amp; attendance</Link>, where you can verify them.
        </p>
      )}
    </div>
  )
}

function OpportunityAttendees() {
  const { id } = useParams()
  return id ? <Roster opportunityId={id} /> : <RosterPicker />
}

export default OpportunityAttendees
