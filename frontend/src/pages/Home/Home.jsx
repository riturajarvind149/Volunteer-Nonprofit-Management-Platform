import { Link } from 'react-router-dom'
import OpportunityCard from '../../components/OpportunityCard'
import { MOCK_OPPORTUNITIES } from '../Opportunities/mockOpportunities'
import './Home.css'

function Home() {
  const featuredOpportunities = MOCK_OPPORTUNITIES.slice(0, 3)

  return (
    <main className="home">
      <section className="hero">
        <div className="section-container hero-content">
          <h1>Connect with Meaningful Volunteer Opportunities</h1>
          <p>ServeHub bridges the gap between passionate volunteers and nonprofits creating real impact in our communities.</p>
          <div className="hero-actions">
            <Link to="/opportunities" className="btn btn-primary">Explore Opportunities</Link>
            <a href="#about" className="btn btn-secondary">Get Started</a>
          </div>
        </div>
      </section>

      <section id="about" className="about">
        <div className="section-container">
          <h2>About ServeHub</h2>
          <p className="about-text">
            ServeHub is a community-driven platform designed to simplify volunteer management. We empower local organizations to post causes, recruit dedicated helpers, and help volunteers find events that match their passions and skills.
          </p>
        </div>
      </section>

      <section id="opportunities" className="featured">
        <div className="section-container">
          <div className="section-header">
            <h2>Featured Opportunities</h2>
            <p>Explore upcoming events looking for volunteers right now.</p>
          </div>
          <div className="card-grid">
            {featuredOpportunities.map((item) => (
              <OpportunityCard key={item.id} opportunity={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Making a difference in three simple steps.</p>
          </div>
          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">1</span>
              <h3>Discover</h3>
              <p>Browse through verified opportunities that match your interests, skills, and availability.</p>
            </div>
            <div className="step-card">
              <span className="step-number">2</span>
              <h3>Sign Up</h3>
              <p>Join events with a single click and receive all the details needed to participate.</p>
            </div>
            <div className="step-card">
              <span className="step-number">3</span>
              <h3>Participate & Track</h3>
              <p>Attend sessions, make an active impact, and keep track of your completed volunteer hours.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="section-container">
          <h2>Ready to Make an Impact?</h2>
          <p>Join volunteers and organizations creating positive change today.</p>
          <Link to="/register" className="btn btn-primary btn-large">Join ServeHub Now</Link>
        </div>
      </section>
    </main>
  )
}

export default Home
