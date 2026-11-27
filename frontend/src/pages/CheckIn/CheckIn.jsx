import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { checkInApi, getOpportunityByIdApi } from '../../services/api'
import { LoadingState, Alert } from '../../components/ui'
import Icon from '../../components/Icon'
import { formatDate, formatTime } from '../../utils/format'
import { useAutoLoad } from '../../hooks/useAutoLoad'
import './CheckIn.css'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What to tell the volunteer when the server refuses the check-in. */
const explain = (err) => {
  if (err.code === 'CHECK_IN_CLOSED') return 'Check-in opens 1 hour before the event starts and closes 3 hours after it ends.'
  if (err.code === 'INVALID_CODE') return 'This QR code doesn’t match the event. Ask the coordinator to show it again.'
  if (err.status === 404) return 'You aren’t registered for this event, so you can’t check in to it.'
  return err.message || 'Check-in failed. Please try again.'
}

/**
 * Opened by scanning the QR code a coordinator shows at the venue:
 * /check-in?event=<opportunity id>&code=<check-in code>. Checks the signed-in volunteer in.
 */
function CheckIn() {
  const { token } = useAuth()
  const [params] = useSearchParams()
  const eventId = params.get('event') || ''
  const code = (params.get('code') || '').trim().toUpperCase()
  const [state, setState] = useState({ status: 'loading', opportunity: null, message: '' })

  const run = useCallback(async () => {
    if (!UUID.test(eventId) || !code) {
      setState({ status: 'error', opportunity: null, message: 'This check-in link is incomplete. Scan the QR code at the venue again.' })
      return
    }
    let opportunity = null
    try {
      opportunity = (await getOpportunityByIdApi(eventId, token))?.data?.opportunity || null
    } catch {
      // The check-in call below gives the useful error.
    }
    try {
      const res = await checkInApi(eventId, code, token)
      setState({ status: res?.data?.signup?.already ? 'already' : 'done', opportunity, message: '' })
    } catch (err) {
      setState({ status: 'error', opportunity, message: explain(err) })
    }
  }, [eventId, code, token])

  useAutoLoad(run)

  if (state.status === 'loading') return <LoadingState label="Checking you in…" />

  const opp = state.opportunity
  const ok = state.status === 'done' || state.status === 'already'
  return (
    <div className="page checkin-page">
      <section className={`panel checkin-result ${ok ? 'is-ok' : 'is-error'}`} aria-live="polite">
        <span className="checkin-result-icon" aria-hidden="true">
          <Icon name={ok ? 'check-circle' : 'alert-circle'} size={40} />
        </span>
        <h1>{ok ? (state.status === 'already' ? 'You’re already checked in' : 'You’re checked in!') : 'Couldn’t check you in'}</h1>
        {opp && (
          <p className="checkin-event">
            <strong>{opp.title}</strong>
            <span className="muted">
              {formatDate(opp.event_date, { weekday: 'short' })} · {formatTime(opp.start_time, opp.end_time)} · {opp.location}
            </span>
          </p>
        )}
        {ok ? (
          <p>Thanks for showing up. Your coordinator can see you on the roster, and your hours will be recorded after the event.</p>
        ) : (
          <Alert>{state.message}</Alert>
        )}
        <div className="checkin-actions">
          {opp && <Link to={`/opportunities/${opp.id}`} className="btn btn-secondary">View event</Link>}
          <Link to="/my-signups" className="btn btn-primary">My registrations</Link>
        </div>
      </section>
    </div>
  )
}

export default CheckIn
