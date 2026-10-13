import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Notifications.css'

const DEMO_VOLUNTEER_NOTIFICATIONS = [
  {
    id: 1,
    type: 'success',
    title: 'Registration Confirmed',
    body: 'You successfully registered for Lake Cleanup Drive on 20 September.',
    time: '10 Sept, 09:05 pm',
    read: false,
  },
  {
    id: 2,
    type: 'success',
    title: 'Hours Verified',
    body: 'Your 4 volunteer hours for Weekend Food Distribution have been verified.',
    time: '5 Sept, 03:30 pm',
    read: false,
  },
  {
    id: 3,
    type: 'info',
    title: 'Event Reminder',
    body: 'Your event "Lake Cleanup Drive" starts tomorrow at 7:00 AM. Don\'t forget!',
    time: '19 Sept, 11:30 pm',
    read: true,
  },
  {
    id: 4,
    type: 'info',
    title: 'New Opportunity',
    body: 'Green Bengaluru Foundation posted a new opportunity: Tree Plantation Campaign.',
    time: '8 Sept, 01:30 pm',
    read: true,
  },
  {
    id: 5,
    type: 'warning',
    title: 'Hours Submitted',
    body: 'Your coordinator submitted 3.5 hours for Tree Plantation Campaign. Awaiting verification.',
    time: '22 Aug, 09:30 pm',
    read: true,
  },
]

const DEMO_COORDINATOR_NOTIFICATIONS = [
  {
    id: 1,
    type: 'info',
    title: 'New Registration',
    body: 'Rahul Sharma registered for Lake Cleanup Drive.',
    time: '12 Sept, 09:05 pm',
    read: false,
  },
  {
    id: 2,
    type: 'warning',
    title: 'Event Almost Full',
    body: 'Lake Cleanup Drive has only 12 spots remaining (18/30 filled).',
    time: '9 Sept, 01:30 pm',
    read: false,
  },
  {
    id: 3,
    type: 'warning',
    title: 'Hours Pending',
    body: '12 volunteer hours are waiting to be verified across 3 opportunities.',
    time: '8 Sept, 02:30 pm',
    read: false,
  },
  {
    id: 4,
    type: 'info',
    title: 'Event Tomorrow',
    body: 'Weekend Food Distribution starts tomorrow at 9:00 AM. 17 volunteers registered.',
    time: '20 Sept, 11:00 pm',
    read: true,
  },
  {
    id: 5,
    type: 'success',
    title: 'Event Completed',
    body: 'Tree Plantation Campaign has been marked as completed. 32 volunteers participated.',
    time: '6 Sept, 07:10 pm',
    read: true,
  },
]

const TYPE_ICONS = {
  success: '✓',
  warning: '⚠',
  info: 'ℹ',
  error: '✕',
}

function Notifications() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [tab, setTab] = useState('all')
  const isCoordinator = user?.role === 'COORDINATOR'

  const rawNotifications = isCoordinator ? DEMO_COORDINATOR_NOTIFICATIONS : DEMO_VOLUNTEER_NOTIFICATIONS
  const [notifications, setNotifications] = useState(rawNotifications)

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />

  const unreadCount = notifications.filter((n) => !n.read).length
  const displayed = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  const markRead = (id) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))

  return (
    <div className="notif-page">
      <div className="notif-header">
        <div>
          <h1>Notifications</h1>
          {unreadCount > 0 && <p className="notif-unread-count">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-all-btn" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="notif-tabs">
        <button
          type="button"
          className={`notif-tab-btn${tab === 'all' ? ' active' : ''}`}
          onClick={() => setTab('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`notif-tab-btn${tab === 'unread' ? ' active' : ''}`}
          onClick={() => setTab('unread')}
        >
          Unread {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>
      </div>

      <div className="notif-list">
        {displayed.length === 0 ? (
          <div className="notif-empty">
            <p>No {tab === 'unread' ? 'unread ' : ''}notifications.</p>
          </div>
        ) : (
          displayed.map((n) => (
            <div
              key={n.id}
              className={`notif-item notif-item-${n.type}${n.read ? '' : ' unread'}`}
              onClick={() => markRead(n.id)}
            >
              <div className={`notif-icon notif-icon-${n.type}`}>{TYPE_ICONS[n.type]}</div>
              <div className="notif-content">
                <strong className="notif-title">{n.title}</strong>
                <p className="notif-body">{n.body}</p>
                <span className="notif-time">{n.time}</span>
              </div>
              {!n.read && <span className="notif-unread-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Notifications
