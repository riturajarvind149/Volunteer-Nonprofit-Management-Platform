import { useState, useEffect } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import OpportunityCard from '../../components/OpportunityCard'
import { getDashboardStatsApi } from '../../services/api'
import './Dashboard.css'

const DEFAULT_VOLUNTEER_STATS = { upcoming_count: 0, completed_count: 0, total_hours: 0 }
const DEFAULT_COORDINATOR_STATS = { organizations_count: 0, active_opportunities: 0, total_volunteers_registered: 0 }

function Dashboard() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const { opportunities, loading: oppsLoading } = useOpportunities()

  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const isCoordinator = user?.role === 'COORDINATOR'
  const featuredOpportunities = opportunities.slice(0, 3)

  useEffect(() => {
    if (!token) return
    setStatsLoading(true)
    getDashboardStatsApi(token)
      .then((res) => setStats(res?.data?.stats || null))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [token])

  // Wait for auth initialization before rendering or redirecting
  if (authLoading) {
    return (
      <main className="dashboard-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading dashboard...</p>
        </div>
      </main>
    )
  }

  // Auth Protection: Redirect unauthenticated users to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const userName = user.full_name || 'Volunteer'

  // Normalise stats into display-friendly values
  const resolvedStats = stats || (isCoordinator ? DEFAULT_COORDINATOR_STATS : DEFAULT_VOLUNTEER_STATS)

  const summaryCards = isCoordinator
    ? [
        {
          icon: '🏢',
          label: 'Organizations',
          value: resolvedStats.organizations_count ?? 0,
          caption: 'Organizations you manage',
        },
        {
          icon: '📋',
          label: 'Active Opportunities',
          value: resolvedStats.active_opportunities ?? 0,
          caption: 'Published live opportunities',
        },
        {
          icon: '👥',
          label: 'Volunteers Registered',
          value: resolvedStats.total_volunteers_registered ?? 0,
          caption: 'Total sign-ups across your opportunities',
        },
      ]
    : [
        {
          icon: '📅',
          label: 'Upcoming Opportunities',
          value: resolvedStats.upcoming_count ?? 0,
          caption: 'Scheduled events & commitments',
        },
        {
          icon: '✅',
          label: 'Completed Opportunities',
          value: resolvedStats.completed_count ?? 0,
          caption: 'Past events attended',
        },
        {
          icon: '⏱️',
          label: 'Volunteer Hours',
          value: `${resolvedStats.total_hours ?? 0} hrs`,
          caption: 'Total verified contribution time',
        },
      ]

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        {/* Welcome Banner */}
        <section className="dashboard-welcome">
          <h1>Welcome back, {userName} 👋</h1>
          <p>
            {isCoordinator
              ? 'Here is an overview of your organizations and volunteer engagement.'
              : 'Here is an overview of your volunteering activities and community engagement.'}
          </p>
        </section>

        {/* Summary Cards Grid */}
        <section className="dashboard-summary">
          {summaryCards.map(({ icon, label, value, caption }) => (
            <div key={label} className="summary-card">
              <div className="summary-card-header">
                <span className="summary-icon">{icon}</span>
                <h3>{label}</h3>
              </div>
              <div className="summary-value">
                {statsLoading ? <span className="loading-spinner" style={{ width: 20, height: 20 }} /> : value}
              </div>
              <p className="summary-caption">{caption}</p>
            </div>
          ))}
        </section>

        {/* Quick Actions */}
        <section className="dashboard-actions-card">
          <h2>Quick Actions</h2>
          <p>
            {isCoordinator
              ? 'Manage your organizations or post new volunteer opportunities.'
              : 'Find new ways to contribute or manage your profile details.'}
          </p>
          <div className="dashboard-actions-btns">
            {isCoordinator ? (
              <>
                <Link to="/opportunities/new" className="btn btn-primary">Post Opportunity</Link>
                <Link to="/opportunities" className="btn btn-secondary">Manage Opportunities</Link>
                <Link to="/organizations" className="btn btn-outline">My Organizations</Link>
              </>
            ) : (
              <>
                <Link to="/opportunities" className="btn btn-primary">Browse Opportunities</Link>
                <Link to="/my-signups" className="btn btn-secondary">My Signups</Link>
                <Link to="/hours" className="btn btn-outline">My Hours</Link>
              </>
            )}
          </div>
        </section>

        {/* Featured Opportunities Section */}
        <section className="dashboard-featured">
          <div className="dashboard-featured-header">
            <div>
              <h2>Featured Opportunities</h2>
              <p>Discover upcoming ways to make a difference.</p>
            </div>
            <Link to="/opportunities" className="btn btn-secondary">
              View All Opportunities →
            </Link>
          </div>
          {oppsLoading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>Loading opportunities...</p>
            </div>
          ) : (
            <div className="dashboard-opportunities-grid">
              {featuredOpportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default Dashboard
