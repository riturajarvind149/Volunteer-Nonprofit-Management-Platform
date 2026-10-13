import { useState, useEffect, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getDashboardStatsApi, getMySignupsApi, getMyHoursSummaryApi, getOrganizationHoursSummaryApi } from '../../services/api'
import './Dashboard.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function VolunteerDashboard({ user, token, opportunities }) {
  const [stats, setStats] = useState(null)
  const [signups, setSignups] = useState([])
  const [hoursSummary, setHoursSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [statsRes, signupsRes, hoursRes] = await Promise.all([
        getDashboardStatsApi(token).catch(() => null),
        getMySignupsApi(token).catch(() => null),
        getMyHoursSummaryApi(token).catch(() => null),
      ])
      setStats(statsRes?.data?.stats || null)
      const rawSignups = signupsRes?.data?.signups || signupsRes?.data?.opportunities || []
      setSignups(rawSignups.filter(s => s.status !== 'CANCELLED'))
      setHoursSummary(hoursRes?.data?.summary || hoursRes?.data || null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const totalHours = Number(hoursSummary?.total_hours || 0).toFixed(1)
  const eventsCompleted = stats?.completed_count || 0
  const upcomingCount = stats?.upcoming_count || 0
  const upcomingSignup = signups.find(s => s.status === 'REGISTERED' || s.status === 'CONFIRMED')
  const recentActivity = signups.slice(0, 3)

  return (
    <div className="dash-page">
      <div className="dash-topbar">
        <div>
          <h1 className="dash-greeting">{getGreeting()}, {user.full_name?.split(' ')[0] || 'Volunteer'} 👋</h1>
          <p className="dash-subtext">You've volunteered {totalHours} hours this year. Keep going!</p>
        </div>
      </div>

      {upcomingSignup && (
        <div className="dash-streak-banner">
          <span className="streak-icon">🔥</span>
          <span>You have an upcoming event this week! Just {upcomingSignup.opportunity_title || 'your next event'} coming up. Keep it up!</span>
          <Link to="/my-hours" className="streak-action-btn">View my hours →</Link>
        </div>
      )}

      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <span className="dash-stat-delta">+4 this month</span>
          <div className="dash-stat-value">{totalHours}<span className="dash-stat-unit">hrs</span></div>
          <div className="dash-stat-label">Total Hours</div>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-delta">+2 this month</span>
          <div className="dash-stat-value">{eventsCompleted}</div>
          <div className="dash-stat-label">Events Completed</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-value">{upcomingCount}</div>
          <div className="dash-stat-label">Upcoming Events</div>
          {upcomingSignup?.event_date && (
            <div className="dash-stat-sublabel">Next: {new Date(upcomingSignup.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          )}
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-delta">+1 this month</span>
          <div className="dash-stat-value">5</div>
          <div className="dash-stat-label">Orgs Helped</div>
        </div>
      </div>

      <div className="dash-main-grid">
        <div className="dash-main-left">
          {upcomingSignup && (
            <div className="dash-upcoming-card">
              <div className="upcoming-header-row">
                <h2>Next Upcoming Event</h2>
                <Link to="/my-signups" className="dash-view-all">View all</Link>
              </div>
              <div className="upcoming-event-box">
                <div className="upcoming-event-info">
                  <span className="upcoming-event-name">{upcomingSignup.opportunity_title || 'Event'}</span>
                  <span className="upcoming-org-name">{upcomingSignup.organization_name || ''}</span>
                  <div className="upcoming-meta">
                    {upcomingSignup.event_date && (
                      <span>📅 {new Date(upcomingSignup.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    )}
                    {upcomingSignup.start_time && (
                      <span>🕐 {upcomingSignup.start_time}</span>
                    )}
                    {upcomingSignup.location && (
                      <span>📍 {upcomingSignup.location}</span>
                    )}
                  </div>
                </div>
                <span className={`upcoming-status-badge ${upcomingSignup.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-registered'}`}>
                  {upcomingSignup.status}
                </span>
              </div>
              <Link to={`/opportunities/${upcomingSignup.opportunity_id || '#'}`} className="btn-view-details">
                View Details →
              </Link>
            </div>
          )}

          <div className="dash-activity-card">
            <h2>Recent Activity</h2>
            {loading ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : recentActivity.length === 0 ? (
              <p className="dash-empty-text">No recent activity. <Link to="/opportunities">Browse opportunities</Link></p>
            ) : (
              <ul className="dash-activity-list">
                {recentActivity.map((s) => (
                  <li key={s.id} className="dash-activity-item">
                    <span className="activity-dot" />
                    <span className="activity-text">
                      Registered for <strong>{s.opportunity_title || 'event'}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dash-main-right">
          <div className="dash-impact-card">
            <h2>Your Impact</h2>
            <div className="impact-grid">
              <div className="impact-item">
                <span className="impact-icon">⏱</span>
                <strong>{totalHours} hrs</strong>
                <span>Total Hours</span>
              </div>
              <div className="impact-item">
                <span className="impact-icon">✅</span>
                <strong>{eventsCompleted}</strong>
                <span>Events Done</span>
              </div>
              <div className="impact-item">
                <span className="impact-icon">🔥</span>
                <strong>4 weeks</strong>
                <span>Streak</span>
              </div>
              <div className="impact-item">
                <span className="impact-icon">🏢</span>
                <strong>5 orgs</strong>
                <span>Orgs Supported</span>
              </div>
            </div>
          </div>

          <div className="dash-quick-links">
            <Link to="/opportunities" className="dash-quick-btn primary">Find Opportunities →</Link>
            <Link to="/my-signups" className="dash-quick-btn secondary">My Registrations</Link>
            <Link to="/my-hours" className="dash-quick-btn secondary">My Hours</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function CoordinatorDashboard({ user, token, opportunities }) {
  const [stats, setStats] = useState(null)
  const [hoursSummary, setHoursSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [statsRes, hoursRes] = await Promise.all([
        getDashboardStatsApi(token).catch(() => null),
        getOrganizationHoursSummaryApi(token).catch(() => null),
      ])
      setStats(statsRes?.data?.stats || null)
      setHoursSummary(hoursRes?.data?.summary || hoursRes?.data || null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const totalVolunteers = stats?.total_volunteers_registered || 312
  const activeOpps = stats?.active_opportunities || 5
  const upcomingEvents = 3
  const totalHoursLogged = hoursSummary?.total_hours || 1840

  return (
    <div className="dash-page">
      <div className="dash-topbar">
        <div>
          <h1 className="dash-greeting">{getGreeting()}, {user.full_name?.split(' ')[0] || 'Coordinator'} 👋</h1>
          <p className="dash-subtext">Here's what's happening today.</p>
        </div>
        <Link to="/opportunities/create" className="dash-new-opp-btn">+ New Opportunity</Link>
      </div>

      <div className="dash-alerts">
        <div className="dash-alert dash-alert-warning">
          <span>⚠ "Lake Cleanup Drive" is almost full — 18/30 spots filled.</span>
          <Link to="/manage-opportunities" className="dash-alert-action">Manage →</Link>
        </div>
        <div className="dash-alert dash-alert-info">
          <span>⚡ 12 volunteer hours are waiting to be verified.</span>
          <Link to="/coordinator-hours" className="dash-alert-action">Review →</Link>
        </div>
      </div>

      <div className="dash-stats-row">
        <div className="dash-stat-card">
          <span className="dash-stat-delta">+24 this month</span>
          <div className="dash-stat-value">{totalVolunteers}</div>
          <div className="dash-stat-label">Total Volunteers</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-value">{activeOpps}</div>
          <div className="dash-stat-label">Active Opportunities</div>
          <div className="dash-stat-sublabel">{Math.ceil(activeOpps / 2)} almost full</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-value">{upcomingEvents}</div>
          <div className="dash-stat-label">Upcoming Events</div>
          <div className="dash-stat-sublabel">Next: tomorrow</div>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-delta">+160 this month</span>
          <div className="dash-stat-value">{Number(totalHoursLogged).toLocaleString()}</div>
          <div className="dash-stat-label">Total Hours Logged</div>
        </div>
      </div>

      <div className="dash-coord-metrics">
        <div className="dash-metric-item">
          <span className="metric-label">Completed Events</span>
          <span className="metric-value">24</span>
        </div>
        <div className="dash-metric-item">
          <span className="metric-label">Registrations This Month</span>
          <span className="metric-value">78</span>
        </div>
        <div className="dash-metric-item">
          <span className="metric-label">Avg. Volunteers/Event</span>
          <span className="metric-value">18.4</span>
        </div>
      </div>

      <div className="dash-charts-row">
        <div className="dash-chart-card">
          <div className="chart-header">
            <h2>Volunteer Hours Over Time</h2>
            <span className="chart-total">1,840 total hrs</span>
          </div>
          <SimpleLineChart />
        </div>
        <div className="dash-chart-card">
          <div className="chart-header">
            <h2>Volunteer Participation</h2>
          </div>
          <SimpleBarChart />
        </div>
      </div>

      <div className="dash-quick-links">
        <Link to="/manage-opportunities" className="dash-quick-btn secondary">Opportunities</Link>
        <Link to="/coordinator-hours" className="dash-quick-btn secondary">Hours &amp; Attendance</Link>
        <Link to="/analytics" className="dash-quick-btn secondary">Analytics</Link>
        <Link to="/organization-profile" className="dash-quick-btn secondary">Organization</Link>
      </div>
    </div>
  )
}

function SimpleLineChart() {
  const points = [120, 180, 160, 220, 280, 320, 250]
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  const max = Math.max(...points)
  const w = 300
  const h = 80
  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - (v / max) * h,
  }))
  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  return (
    <div className="simple-chart">
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="line-chart-svg">
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="var(--color-primary)" />
        ))}
      </svg>
      <div className="chart-x-labels">
        {months.map((m) => <span key={m}>{m}</span>)}
      </div>
    </div>
  )
}

function SimpleBarChart() {
  const data = [40, 55, 48, 62, 70, 80]
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  const max = Math.max(...data)

  return (
    <div className="simple-chart">
      <div className="bar-chart">
        {data.map((v, i) => (
          <div key={i} className="bar-col">
            <div className="bar-fill" style={{ height: `${(v / max) * 70}px` }} />
          </div>
        ))}
      </div>
      <div className="chart-x-labels">
        {months.map((m) => <span key={m}>{m}</span>)}
      </div>
    </div>
  )
}

function Dashboard() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { opportunities } = useOpportunities()

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    )
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />

  if (user.role === 'COORDINATOR') {
    return <CoordinatorDashboard user={user} token={token} opportunities={opportunities} />
  }

  return <VolunteerDashboard user={user} token={token} opportunities={opportunities} />
}

export default Dashboard
