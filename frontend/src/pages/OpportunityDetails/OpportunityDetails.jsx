import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOpportunities } from '../../context/OpportunityContext'
import { getOpportunityByIdApi } from '../../services/api'
import Icon from '../../components/Icon'
import { StatusBadge, LoadingState, EmptyState, Alert, CapacityMeter } from '../../components/ui'
import { formatDate, formatTime, isUpcoming, spotsLabel } from '../../utils/format'
import { opportunityPhoto } from '../../utils/photos'
import './OpportunityDetails.css'

function SignupPanel({ opportunity, onChanged }) {
  const { user } = useAuth()
  const { isRegistered, signupStatus, signUp, cancelSignUp } = useOpportunities()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState(null)

  const isCoordinator = user?.role === 'COORDINATOR'
  const isOwner = isCoordinator && opportunity.coordinator_id === user?.id
  const registered = isRegistered(opportunity.id)
  const isFull = Number(opportunity.spots_remaining) <= 0
  const isPast = !isUpcoming(opportunity.event_date)

  const run = async (action, successText) => {
    setBusy(true)
    setMessage(null)
    try {
      await action(opportunity.id)
      setMessage({ tone: 'success', text: successText })
      setConfirming(false)
      onChanged()
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
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
  // The API keeps one signup per volunteer and opportunity, so a cancelled one blocks a new registration.
  if (signupStatus(opportunity.id) === 'CANCELLED') unavailableReason = 'Your registration was cancelled. ServeHub can’t take a new registration for the same opportunity, but the coordinator can restore yours from the roster.'
  else if (opportunity.status !== 'PUBLISHED') unavailableReason = 'This opportunity isn’t open for registration.'
  else if (isPast) unavailableReason = 'This date has passed.'
  else if (isFull) unavailableReason = 'Every spot has been taken.'

  return (
    <div className="signup-actions">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {registered ? (
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
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={busy}
          onClick={() => run(signUp, 'You’re registered. It’s now listed under My registrations.')}
        >
          {busy ? 'Registering…' : 'Register for this opportunity'}
        </button>
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
      </header>

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
