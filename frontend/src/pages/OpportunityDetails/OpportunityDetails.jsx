import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOpportunityByIdApi, joinWaitlistApi, leaveWaitlistApi, opportunityCalendarUrl } from '../../services/api'
import Icon from '../../components/Icon'
import { StatusBadge, LoadingState, EmptyState, Alert, CapacityMeter } from '../../components/ui'
import { formatDate, formatTime, isUpcoming, spotsLabel } from '../../utils/format'
import { opportunityPhoto } from '../../utils/photos'
import './OpportunityDetails.css'

function ShareAndCalendar({ opportunity }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: opportunity.title, text: `Volunteer with ${opportunity.organization_name || 'us'}`, url })
        return
      } catch {
        // dismissed or unsupported — fall back to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <div className="detail-share">
      {opportunity.status === 'PUBLISHED' && (
        <a className="btn btn-ghost btn-sm" href={opportunityCalendarUrl(opportunity.id)} download>
          <Icon name="calendar" size={15} /> Add to calendar
        </a>
      )}
      <button type="button" className="btn btn-ghost btn-sm" onClick={share}>
        <Icon name="share" size={15} /> {copied ? 'Link copied' : 'Share'}
      </button>
    </div>
  )
}

function SignupPanel({ opportunity, onChanged }) {
  const { user, token, isAuthenticated } = useAuth()
  const location = useLocation()
  const { isRegistered, signUp, cancelSignUp } = useOpportunities()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState(null)

  const isCoordinator = user?.role === 'COORDINATOR'
  const isOwner = isCoordinator && opportunity.coordinator_id === user?.id
  // The API reports the viewer's own signup; fall back to the cached list for older responses.
  const mySignupStatus = opportunity.my_signup?.status
  const registered = mySignupStatus ? mySignupStatus === 'REGISTERED' : isRegistered(opportunity.id)
  const waitlistPosition = opportunity.my_waitlist_position
  const isFull = Number(opportunity.spots_remaining) <= 0
  const isPast = !isUpcoming(opportunity.event_date)

  const run = async (action, successText, { useServerMessage = false } = {}) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await action(opportunity.id)
      setMessage({ tone: 'success', text: (useServerMessage && res?.message) || successText })
      setConfirming(false)
      onChanged()
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const joinWaitlist = (id) => joinWaitlistApi(id, token)
  const leaveWaitlist = (id) => leaveWaitlistApi(id, token)

  if (!isAuthenticated) {
    const open = opportunity.status === 'PUBLISHED' && !isPast
    return (
      <div className="signup-actions">
        {open ? (
          <>
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="btn btn-primary btn-lg btn-block"
            >
              Sign in to register
            </Link>
            <p className="signup-note">
              New here? <Link to="/register">Create a free volunteer account</Link> — it takes a minute.
            </p>
          </>
        ) : (
          <p className="signup-note">Registration for this opportunity is closed.</p>
        )}
      </div>
    )
  }

  if (isOwner) {
    return (
      <div className="signup-actions">
        <Link to={`/opportunities/${opportunity.id}/attendees`} className="btn btn-primary btn-block">
          <Icon name="users" size={16} /> Open roster
        </Link>
        <Link to={`/opportunities/${opportunity.id}/edit`} className="btn btn-secondary btn-block">
          <Icon name="edit" size={16} /> Edit opportunity
        </Link>
      </div>
    )
  }

  if (isCoordinator) {
    return <p className="signup-note">Coordinator accounts can’t register for opportunities. Only the organizing coordinator can edit this listing.</p>
  }

  let unavailableReason = ''
  if (opportunity.status === 'CANCELLED') unavailableReason = 'This opportunity was cancelled by the organizer.'
  else if (opportunity.status !== 'PUBLISHED') unavailableReason = 'This opportunity isn’t open for registration.'
  else if (isPast) unavailableReason = 'This date has passed.'

  const canWaitlist = !registered && !unavailableReason && isFull

  return (
    <div className="signup-actions">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {canWaitlist ? (
        waitlistPosition ? (
          <>
            <p className="signup-confirmed signup-waitlisted">
              <Icon name="clock" size={18} />
              You’re #{waitlistPosition} on the waitlist. We’ll email you and register you automatically if a spot opens up.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={busy}
              onClick={() => run(leaveWaitlist, 'You left the waitlist.')}
            >
              {busy ? 'Leaving…' : 'Leave waitlist'}
            </button>
          </>
        ) : (
          <>
            <p className="signup-note">Every spot has been taken, but you can join the waitlist.</p>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              disabled={busy}
              onClick={() => run(joinWaitlist, 'You joined the waitlist.', { useServerMessage: true })}
            >
              {busy ? 'Joining…' : 'Join the waitlist'}
            </button>
          </>
        )
      ) : registered ? (
        <>
          <p className="signup-confirmed">
            <Icon name="check-circle" size={18} />
            You’re registered for this opportunity.
          </p>
          {confirming ? (
            <div className="signup-confirm">
              <p>Cancel your registration? Your spot will be released to other volunteers.</p>
              <div className="signup-confirm-actions">
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(cancelSignUp, 'Your registration was cancelled.')}>
                  {busy ? 'Cancelling…' : 'Yes, cancel it'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
              </div>
            </div>
          ) : (
            !isPast && (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirming(true)}>
                Cancel registration
              </button>
            )
          )}
        </>
      ) : unavailableReason ? (
        <>
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled>Registration closed</button>
          <p className="signup-note">{unavailableReason}</p>
        </>
      ) : (
        <>
          {mySignupStatus === 'CANCELLED' && (
            <p className="signup-note">You cancelled your registration earlier. You can register again while spots are available.</p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={busy}
            onClick={() => run(signUp, 'You’re registered. A confirmation email with a calendar invite is on its way.')}
          >
            {busy ? 'Registering…' : mySignupStatus === 'CANCELLED' ? 'Register again' : 'Register for this opportunity'}
          </button>
        </>
      )}
    </div>
  )
}

function OpportunityDetails() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const [opportunity, setOpportunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getOpportunityByIdApi(id, token)
      setOpportunity(res?.data?.opportunity || null)
    } catch (err) {
      setError(err.message || 'This opportunity could not be loaded.')
      setOpportunity(null)
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => { load() }, [load])

  const backLink = user?.role === 'COORDINATOR'
    ? { to: '/manage-opportunities', label: 'Opportunities' }
    : { to: '/opportunities', label: 'All opportunities' }

  if (loading) return <LoadingState label="Loading opportunity…" />

  if (!opportunity) {
    return (
      <div className="page page-narrow">
        <div className="panel">
          <EmptyState
            icon="search"
            title="Opportunity not found"
            action={<Link to={backLink.to} className="btn btn-secondary">Back to {backLink.label.toLowerCase()}</Link>}
          >
            {error || 'It may have been removed, or the link is incorrect.'}
          </EmptyState>
        </div>
      </div>
    )
  }

  const time = formatTime(opportunity.start_time, opportunity.end_time)
  const spots = spotsLabel(opportunity)
  const photo = opportunityPhoto(opportunity)

  return (
    <div className="page">
      <Link to={backLink.to} className="back-link">
        <Icon name="arrow-left" size={14} /> {backLink.label}
      </Link>

      <header className="detail-header">
        <div className="detail-kicker">
          {opportunity.category && <span className="tag">{opportunity.category}</span>}
          {opportunity.status !== 'PUBLISHED' && <StatusBadge status={opportunity.status} />}
        </div>
        <h1>{opportunity.title}</h1>
        {opportunity.organization_name && (
          <p className="detail-org">
            Organized by{' '}
            <Link to={`/organizations/${opportunity.organization_id}`}>{opportunity.organization_name}</Link>
          </p>
        )}
        <ShareAndCalendar opportunity={opportunity} />
      </header>

      {opportunity.status === 'CANCELLED' && (
        <Alert>
          This opportunity was cancelled by the organizer.
          {opportunity.cancellation_reason ? ` Reason: ${opportunity.cancellation_reason}` : ''}
        </Alert>
      )}

      <img
        className="detail-cover"
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="(max-width: 1280px) 100vw, 1280px"
        alt={photo.alt}
        width="1280"
        height="480"
      />

      <div className="detail-layout">
        <article className="detail-main">
          <section className="detail-section" aria-labelledby="about-heading">
            <h2 id="about-heading">About this opportunity</h2>
            {opportunity.description ? (
              <p className="detail-description">{opportunity.description}</p>
            ) : (
              <p className="muted">The organizer hasn’t added a description yet.</p>
            )}
          </section>

          {opportunity.skills_required?.length > 0 && (
            <section className="detail-section" aria-labelledby="skills-heading">
              <h2 id="skills-heading">Helpful skills</h2>
              <ul role="list" className="detail-skills">
                {opportunity.skills_required.map((skill) => <li key={skill} className="tag">{skill}</li>)}
              </ul>
            </section>
          )}

          <section className="detail-section" aria-labelledby="where-heading">
            <h2 id="where-heading">Where</h2>
            <p className="detail-place">{opportunity.location || 'Location to be confirmed'}</p>
            {opportunity.address && <p className="muted">{opportunity.address}</p>}
          </section>
        </article>

        <aside className="detail-aside" aria-label="Registration">
          <div className="panel signup-panel">
            <dl className="signup-facts">
              <div>
                <dt><Icon name="calendar" size={15} />Date</dt>
                <dd>{formatDate(opportunity.event_date, { weekday: 'long', month: 'long', fallback: 'To be confirmed' })}</dd>
              </div>
              {time && (
                <div>
                  <dt><Icon name="clock" size={15} />Time</dt>
                  <dd>{time}</dd>
                </div>
              )}
              <div>
                <dt><Icon name="map-pin" size={15} />Location</dt>
                <dd>{opportunity.location || 'To be confirmed'}</dd>
              </div>
              {spots && (
                <div>
                  <dt><Icon name="users" size={15} />Availability</dt>
                  <dd>
                    {spots}
                    <CapacityMeter taken={opportunity.active_signups} capacity={opportunity.capacity} />
                  </dd>
                </div>
              )}
            </dl>
            <SignupPanel opportunity={opportunity} onChanged={load} />
          </div>
        </aside>
      </div>
    </div>
  )
}

export default OpportunityDetails
