import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getNotificationsApi } from '../services/api'
import { NotificationContext } from './NotificationContext'


const POLL_MS = 60_000

/**
 * Keeps the unread-notification count for the signed-in user, so the sidebar badge
 * and the Notifications page stay in sync. Refreshes on navigation, when the tab
 * becomes visible again, and once a minute while it is visible.
 */
export function NotificationProvider({ children }) {
  const { token, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnread = useCallback(async () => {
    if (!token) return
    try {
      const res = await getNotificationsApi(token, { unread: true, limit: 1 })
      setUnreadCount(Number(res?.data?.unread_count) || 0)
    } catch {
      // A failed badge refresh is not worth interrupting the user; the next refresh will retry.
    }
  }, [token])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    queueMicrotask(refreshUnread)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnread()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && refreshUnread()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAuthenticated, refreshUnread, pathname])

  return (
    <NotificationContext.Provider value={{ unreadCount: isAuthenticated ? unreadCount : 0, setUnreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  )
}
