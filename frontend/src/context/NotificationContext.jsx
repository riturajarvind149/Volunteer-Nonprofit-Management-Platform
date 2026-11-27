import { createContext, useContext } from 'react'

/** Unread-notification count; provided by NotificationProvider. */
export const NotificationContext = createContext({ unreadCount: 0, setUnreadCount: () => {}, refreshUnread: () => {} })

export const useNotifications = () => useContext(NotificationContext)
