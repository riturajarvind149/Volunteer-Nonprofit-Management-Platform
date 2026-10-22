import { Link } from 'react-router-dom'
import Icon from './Icon'
import { dateParts } from '../utils/format'

const STATUS_TONES = {
  PUBLISHED: 'success',
  REGISTERED: 'success',
  VERIFIED: 'success',
  RECORDED: 'info',
  PENDING: 'warning',
  DRAFT: '',
  COMPLETED: '',
  CANCELLED: 'danger',
}

const STATUS_LABELS = {
  PUBLISHED: 'Published',
  REGISTERED: 'Registered',
  VERIFIED: 'Verified',
  RECORDED: 'Recorded',
  PENDING: 'Pending',
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export function Brand({ to = '/', onClick }) {
  return (
    <Link to={to} className="brand" onClick={onClick}>
      <span className="brand-mark">
        <Icon name="mark" size={15} />
      </span>
      <span className="brand-name">ServeHub</span>
    </Link>
  )
}

export function ThemeToggle({ theme, onToggle, className = 'btn btn-ghost' }) {
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <button type="button" className={className} onClick={onToggle} aria-label={`Switch to ${next} theme`}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
      <span>{theme === 'light' ? 'Dark theme' : 'Light theme'}</span>
    </button>
  )
}

export function StatusBadge({ status, label }) {
  if (!status) return null
  const tone = STATUS_TONES[status]
  return <span className={`badge${tone ? ` badge-${tone}` : ''}`}>{label || STATUS_LABELS[status] || status}</span>
}

export function PageHeader({ title, description, actions, back }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {back && (
          <Link to={back.to} className="back-link">
            <Icon name="arrow-left" size={14} />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, children, action }) {
  return (
    <div className="state">
      <Icon name={icon} size={28} className="state-icon" />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Alert({ tone = 'error', children, onRetry }) {
  const icon = tone === 'success' ? 'check-circle' : tone === 'info' ? 'info' : 'alert-circle'
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={16} />
      <div className="alert-body">{children}</div>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function DateBlock({ date }) {
  const parts = dateParts(date)
  if (!parts) {
    return (
      <div className="date-block" aria-label="Date not set">
        <span className="date-block-weekday">TBD</span>
      </div>
    )
  }
  return (
    <div className="date-block" aria-hidden="true">
      <span className="date-block-month">{parts.month}</span>
      <span className="date-block-day">{parts.day}</span>
      <span className="date-block-weekday">{parts.weekday}</span>
    </div>
  )
}

export function OrgInitials({ name, large = false }) {
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <span className={`org-initials${large ? ' org-initials-lg' : ''}`} aria-hidden="true">{initials}</span>
}

export function CapacityMeter({ taken, capacity }) {
  const total = Number(capacity) || 0
  const used = Number(taken) || 0
  if (!total) return null
  const pct = Math.min(Math.round((used / total) * 100), 100)
  return (
    <div className={`meter${used >= total ? ' meter-full' : ''}`} role="img" aria-label={`${used} of ${total} spots filled`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}
