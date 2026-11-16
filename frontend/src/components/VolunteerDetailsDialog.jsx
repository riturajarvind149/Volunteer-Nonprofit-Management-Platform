import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import VolunteerDetailsForm from './VolunteerDetailsForm'
import Icon from './Icon'

/**
 * Shown when a volunteer clicks Register but hasn't completed their identity
 * details yet. Saving the details continues the registration.
 */
function VolunteerDetailsDialog({ profile, onSaved, onClose, actionLabel = 'Save and register' }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // Runs once per opening: focus the first field, close on Escape, lock page scroll.
  useEffect(() => {
    const previous = document.activeElement
    panelRef.current?.querySelector('input, select, button')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  // Portalled to <body> so no ancestor's transform/overflow can clip the overlay.
  return createPortal(
    <div className="details-dialog-backdrop">
      <div
        ref={panelRef}
        className="details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-dialog-title"
        aria-describedby="details-dialog-desc"
      >
        <header className="details-dialog-header">
          <div>
            <h2 id="details-dialog-title" className="details-dialog-title">Complete your details</h2>
            <p id="details-dialog-desc" className="muted details-dialog-desc">
              Before your first registration we need a few details so we can confirm every volunteer is a real person.
              You only do this once.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm details-dialog-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <VolunteerDetailsForm
          profile={profile}
          onSaved={onSaved}
          onCancel={onClose}
          submitLabel={actionLabel}
          idPrefix="register-details"
        />
      </div>
    </div>,
    document.body,
  )
}

export default VolunteerDetailsDialog
