import { useEffect, useState } from 'react'
import { onServerSlowChange } from '../services/api'
import './ServerWakeNotice.css'

/**
 * Explains a long wait instead of leaving the user staring at a spinner:
 * the API sleeps when idle and can take up to a minute to start.
 */
function ServerWakeNotice() {
  const [slow, setSlow] = useState(false)

  useEffect(() => onServerSlowChange(setSlow), [])

  if (!slow) return null
  return (
    <div className="server-wake" role="status" aria-live="polite">
      <span className="spinner server-wake-spinner" aria-hidden="true" />
      <span>
        <strong>Starting up the server…</strong> After a quiet period the first request can take up to a minute. Thanks for
        waiting.
      </span>
    </div>
  )
}

export default ServerWakeNotice
