import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Notifications.css'

const TYPE_ICONS = {
  success: '✓',
  warning: '⚠',
  info: 'ℹ',
  error: '✕',
}

function Notifications() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [tab, setTab] = useState('all')

  // Notifications are not yet connected to a backend endpoint.
  // The list will remain empty until a real notifications API is integrated.
  const [notifications] = useState([])

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />

  const unreadCount = notifications.filter((n) => !n.read).length
  const displayed = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <div className="notif-page">
      <div className="notif-header">
        <div>
          <h1>Notifications</h1>
          {unreadCount > 0 && <p className="notif-unread-count">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>}
        </div>
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
