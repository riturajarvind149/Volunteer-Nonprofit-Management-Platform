import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MOCK_OPPORTUNITIES } from '../Opportunities/mockOpportunities'
import './OpportunityDetails.css'

function OpportunityDetails() {
  const { id } = useParams()
  const [signedUp, setSignedUp] = useState(false)

  const opportunity = MOCK_OPPORTUNITIES.find((item) => item.id === Number(id))

  if (!opportunity) {
    return (
      <main className="details-page">
        <div className="details-container not-found">
          <h2>Opportunity Not Found</h2>
          <p>The opportunity you are looking for does not exist or has ended.</p>
          <Link to="/opportunities" className="btn btn-secondary">
            ← Back to Opportunities
          </Link>
        </div>
      </main>
    )
  }

  const { title, organization, category, date, time, location, spots, description, requirements } = opportunity

  return (
    <main className="details-page">
      <div className="details-container">
        <Link to="/opportunities" className="back-btn">
          ← Back to Opportunities
        </Link>

        <article className="details-card">
          <header className="details-header">
            <div className="details-badges">
              <span className="card-category">{category}</span>
              <span className="card-spots">{spots} spots available</span>
            </div>
            <h1>{title}</h1>
            <p className="details-org">
              Organized by <strong>{organization}</strong>
            </p>
          </header>

          <section className="details-meta-grid">
            <div className="meta-item">
              <span className="meta-label">📅 Date & Time</span>
              <span className="meta-value">{date} • {time}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">📍 Location</span>
              <span className="meta-value">{location}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">🏷️ Category</span>
              <span className="meta-value">{category}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">👥 Spots</span>
              <span className="meta-value">{spots} volunteers needed</span>
            </div>
          </section>

          <section className="details-section">
            <h2>About this Opportunity</h2>
            <p>{description}</p>
          </section>

          <section className="details-section">
            <h2>Requirements</h2>
            <ul className="requirements-list">
              {requirements.map((req, index) => (
                <li key={index}>{req}</li>
              ))}
            </ul>
          </section>

          <footer className="details-actions">
            {signedUp ? (
              <div className="signed-up-banner">
                ✓ You have signed up to volunteer for this opportunity!
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary volunteer-btn"
                onClick={() => setSignedUp(true)}
              >
                Sign Up / Volunteer
              </button>
            )}
          </footer>
        </article>
      </div>
    </main>
  )
}

export default OpportunityDetails
