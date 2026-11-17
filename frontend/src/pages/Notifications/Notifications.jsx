import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { getNotificationsApi, markNotificationReadApi, markAllNotificationsReadApi } from '../../services/api'
import Icon from '../../components/Icon'
import { notificationLink } from '../../utils/notifications'
import { Alert, EmptyState, LoadingState, PageHeader } from '../../components/ui'
import './Notifications.css'

const TYPE_ICONS = {
  REGISTRATION: 'registrations',
  WAITLIST_PROMOTED: 'check-circle',
  REMINDER: 'calendar',
  EVENT_UPDATED: 'edit',
  EVENT_CANCELLED: 'alert-circle',
  EVENT_COMPLETED: 'check',
  HOURS: 'clock',
  ORG_REVIEW: 'building',
}

const relativeTime = (value) => {
  const date = new Date(value)
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Notifications() {
  const { token, user } = useAuth()
  const { setUnreadCount } = useNotifications()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState('all') // all | unread
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getNotificationsApi(token, { unread: filter === 'unread' ? true : undefined, limit: 100 })
      setItems(res?.data?.notifications || [])
      const count = Number(res?.data?.unread_count) || 0
      setUnread(count)
      setUnreadCount(count)
    } catch (err) {
      setError(err.message || 'Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }, [token, filter, setUnreadCount])

  useEffect(() => {
    load()
  }, [load])

  const applyRead = (id) => {
    setItems((prev) =>
      filter === 'unread' ? prev.filter((n) => n.id !== id) : prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnread((c) => {
      const next = Math.max(0, c - 1)
      setUnreadCount(next)
      return next
    })
  }

  const open = async (notification) => {
    const link = notificationLink(notification, user?.role)
    if (!notification.is_read) {
      applyRead(notification.id)
      // Fire and forget: opening the link shouldn't wait for the server.
      markNotificationReadApi(notification.id, token).catch(() => {})
    }
    if (link) navigate(link)
  }

  const markRead = async (notification) => {
    applyRead(notification.id)
    try {
      await markNotificationReadApi(notification.id, token)
    } catch (err) {
      setError(err.message || 'Could not update the notification.')
      load()
    }
  }

  const markAll = async () => {
    setBusy(true)
    try {
      await markAllNotificationsReadApi(token)
      setItems((prev) => (filter === 'unread' ? [] : prev.map((n) => ({ ...n, is_read: true }))))
      setUnread(0)
      setUnreadCount(0)
    } catch (err) {
      setError(err.message || 'Could not mark notifications as read.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'You’re all caught up.'}
        actions={
          unread > 0 && (
            <button type="button" className="btn btn-secondary" onClick={markAll} disabled={busy}>
              <Icon name="check" size={15} /> {busy ? 'Marking…' : 'Mark all as read'}
            </button>
          )
        }
      />

      <div className="notif-filter" role="group" aria-label="Show">
        {[
          ['all', 'All'],
          ['unread', 'Unread'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`notif-filter-btn${filter === value ? ' is-active' : ''}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert onRetry={load}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading notifications…" />
      ) : items.length === 0 ? (
        !error && (
          <div className="panel">
            <EmptyState icon="bell" title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}>
              {filter === 'unread'
                ? 'Everything here has been read.'
                : 'Updates about your registrations, events, hours and organizations will appear here.'}
            </EmptyState>
          </div>
        )
      ) : (
        <ul role="list" className="notif-list">
          {items.map((n) => {
            const link = notificationLink(n, user?.role)
            return (
              <li key={n.id} className={`notif-item${n.is_read ? '' : ' is-unread'}`}>
                <span className="notif-icon" aria-hidden="true">
                  <Icon name={TYPE_ICONS[n.type] || 'bell'} size={17} />
                </span>
                <button type="button" className="notif-body" onClick={() => open(n)} disabled={!link && n.is_read}>
                  <span className="notif-title">
                    {!n.is_read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  <span className="notif-message">{n.message}</span>
                  <time className="notif-time" dateTime={n.created_at}>{relativeTime(n.created_at)}</time>
                </button>
                {!n.is_read && (
                  <button
                    type="button"
                    className="notif-mark"
                    onClick={() => markRead(n)}
                    aria-label={`Mark “${n.title}” as read`}
                    title="Mark as read"
                  >
                    <Icon name="check" size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Notifications
