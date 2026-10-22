import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import {
  getDashboardStatsApi,
  getMySignupsApi,
  getMyHoursSummaryApi,
  getManagedOpportunitiesApi,
  getOrganizationHoursSummaryApi,
} from '../../services/api'
import Icon from '../../components/Icon'
import OpportunityRow from '../../components/OpportunityRow'
import { LoadingState, EmptyState, Alert, DateBlock, StatusBadge, CapacityMeter } from '../../components/ui'
import { formatDate, formatTime, formatHours, isUpcoming, compareByDate, pluralize } from '../../utils/format'
import './Dashboard.css'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function DashboardHeader({ name, actions }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <p className="dash-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1>{greeting()}, {name?.split(' ')[0] || 'there'}</h1>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

// Signup rows use opportunity_* prefixed fields; normalise them for display helpers.
function signupToEvent(s) {
  return {
    ...s,
    event_date: s.opportunity_event_date,
    start_time: s.opportunity_start_time,
    end_time: s.opportunity_end_time,
  }
}

function VolunteerDashboard({ user, token }) {
  const { opportunities, signupStatus } = useOpportunities()
  const [signups, setSignups] = useState([])
  const [hours, setHours] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [signupsRes, hoursRes] = await Promise.all([getMySignupsApi(token), getMyHoursSummaryApi(token)])
      setSignups((signupsRes?.data?.signups || []).map(signupToEvent))
      setHours(hoursRes?.data?.summary || null)
    } catch (err) {
      setError(err.message || 'Your overview could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const active = signups.filter((s) => s.status !== 'CANCELLED')
  const upcoming = active.filter((s) => isUpcoming(s.event_date)).sort(compareByDate)
  const completedCount = active.length - upcoming.length
  const [next, ...later] = upcoming

  const suggestions = opportunities
    .filter((o) => o.status === 'PUBLISHED' && isUpcoming(o.event_date) && Number(o.spots_remaining) > 0 && !signupStatus(o.id))
    .sort(compareByDate)
    .slice(0, 4)

  const awaiting = Number(hours?.recorded_hours || 0) + Number(hours?.pending_hours || 0)

  return (
    <div className="page">
      <DashboardHeader
        name={user.full_name}
        actions={<Link to="/opportunities" className="btn btn-primary"><Icon name="search" size={15} />Find an opportunity</Link>}
      />

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading your overview…" />
      ) : (
        <div className="dash-grid">
          <div className="dash-main">
            <section className="panel next-shift" aria-labelledby="next-shift-title">
              <h2 id="next-shift-title" className="section-title">Your next shift</h2>
              {next ? (
                <div className="next-shift-body">
                  <DateBlock date={next.event_date} />
                  <div className="next-shift-text">
                    <h3>{next.opportunity_title}</h3>
                    <p className="muted">{next.organization_name}</p>
                    <div className="meta-line">
                      <span><Icon name="calendar" size={14} />{formatDate(next.event_date, { weekday: 'long', month: 'long' })}</span>
                      {next.start_time && <span><Icon name="clock" size={14} />{formatTime(next.start_time, next.end_time)}</span>}
                      {next.opportunity_location && <span><Icon name="map-pin" size={14} />{next.opportunity_location}</span>}
                    </div>
                  </div>
                  <Link to={`/opportunities/${next.opportunity_id}`} className="btn btn-secondary next-shift-link">View details</Link>
                </div>
              ) : (
                <p className="next-shift-empty">
                  You have no upcoming shifts. <Link to="/opportunities">Browse open opportunities</Link> to find one.
                </p>
              )}
            </section>

            {later.length > 0 && (
              <section aria-labelledby="later-title">
                <div className="dash-section-head">
                  <h2 id="later-title" className="section-title">Also coming up</h2>
                  <Link to="/my-signups" className="dash-more">All registrations</Link>
                </div>
                <ul role="list" className="panel compact-list">
                  {later.slice(0, 4).map((s) => (
                    <li key={s.id}>
                      <Link to={`/opportunities/${s.opportunity_id}`}>
                        <span className="compact-date num">{formatDate(s.event_date, { year: undefined })}</span>
                        <span className="compact-title">{s.opportunity_title}</span>
                        <span className="compact-meta">{s.organization_name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="open-title">
              <div className="dash-section-head">
                <h2 id="open-title" className="section-title">Open for registration</h2>
                <Link to="/opportunities" className="dash-more">Browse all</Link>
              </div>
              {suggestions.length > 0 ? (
                <ul role="list" className="opp-list">
                  {suggestions.map((o) => <li key={o.id}><OpportunityRow opportunity={o} /></li>)}
                </ul>
              ) : (
                <div className="panel">
                  <EmptyState icon="calendar" title="No open opportunities right now">
                    Opportunities with free spots will be listed here as organizations publish them.
                  </EmptyState>
                </div>
              )}
            </section>
          </div>

          <aside className="dash-side">
            <section className="panel hours-card" aria-labelledby="hours-title">
              <h2 id="hours-title" className="section-title">Verified hours</h2>
              <p className="hours-total num">{formatHours(hours?.verified_hours)}</p>
              <dl className="hours-breakdown">
                <div><dt>Awaiting verification</dt><dd className="num">{formatHours(awaiting)}</dd></div>
                <div><dt>Total logged</dt><dd className="num">{formatHours(hours?.total_hours)}</dd></div>
              </dl>
              <Link to="/my-hours" className="dash-more">Hour history <Icon name="arrow-right" size={14} /></Link>
            </section>

            <section className="panel tally" aria-label="Shift summary">
              <div><span className="tally-value num">{upcoming.length}</span><span className="tally-label">Upcoming {upcoming.length === 1 ? 'shift' : 'shifts'}</span></div>
              <div><span className="tally-value num">{completedCount}</span><span className="tally-label">Past {completedCount === 1 ? 'shift' : 'shifts'}</span></div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}

function CoordinatorDashboard({ user, token }) {
  const [stats, setStats] = useState(null)
  const [managed, setManaged] = useState([])
  const [hours, setHours] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [statsRes, managedRes, hoursRes] = await Promise.all([
        getDashboardStatsApi(token),
        getManagedOpportunitiesApi(token),
        getOrganizationHoursSummaryApi(token),
      ])
      setStats(statsRes?.data?.stats || null)
      setManaged(managedRes?.data?.opportunities || [])
      setHours(hoursRes?.data?.summary || null)
    } catch (err) {
      setError(err.message || 'Your overview could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const upcoming = managed
    .filter((o) => isUpcoming(o.event_date) && o.status !== 'CANCELLED' && o.status !== 'COMPLETED')
    .sort(compareByDate)
  const drafts = managed.filter((o) => o.status === 'DRAFT')
  const awaitingHours = Number(hours?.pending_hours || 0) + Number(hours?.recorded_hours || 0)
  const hasOrganization = (stats?.organizations_count ?? 0) > 0

  const tasks = [
    !hasOrganization && {
      text: 'Create an organization before you can publish opportunities.',
      to: '/organizations?new=1',
      cta: 'Create organization',
    },
    awaitingHours > 0 && {
      text: `${formatHours(awaitingHours)} volunteer hours are waiting for verification.`,
      to: '/coordinator-hours',
      cta: 'Review hours',
    },
    drafts.length > 0 && {
      text: `${pluralize(drafts.length, 'draft')} ${drafts.length === 1 ? 'hasn’t' : 'haven’t'} been published yet.`,
      to: '/manage-opportunities?status=DRAFT',
      cta: 'View drafts',
    },
  ].filter(Boolean)

  return (
    <div className="page">
      <DashboardHeader
        name={user.full_name}
        actions={hasOrganization && (
          <Link to="/opportunities/create" className="btn btn-primary"><Icon name="plus" size={15} />New opportunity</Link>
        )}
      />

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading your overview…" />
      ) : (
        <>
          {tasks.length > 0 && (
            <section className="panel tasks" aria-labelledby="tasks-title">
              <h2 id="tasks-title" className="section-title">Needs your attention</h2>
              <ul role="list">
                {tasks.map((task) => (
                  <li key={task.to}>
                    <span>{task.text}</span>
                    <Link to={task.to} className="btn btn-secondary btn-sm">{task.cta}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="figures" aria-label="Key figures">
            <div className="figure">
              <span className="figure-value">{stats?.active_opportunities ?? 0}</span>
              <span className="figure-label">Published opportunities</span>
            </div>
            <div className="figure">
              <span className="figure-value">{stats?.total_volunteers_registered ?? 0}</span>
              <span className="figure-label">Active registrations</span>
            </div>
            <div className="figure">
              <span className="figure-value">{formatHours(hours?.total_hours)}</span>
              <span className="figure-label">Hours logged</span>
            </div>
            <div className="figure">
              <span className="figure-value">{formatHours(hours?.verified_hours)}</span>
              <span className="figure-label">Hours verified</span>
            </div>
          </section>

          <section className="panel" aria-labelledby="upcoming-title">
            <div className="panel-header">
              <h2 id="upcoming-title">Upcoming events</h2>
              <Link to="/manage-opportunities" className="dash-more">All opportunities</Link>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No upcoming events"
                action={hasOrganization && <Link to="/opportunities/create" className="btn btn-primary">Create an opportunity</Link>}
              >
                Events you schedule for today or later will be listed here with their signup numbers.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table table-stack">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opportunity</th>
                      <th>Signups</th>
                      <th>Status</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.slice(0, 6).map((o) => (
                      <tr key={o.id}>
                        <td data-label="Date" className="num">
                          {formatDate(o.event_date, { weekday: 'short', year: undefined })}
                          <span className="cell-sub">{formatTime(o.start_time)}</span>
                        </td>
                        <td data-label="Opportunity">
                          <Link to={`/opportunities/${o.id}`}>{o.title}</Link>
                          <span className="cell-sub">{o.organization_name}</span>
                        </td>
                        <td data-label="Signups">
                          <div className="signup-cell">
                            <span className="num">{o.active_signups} / {o.capacity}</span>
                            <CapacityMeter taken={o.active_signups} capacity={o.capacity} />
                          </div>
                        </td>
                        <td data-label="Status"><StatusBadge status={o.status} /></td>
                        <td data-label="">
                          <Link to={`/opportunities/${o.id}/attendees`} className="btn btn-secondary btn-sm">Roster</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Dashboard() {
  const { user, token } = useAuth()
  return user.role === 'COORDINATOR'
    ? <CoordinatorDashboard user={user} token={token} />
    : <VolunteerDashboard user={user} token={token} />
}

export default Dashboard
