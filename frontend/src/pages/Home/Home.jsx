import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import TiltCard from '../../components/TiltCard'
import { StatusBadge } from '../../components/ui'
import './Home.css'

const ShiftScene = lazy(() => import('./ShiftScene'))

const STEPS = [
  {
    short: 'Publish',
    actor: 'Coordinator',
    title: 'Publishes an opportunity',
    status: 'PUBLISHED',
    body: 'Date, start and end time, location, category and a fixed number of spots. Drafts stay hidden until they’re ready.',
  },
  {
    short: 'Register',
    actor: 'Volunteer',
    title: 'Registers for a spot',
    status: 'REGISTERED',
    body: 'Volunteers see how many spots are left before they commit. Registration closes on its own once every spot is taken.',
  },
  {
    short: 'Roster',
    actor: 'Coordinator',
    title: 'Runs the roster',
    body: 'Everyone who registered, with contact details, in one list. Coordinators can cancel or restore a signup.',
  },
  {
    short: 'Record',
    actor: 'Coordinator',
    title: 'Records hours',
    status: 'RECORDED',
    body: 'After the event, the coordinator logs the hours each attendee actually served.',
  },
  {
    short: 'Verify',
    actor: 'Coordinator',
    title: 'Verifies them',
    status: 'VERIFIED',
    body: 'Verified hours count toward the volunteer’s total on their dashboard, and into the organization’s reports.',
  },
]

const VOLUNTEER_FEATURES = [
  'Search opportunities by title, organization, place or category',
  'See the date, time, address and how many spots are left before you commit',
  'Register or cancel in one step — your upcoming shifts stay in one list',
  'Follow every hour entry from pending to verified',
]

const COORDINATOR_FEATURES = [
  'Create an organization and publish opportunities under it',
  'Keep opportunities as drafts until the details are final',
  'Open a roster for each event and log hours per attendee',
  'Review an hours queue and total hours per opportunity for any date range',
]

const RULES = [
  {
    title: 'Capacity is enforced',
    body: 'Signups stop when an opportunity is full, and capacity can’t be lowered below the number of people already registered.',
  },
  {
    title: 'Drafts don’t take registrations',
    body: 'Only published opportunities accept signups, so coordinators can prepare details before anyone sees them.',
  },
  {
    title: 'Every hour has a status',
    body: 'Pending, recorded or verified. Volunteers see exactly which entries still need a coordinator’s review.',
  },
  {
    title: 'Reports export to CSV',
    body: 'Coordinators can total hours by opportunity for a date range and download the table for their own records.',
  },
]

const PALETTE_TOKENS = {
  surface: '--surface',
  sunken: '--surface-sunken',
  line: '--line-strong',
  brand: '--brand',
  accent: '--accent',
  info: '--info',
  success: '--success',
  onSuccess: '--on-brand',
}

function readPalette() {
  const styles = getComputedStyle(document.documentElement)
  const palette = Object.fromEntries(
    Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, styles.getPropertyValue(token).trim()]),
  )
  return { ...palette, dark: document.documentElement.getAttribute('data-theme') === 'dark' }
}

// Scene colours come from the CSS theme tokens and follow theme switches.
function useThemePalette() {
  const [palette, setPalette] = useState(readPalette)
  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readPalette()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return palette
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// If the 3D scene fails to load or render, show the plain lifecycle list instead.
class SceneBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function LifecycleList() {
  return (
    <ol role="list" className="lifecycle-fallback">
      {STEPS.map((step, i) => (
        <li key={step.title}>
          <span className="lifecycle-index">{i + 1}</span>
          <span>
            <strong>{step.title}</strong>
            {step.status && <StatusBadge status={step.status} />}
          </span>
        </li>
      ))}
    </ol>
  )
}

// Tracks how far the story section has been scrolled as a stage from 0 (hero) to 5 (verify).
function useStoryProgress(storyRef) {
  const stageRef = useRef(0)
  const [activeStep, setActiveStep] = useState(0)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const story = storyRef.current
    let frame = 0

    const update = () => {
      frame = 0
      const rect = story.getBoundingClientRect()
      const range = story.offsetHeight - window.innerHeight
      const progress = range > 0 ? Math.min(Math.max(-rect.top / range, 0), 1) : 0
      stageRef.current = progress * STEPS.length
      setActiveStep(Math.round(stageRef.current))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(story)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [storyRef])

  return { stageRef, activeStep, inView }
}

// Adds .is-visible to [data-reveal] elements as they scroll into view (drives the CSS 3D entrance).
function useReveal(containerRef) {
  useEffect(() => {
    const items = containerRef.current.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }
    }, { threshold: 0.2 })
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [containerRef])
}

function Home() {
  const { isAuthenticated } = useAuth()
  const storyRef = useRef(null)
  const pageRef = useRef(null)
  const panelRefs = useRef([])
  const palette = useThemePalette()
  const reducedMotion = useReducedMotion()
  const [webgl] = useState(supportsWebGL)
  const { stageRef, activeStep, inView } = useStoryProgress(storyRef)
  useReveal(pageRef)

  const goToStep = (index) => {
    panelRefs.current[index + 1]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="home" ref={pageRef}>
      <section className="story" ref={storyRef} aria-labelledby="home-title">
        <div className="story-stage">
          <div className="story-canvas" aria-hidden="true">
            {webgl ? (
              <SceneBoundary fallback={<LifecycleList />}>
                <Suspense fallback={null}>
                  <ShiftScene stageRef={stageRef} palette={palette} reducedMotion={reducedMotion} active={inView} />
                </Suspense>
              </SceneBoundary>
            ) : (
              <LifecycleList />
            )}
          </div>

          <nav className="story-steps" aria-label="Workflow steps">
            <div className="story-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${activeStep / STEPS.length})` }} />
            </div>
            <ol role="list">
              {STEPS.map((step, i) => (
                <li key={step.short}>
                  <button
                    type="button"
                    aria-current={activeStep === i + 1 ? 'step' : undefined}
                    onClick={() => goToStep(i)}
                  >
                    <span className="num">{i + 1}</span>
                    <span className="story-step-label">{step.short}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <div className="story-panels">
          <div className="story-panel story-hero" ref={(el) => { panelRefs.current[0] = el }}>
            <div className="story-copy">
              <p className="home-eyebrow">Volunteer &amp; nonprofit management</p>
              <h1 id="home-title">Volunteer shifts, from sign-up to verified hours.</h1>
              <p className="home-lede">
                ServeHub is where nonprofits publish volunteer opportunities and volunteers register for them.
                Coordinators keep the roster and record the hours; volunteers keep a running record of where they’ve served.
              </p>
              <div className="home-actions">
                {isAuthenticated ? (
                  <Link to="/dashboard" className="btn btn-primary btn-lg">
                    Open your dashboard <Icon name="arrow-right" size={16} />
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-primary btn-lg">
                      Create an account <Icon name="arrow-right" size={16} />
                    </Link>
                    <Link to="/login" className="btn btn-secondary btn-lg">Sign in</Link>
                  </>
                )}
              </div>
              <button type="button" className="story-scroll-hint" onClick={() => goToStep(0)}>
                See how a shift works
                <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </div>

          {STEPS.map((step, i) => (
            <article key={step.title} className="story-panel" ref={(el) => { panelRefs.current[i + 1] = el }} aria-labelledby={`step-${i}`}>
              <div className="story-copy story-step">
                <p className="story-step-count num">{String(i + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</p>
                <div className="story-step-meta">
                  <span className="story-actor">{step.actor}</span>
                  {step.status && <StatusBadge status={step.status} />}
                </div>
                <h2 id={`step-${i}`}>{step.title}</h2>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="roles-title">
        <h2 id="roles-title" className="home-section-heading" data-reveal>One account system, two jobs to do</h2>
        <div className="home-roles-grid">
          {[
            { label: 'For volunteers', title: 'Find a shift that fits, then show up.', items: VOLUNTEER_FEATURES, role: 'volunteer', cta: 'Register as a volunteer' },
            { label: 'For nonprofit coordinators', title: 'Fill your events and keep an accurate record.', items: COORDINATOR_FEATURES, role: 'coordinator', cta: 'Register as a coordinator' },
          ].map((card) => (
            <TiltCard key={card.role} as="article" className="home-role" data-reveal>
              <div className="home-role-body">
                <p className="section-title">{card.label}</p>
                <h3 className="tilt-layer">{card.title}</h3>
                <ul role="list" className="home-checklist">
                  {card.items.map((item) => (
                    <li key={item}><Icon name="check" size={16} />{item}</li>
                  ))}
                </ul>
                {!isAuthenticated && (
                  <Link to={`/register?role=${card.role}`} className="home-role-link tilt-layer">
                    {card.cta} <Icon name="arrow-right" size={15} />
                  </Link>
                )}
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="rules-title">
        <h2 id="rules-title" className="home-section-heading" data-reveal>The rules the platform enforces</h2>
        <dl className="home-rules-grid">
          {RULES.map((rule, i) => (
            <div key={rule.title} className="home-rule" data-reveal style={{ '--reveal-delay': `${i * 80}ms` }}>
              <dt>{rule.title}</dt>
              <dd>{rule.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {!isAuthenticated && (
        <TiltCard as="section" className="home-closing-wrap" data-reveal>
          <div className="home-closing">
            <div className="tilt-layer">
              <h2>Ready to get started?</h2>
              <p>You’ll need a name, an email address and a password. Pick volunteer or coordinator as you sign up.</p>
            </div>
            <div className="home-actions tilt-layer">
              <Link to="/register" className="btn btn-primary btn-lg">Create an account</Link>
              <Link to="/login" className="btn btn-secondary btn-lg">Sign in</Link>
            </div>
          </div>
        </TiltCard>
      )}
    </div>
  )
}

export default Home
