import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import OpportunityCard from '../../components/OpportunityCard'
import './MySignups.css'

function MySignups() {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { getRegisteredOpportunities, loading, cancelSignUp } = useOpportunities()

  if (authLoading || loading) {
    return (
      <main className="my-signups-page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your signups...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role === 'COORDINATOR') {
    return (
      <main className="my-signups-page">
        <div className="my-signups-container">
          <div className="empty-state">
            <h2>Coordinator Account</h2>
            <p>Volunteer signups are only available for Volunteer accounts.</p>
            <Link to="/opportunities" className="btn btn-secondary">Manage Opportunities</Link>
          </div>
        </div>
      </main>
    )
  }

  const registered = getRegisteredOpportunities()

  const now = new Date()
  const upcoming = registered.filter((o) => {
    const d = o.event_date ? new Date(o.event_date) : null
    return d ? d >= now : true
  })
  const past = registered.filter((o) => {
    const d = o.event_date ? new Date(o.event_date) : null
    return d ? d < now : false
  })

  return (
    <main className="my-signups-page">
      <div className="my-signups-container">
        <header className="my-signups-header">
          <div>
            <h1>My Signups</h1>
            <p>All the volunteer opportunities you have registered for.</p>
          </div>
          <Link to="/opportunities" className="btn btn-primary">Browse More</Link>
        </header>

        {registered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No signups yet</h2>
            <p>You haven't signed up for any opportunities. Discover something meaningful to get started.</p>
            <Link to="/opportunities" className="btn btn-primary">Explore Opportunities</Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="signups-section">
                <h2 className="section-title">Upcoming ({upcoming.length})</h2>
                <div className="signups-grid">
                  {upcoming.map((opp) => (
                    <div key={opp.id} className="signup-card-wrapper">
                      <OpportunityCard opportunity={opp} />
                      <button
                        type="button"
                        className="btn btn-outline cancel-btn"
                        onClick={() => cancelSignUp(opp.id)}
                      >
                        Cancel Signup
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="signups-section">
                <h2 className="section-title">Past ({past.length})</h2>
                <div className="signups-grid">
                  {past.map((opp) => (
                    <div key={opp.id} className="signup-card-wrapper past">
                      <OpportunityCard opportunity={opp} />
                      <Link to="/hours" className="btn btn-outline">View Hours</Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default MySignups
