/** Where a notification should take the user, based on what it is about. */
export function notificationLink(notification, role) {
  const ref = notification.reference_id
  switch (notification.type) {
    case 'REGISTRATION':
    case 'WAITLIST_PROMOTED':
    case 'REMINDER':
    case 'EVENT_UPDATED':
    case 'EVENT_CANCELLED':
    case 'EVENT_COMPLETED':
      if (!ref) return null
      return role === 'COORDINATOR' ? `/opportunities/${ref}/attendees` : `/opportunities/${ref}`
    case 'HOURS':
      return role === 'COORDINATOR' ? '/coordinator-hours' : '/my-hours'
    case 'ORG_REVIEW':
      if (role === 'ADMIN') return '/admin/organizations'
      return ref ? `/organizations/${ref}` : '/organization-profile'
    default:
      return null
  }
}
