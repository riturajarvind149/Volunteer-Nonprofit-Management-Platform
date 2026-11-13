import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MySignups from './MySignups'
import {
  getMeApi,
  getMySignupsApi,
  getMyWaitlistApi,
  getOpportunitiesApi,
  checkInApi,
  logOwnHoursApi,
  leaveWaitlistApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, VOLUNTEER } from '../../test/fixtures'
import { toInputDate } from '../../utils/format'

vi.mock('../../services/api')

const today = toInputDate(new Date())

const signup = (overrides) => ({
  id: 's-1',
  opportunity_id: 'opp-1',
  opportunity_title: 'Food sorting',
  organization_name: 'Food Rescue',
  opportunity_event_date: today,
  opportunity_start_time: '09:00:00',
  opportunity_end_time: '12:00:00',
  opportunity_location: 'Warehouse',
  opportunity_status: 'PUBLISHED',
  status: 'REGISTERED',
  created_at: '2026-01-01',
  ...overrides,
})

const setup = ({ signups = [], waitlist = [] } = {}) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: VOLUNTEER } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  getMySignupsApi.mockResolvedValue({ data: { signups } })
  getMyWaitlistApi.mockResolvedValue({ data: { waitlist } })
  return renderWithProviders(<MySignups />, { route: '/my-signups', path: '/my-signups' })
}

describe('My registrations', () => {
  beforeEach(() => {
    checkInApi.mockResolvedValue({ data: { signup: { attendance_status: 'PRESENT', checked_in_at: '2026-01-01T10:00:00Z' } } })
  })

  it('lets a volunteer check in on the day of the event with the venue code', async () => {
    setup({ signups: [signup()] })
    await userEvent.click(await screen.findByRole('button', { name: 'Check in' }))
    await userEvent.type(screen.getByLabelText('Check-in code'), 'ab12cd')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(checkInApi).toHaveBeenCalledWith('opp-1', 'AB12CD', 'test-token')
    expect(await screen.findByText('You’re checked in. Thank you for volunteering!')).toBeInTheDocument()
    expect(screen.getByText('Checked in')).toBeInTheDocument()
  })

  it('shows the server message when the check-in code is wrong', async () => {
    checkInApi.mockRejectedValue(Object.assign(new Error('Invalid check-in code'), { status: 400, code: 'INVALID_CODE' }))
    setup({ signups: [signup()] })
    await userEvent.click(await screen.findByRole('button', { name: 'Check in' }))
    await userEvent.type(screen.getByLabelText('Check-in code'), 'WRONG')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Invalid check-in code')).toBeInTheDocument()
  })

  it('does not offer check-in for events on other days', async () => {
    setup({ signups: [signup({ opportunity_event_date: '2099-01-01' })] })
    expect(await screen.findByText('Food sorting')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check in' })).not.toBeInTheDocument()
  })

  it('lets a volunteer log hours for a past shift', async () => {
    logOwnHoursApi.mockResolvedValue({ data: { volunteer_hours: { id: 'h-1', hours: 2.5, status: 'PENDING' } } })
    setup({ signups: [signup({ opportunity_event_date: '2020-05-01' })] })

    await userEvent.click(await screen.findByRole('button', { name: /Past/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Log hours' }))
    await userEvent.type(screen.getByLabelText('Hours'), '30')
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByText(/at most 24/)).toBeInTheDocument()
    expect(logOwnHoursApi).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Hours'))
    await userEvent.type(screen.getByLabelText('Hours'), '2.5')
    await userEvent.type(screen.getByLabelText(/Note for the coordinator/), 'Sorted 40 crates')
    await userEvent.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(logOwnHoursApi).toHaveBeenCalledWith('s-1', { hours: 2.5, notes: 'Sorted 40 crates' }, 'test-token')
    expect(await screen.findByText(/Your hours were submitted/)).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows already-logged hours with their status instead of the form', async () => {
    setup({ signups: [signup({ opportunity_event_date: '2020-05-01', hours_logged: '3.00', hours_status: 'VERIFIED' })] })
    await userEvent.click(await screen.findByRole('button', { name: /Past/ }))
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log hours' })).not.toBeInTheDocument()
  })

  it('lists waitlist positions and lets the volunteer leave', async () => {
    leaveWaitlistApi.mockResolvedValue({ status: 'success' })
    setup({
      waitlist: [{
        id: 'w-1',
        opportunity_id: 'opp-9',
        opportunity_title: 'Beach cleanup',
        opportunity_event_date: '2099-03-01',
        organization_name: 'Coast Care',
        position: 2,
        created_at: '2026-01-02',
      }],
    })

    await userEvent.click(await screen.findByRole('button', { name: /Waitlist/ }))
    expect(screen.getByText('#2 on waitlist')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))

    expect(leaveWaitlistApi).toHaveBeenCalledWith('opp-9', 'test-token')
    expect(await screen.findByText(/You left the waitlist for “Beach cleanup”/)).toBeInTheDocument()
  })
})
