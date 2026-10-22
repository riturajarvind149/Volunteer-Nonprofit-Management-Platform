import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import { StatusBadge } from '../../components/ui'
import './Home.css'

const LIFECYCLE = [
  {
    actor: 'Coordinator',
    title: 'Publishes an opportunity',
    status: 'PUBLISHED',
    body: 'Date, start and end time, location, category and a fixed number of spots.',
  },
  {
    actor: 'Volunteer',
    title: 'Registers for a spot',
    status: 'REGISTERED',
    body: 'Registration closes on its own once every spot is taken.',
  },
  {
    actor: 'Coordinator',
    title: 'Runs the roster',
    body: 'Sees who is coming, with contact details, and can cancel or restore a signup.',
  },
  {
    actor: 'Coordinator',
    title: 'Records hours',
    status: 'RECORDED',
    body: 'Logs the hours each attendee actually served after the event.',
  },
  {
    actor: 'Coordinator',
    title: 'Verifies them',
    status: 'VERIFIED',
    body: 'Verified hours count toward the volunteer’s total on their dashboard.',
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

function Home() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-text">
          <p className="home-eyebrow">Volunteer &amp; nonprofit management</p>
          <h1 id="home-title">Volunteer shifts, from sign-up to verified hours.</h1>
          <p className="home-lede">
            ServeHub is where nonprofits publish volunteer opportunities and volunteers register for them.
            Coordinators keep the roster and record the hours; volunteers keep a running record of where they’ve served.
          </p>
          <div className="home-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Open your dashboard
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Create an account
                  <Icon name="arrow-right" size={16} />
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg">Sign in</Link>
              </>
            )}
          </div>
        </div>

        <figure className="home-lifecycle" aria-labelledby="lifecycle-title">
          <figcaption id="lifecycle-title" className="section-title">How a shift moves through ServeHub</figcaption>
          <ol role="list">
            {LIFECYCLE.map((step, index) => (
              <li key={step.title} className="lifecycle-step">
                <span className="lifecycle-index" aria-hidden="true">{index + 1}</span>
                <div className="lifecycle-body">
                  <div className="lifecycle-head">
                    <span className="lifecycle-actor">{step.actor}</span>
                    {step.status && <StatusBadge status={step.status} />}
                  </div>
                  <h2>{step.title}</h2>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </figure>
      </section>

      <section className="home-roles" aria-labelledby="roles-title">
        <h2 id="roles-title" className="home-section-heading">One account system, two jobs to do</h2>
        <div className="home-roles-grid">
          <article className="home-role">
            <p className="section-title">For volunteers</p>
            <h3>Find a shift that fits, then show up.</h3>
            <ul role="list" className="home-checklist">
              {VOLUNTEER_FEATURES.map((item) => (
                <li key={item}><Icon name="check" size={16} />{item}</li>
              ))}
            </ul>
            {!isAuthenticated && (
              <Link to="/register?role=volunteer" className="home-role-link">
                Register as a volunteer <Icon name="arrow-right" size={15} />
              </Link>
            )}
          </article>
          <article className="home-role">
            <p className="section-title">For nonprofit coordinators</p>
            <h3>Fill your events and keep an accurate record.</h3>
            <ul role="list" className="home-checklist">
              {COORDINATOR_FEATURES.map((item) => (
                <li key={item}><Icon name="check" size={16} />{item}</li>
              ))}
            </ul>
            {!isAuthenticated && (
              <Link to="/register?role=coordinator" className="home-role-link">
                Register as a coordinator <Icon name="arrow-right" size={15} />
              </Link>
            )}
          </article>
        </div>
      </section>

      <section className="home-rules" aria-labelledby="rules-title">
        <h2 id="rules-title" className="home-section-heading">The rules the platform enforces</h2>
        <dl className="home-rules-grid">
          {RULES.map((rule) => (
            <div key={rule.title} className="home-rule">
              <dt>{rule.title}</dt>
              <dd>{rule.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {!isAuthenticated && (
        <section className="home-closing">
          <div>
            <h2>Ready to get started?</h2>
            <p>You’ll need a name, an email address and a password. Pick volunteer or coordinator as you sign up.</p>
          </div>
          <div className="home-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Create an account</Link>
            <Link to="/login" className="btn btn-secondary btn-lg">Sign in</Link>
          </div>
        </section>
      )}
    </div>
  )
}

export default Home
