import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Notifications from './Notifications'
import {
  getMeApi,
  getNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { notificationLink } from '../../utils/notifications'
import { TOKEN_KEY, VOLUNTEER } from '../../test/fixtures'

vi.mock('../../services/api')

const NOTIFICATIONS = [
  {
    id: 'n-1',
    title: 'You’re off the waitlist',
    message: 'A spot opened up for Beach cleanup.',
    type: 'WAITLIST_PROMOTED',
    is_read: false,
    reference_id: 'opp-9',
    created_at: new Date().toISOString(),
  },
  {
    id: 'n-2',
    title: 'Hours verified',
    message: 'Your 3 hours were verified.',
    type: 'HOURS',
    is_read: true,
    reference_id: 'h-1',
    created_at: '2026-01-02T10:00:00Z',
  },
]

const setup = (notifications = NOTIFICATIONS, unread = 1) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: VOLUNTEER } })
  getNotificationsApi.mockResolvedValue({ data: { notifications, unread_count: unread } })
  markNotificationReadApi.mockResolvedValue({ status: 'success' })
  markAllNotificationsReadApi.mockResolvedValue({ status: 'success' })
  return renderWithProviders(<Notifications />, {
    route: '/notifications',
    path: '/notifications',
    routes: [
      { path: '/opportunities/:id', element: <h1>Opportunity page</h1> },
      { path: '/my-hours', element: <h1>My hours page</h1> },
    ],
  })
}

describe('Notifications page', () => {
  it('lists notifications with the unread count', async () => {
    setup()
    expect(await screen.findByText('You’re off the waitlist')).toBeInTheDocument()
    expect(screen.getByText('Hours verified')).toBeInTheDocument()
    expect(screen.getByText('1 unread')).toBeInTheDocument()
    expect(screen.getByText('Unread:', { exact: false })).toBeInTheDocument()
  })

  it('opens what the notification is about and marks it read', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /^Unread:\s*You’re off the waitlist/ }))
    expect(await screen.findByRole('heading', { name: 'Opportunity page' })).toBeInTheDocument()
    expect(markNotificationReadApi).toHaveBeenCalledWith('n-1', 'test-token')
    expect(screen.getByTestId('location')).toHaveTextContent('/opportunities/opp-9')
  })

  it('marks one notification read without leaving the page', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark “You’re off the waitlist” as read' }))
    expect(markNotificationReadApi).toHaveBeenCalledWith('n-1', 'test-token')
    expect(screen.getByText('You’re all caught up.')).toBeInTheDocument()
  })

  it('marks everything as read', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }))
    expect(markAllNotificationsReadApi).toHaveBeenCalledWith('test-token')
    expect(await screen.findByText('You’re all caught up.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument()
  })

  it('can show only unread notifications', async () => {
    setup()
    await screen.findByText('Hours verified')
    await userEvent.click(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: 'Unread' }))
    expect(getNotificationsApi).toHaveBeenLastCalledWith('test-token', { unread: true, limit: 100 })
  })

  it('shows an empty state when there is nothing yet', async () => {
    setup([], 0)
    expect(await screen.findByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument()
  })
})

describe('notificationLink', () => {
  it('sends each role to the right page', () => {
    const reg = { type: 'REGISTRATION', reference_id: 'opp-1' }
    expect(notificationLink(reg, 'VOLUNTEER')).toBe('/opportunities/opp-1')
    expect(notificationLink(reg, 'COORDINATOR')).toBe('/opportunities/opp-1/attendees')
    expect(notificationLink({ type: 'HOURS' }, 'COORDINATOR')).toBe('/coordinator-hours')
    expect(notificationLink({ type: 'ORG_REVIEW', reference_id: 'org-1' }, 'ADMIN')).toBe('/admin/organizations')
    expect(notificationLink({ type: 'ORG_REVIEW', reference_id: 'org-1' }, 'COORDINATOR')).toBe('/organizations/org-1')
    expect(notificationLink({ type: 'INFO' }, 'VOLUNTEER')).toBeNull()
  })
})
