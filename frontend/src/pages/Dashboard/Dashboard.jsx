import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import OpportunityCard from '../../components/OpportunityCard'
import { MOCK_OPPORTUNITIES } from '../Opportunities/mockOpportunities'
import './Dashboard.css'

function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth()
  const featuredOpportunities = MOCK_OPPORTUNITIES.slice(0, 3)

  // Wait for auth initialization before rendering or redirecting
  if (loading) {
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

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        {/* Welcome Banner */}
        <section className="dashboard-welcome">
          <h1>Welcome back, {userName} 👋</h1>
          <p>Here is an overview of your volunteering activities and community engagement.</p>
        </section>

        {/* Summary Cards Grid */}
        <section className="dashboard-summary">
          <div className="summary-card">
            <div className="summary-card-header">
              <span className="summary-icon">📅</span>
              <h3>Upcoming Opportunities</h3>
            </div>
            <div className="summary-value">0</div>
            <p className="summary-caption">Scheduled events & commitments</p>
          </div>

          <div className="summary-card">
            <div className="summary-card-header">
              <span className="summary-icon">✅</span>
              <h3>Completed Opportunities</h3>
            </div>
            <div className="summary-value">0</div>
            <p className="summary-caption">Past events attended</p>
          </div>

          <div className="summary-card">
            <div className="summary-card-header">
              <span className="summary-icon">⏱️</span>
              <h3>Volunteer Hours</h3>
            </div>
            <div className="summary-value">0 hrs</div>
            <p className="summary-caption">Total contribution time</p>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="dashboard-actions-card">
          <h2>Quick Actions</h2>
          <p>Find new ways to contribute or manage your profile details.</p>
          <div className="dashboard-actions-btns">
            <Link to="/opportunities" className="btn btn-primary">
              Browse Opportunities
            </Link>
            <Link to="/profile" className="btn btn-secondary">
              View Profile
            </Link>
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
          <div className="dashboard-opportunities-grid">
            {featuredOpportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default Dashboard
