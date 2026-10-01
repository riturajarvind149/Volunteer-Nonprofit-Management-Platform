import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OpportunityCard from '../../components/OpportunityCard'
import { MOCK_OPPORTUNITIES } from '../Opportunities/mockOpportunities'
import './Home.css'

function Home() {
  const heroFeatured = MOCK_OPPORTUNITIES[0]
  const showcaseFeatured = MOCK_OPPORTUNITIES[1]
  const showcaseSideItems = MOCK_OPPORTUNITIES.slice(2, 4)

  const [activeStep, setActiveStep] = useState(0)
  const [journeyProgress, setJourneyProgress] = useState(1)
  const [heroScrollOffset, setHeroScrollOffset] = useState(0)

  useEffect(() => {
    // Scroll reveal observer using IntersectionObserver
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right')
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible')
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    revealElements.forEach((el) => revealObserver.observe(el))

    // Step observer for Vertical How It Works sequence
    const stepItems = document.querySelectorAll('.editorial-step-item')
    const stepObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-step-index'))
            if (!isNaN(idx)) {
              setActiveStep(idx)
            }
          }
        })
      },
      { threshold: 0.55 }
    )
    stepItems.forEach((el) => stepObserver.observe(el))

    // Handle subtle Hero scroll movement and Journey timeline progress
    const handleScroll = () => {
      const scrollY = window.scrollY
      if (scrollY < 800) {
        setHeroScrollOffset(scrollY * 0.12)
      }

      // Journey section progress trigger
      const journeySec = document.getElementById('journey-section')
      if (journeySec) {
        const rect = journeySec.getBoundingClientRect()
        const windowHeight = window.innerHeight
        if (rect.top < windowHeight && rect.bottom > 0) {
          const totalDist = windowHeight + rect.height
          const currentDist = windowHeight - rect.top
          const pct = Math.min(Math.max(currentDist / totalDist, 0), 1)
          const stage = Math.min(Math.floor(pct * 4) + 1, 4)
          setJourneyProgress(stage)
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      revealElements.forEach((el) => revealObserver.unobserve(el))
      stepItems.forEach((el) => stepObserver.unobserve(el))
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <main className="home-canvas">
      {/* 1. HERO — CLEAN EDITORIAL SHOWCASE */}
      <section className="hero-editorial">
        <div className="section-container hero-grid">
          <div className="hero-left">
            <div className="hero-eyebrow-pill">
              <span className="eyebrow-dot" />
              <span>MAKE TIME. MAKE AN IMPACT.</span>
            </div>

            <h1 className="hero-title">
              Your time can<br />
              <span className="hero-title-accent">change a community.</span>
            </h1>

            <p className="hero-description">
              ServeHub connects passionate volunteers directly with verified non-profits. Discover meaningful local events where your skills drive real, lasting social good.
            </p>

            <div className="hero-action-row">
              <Link to="/opportunities" className="btn btn-primary btn-large">
                Explore Opportunities <span className="btn-arrow">→</span>
              </Link>
              <Link to="/register" className="btn btn-secondary btn-large">
                Get Started
              </Link>
            </div>
          </div>

          <div
            className="hero-right"
            style={{ transform: `translateY(-${heroScrollOffset}px)`, opacity: 1 - heroScrollOffset * 0.0012 }}
          >
            <div className="hero-product-showcase">
              <div className="showcase-top-bar">
                <span className="showcase-category">{heroFeatured.category}</span>
                <span className="showcase-date-badge">{heroFeatured.date}</span>
              </div>

              <div className="showcase-body">
                <h3 className="showcase-event-title">{heroFeatured.title}</h3>
                <p className="showcase-org-name">
                  Organized by <strong>{heroFeatured.organization}</strong>
                </p>

                <p className="showcase-description-text">{heroFeatured.description}</p>

                <div className="showcase-meta-grid">
                  <div className="meta-item">
                    <span className="meta-label">Location</span>
                    <span className="meta-val">📍 {heroFeatured.location}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Availability</span>
                    <span className="meta-val spots-available">{heroFeatured.spots} spots remaining</span>
                  </div>
                </div>
              </div>

              <div className="showcase-footer">
                <Link to={`/opportunities/${heroFeatured.id}`} className="showcase-cta-link">
                  View Event Details <span className="btn-arrow">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BIG VISUAL STATEMENT SECTION */}
      <section className="statement-section">
        <div className="section-container">
          <div className="statement-content reveal">
            <div className="statement-typography">
              <span className="statement-line-1">GOOD PEOPLE</span>
              <span className="statement-line-2">ARE ALREADY HERE.</span>
            </div>
            <p className="statement-subtext reveal-left">
              ServeHub makes it easier to find where your time can matter most. Connecting individuals, neighbors, and non-profits into an active network for good.
            </p>
          </div>
        </div>
      </section>

      {/* 3. IMPACT JOURNEY TIMELINE STRIP */}
      <section id="journey-section" className="journey-section reveal">
        <div className="section-container">
          <div className="journey-header">
            <span className="section-label">THE VOLUNTEER JOURNEY</span>
            <h2>How purposeful action happens.</h2>
          </div>

          <div className="journey-timeline-desktop">
            <div className="timeline-track">
              <div
                className="timeline-progress-bar"
                style={{ width: `${((journeyProgress - 1) / 3) * 100}%` }}
              />
            </div>

            <div className="timeline-stages-grid">
              <div className={`timeline-stage-col ${journeyProgress >= 1 ? 'stage-active' : ''}`}>
                <div className="stage-node-dot" />
                <span className="stage-num">01</span>
                <h4 className="stage-title">DISCOVER</h4>
                <p className="stage-desc">Filter verified local opportunities by cause, date, or skillset.</p>
              </div>

              <div className={`timeline-stage-col ${journeyProgress >= 2 ? 'stage-active' : ''}`}>
                <div className="stage-node-dot" />
                <span className="stage-num">02</span>
                <h4 className="stage-title">CONNECT</h4>
                <p className="stage-desc">Sign up directly and connect with non-profit event coordinators.</p>
              </div>

              <div className={`timeline-stage-col ${journeyProgress >= 3 ? 'stage-active' : ''}`}>
                <div className="stage-node-dot" />
                <span className="stage-num">03</span>
                <h4 className="stage-title">PARTICIPATE</h4>
                <p className="stage-desc">Show up on site, offer your time, and support community projects.</p>
              </div>

              <div className={`timeline-stage-col ${journeyProgress >= 4 ? 'stage-active' : ''}`}>
                <div className="stage-node-dot" />
                <span className="stage-num">04</span>
                <h4 className="stage-title">IMPACT</h4>
                <p className="stage-desc">Track your volunteer hours and build a record of community impact.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. OPPORTUNITIES MAGAZINE / EDITORIAL SHOWCASE */}
      <section id="opportunities" className="editorial-showcase-section reveal">
        <div className="section-container">
          <div className="showcase-header-row">
            <div>
              <span className="section-label">CURATED CAUSES</span>
              <h2 className="showcase-section-title">Find something worth showing up for.</h2>
            </div>
            <Link to="/opportunities" className="explore-all-link">
              Explore all opportunities <span className="btn-arrow">→</span>
            </Link>
          </div>

          <div className="magazine-showcase-grid">
            <div className="magazine-hero-card reveal-left">
              <div className="featured-hero-badge">Featured Cause</div>
              <OpportunityCard opportunity={showcaseFeatured} />
            </div>

            <div className="magazine-side-stack reveal-right">
              {showcaseSideItems.map((item) => (
                <div key={item.id} className="magazine-side-item">
                  <OpportunityCard opportunity={item} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE COMMUNITY EQUATION SECTION */}
      <section className="community-equation-section reveal">
        <div className="section-container">
          <div className="equation-canvas">
            <div className="equation-row">
              <span className="equation-term term-left reveal-left">VOLUNTEERS</span>
              <span className="equation-operator">+</span>
              <span className="equation-term term-right reveal-right">ORGANIZATIONS</span>
            </div>
            <div className="equation-result-row">
              <span className="equation-operator">=</span>
              <span className="equation-result-highlight">IMPACT</span>
            </div>
            <p className="equation-subtext">
              Together, small personal actions transform into meaningful, lasting community change.
            </p>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS (VERTICAL EDITORIAL SEQUENCE) */}
      <section id="how-it-works" className="editorial-works-section reveal">
        <div className="section-container">
          <div className="works-header">
            <span className="section-label">PLATFORM GUIDE</span>
            <h2>How ServeHub Works</h2>
          </div>

          <div className="editorial-works-sequence">
            <div
              className={`editorial-step-item ${activeStep === 0 ? 'step-active' : ''}`}
              data-step-index="0"
            >
              <div className="step-num-col">01</div>
              <div className="step-content-col">
                <h3>Discover an opportunity</h3>
                <p>
                  Explore causes filtered by categories like Food Security, Education, Environment, and Community Support. Find event times that align with your weekly schedule.
                </p>
              </div>
            </div>

            <div
              className={`editorial-step-item ${activeStep === 1 ? 'step-active' : ''}`}
              data-step-index="1"
            >
              <div className="step-num-col">02</div>
              <div className="step-content-col">
                <h3>Show up for a cause</h3>
                <p>
                  Register with one click to lock in your spot. Receive detailed logistics, location pins, and contact details from the NGO event coordinator.
                </p>
              </div>
            </div>

            <div
              className={`editorial-step-item ${activeStep === 2 ? 'step-active' : ''}`}
              data-step-index="2"
            >
              <div className="step-num-col">03</div>
              <div className="step-content-col">
                <h3>Track your impact</h3>
                <p>
                  Attend sessions, contribute your time, and automatically accumulate a verified profile log of hours and community initiatives completed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. RESTRAINED EDITORIAL FINAL CTA */}
      <section className="final-cta-section reveal">
        <div className="section-container">
          <div className="editorial-cta-canvas">
            <div className="cta-accent-ring" />
            <h2 className="cta-headline">
              Ready to do something<br />that matters?
            </h2>
            <p className="cta-subtext">
              Join dedicated volunteers and non-profit leaders taking real action across communities today.
            </p>

            <div className="cta-actions-group">
              <Link to="/opportunities" className="btn btn-primary btn-large">
                Explore Opportunities <span className="btn-arrow">→</span>
              </Link>
              <Link to="/register" className="btn btn-secondary btn-large">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Home

