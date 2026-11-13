import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityAttendees from './OpportunityAttendees'
import {
  getMeApi,
  getOpportunitiesApi,
  getOpportunityAttendeesApi,
  getOpportunityByIdApi,
  setAttendanceApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const OPP = {
  id: 'opp-1',
  title: 'Beach cleanup',
  event_date: '2099-06-01',
  start_time: '09:00:00',
  end_time: '12:00:00',
  location: 'Marina',
  capacity: 2,
  status: 'PUBLISHED',
  coordinator_id: COORDINATOR.id,
  check_in_code: 'K7Q2ZP',
}

const ATTENDEES = [
  { id: 's-1', volunteer_name: 'Asha', volunteer_email: 'asha@example.org', status: 'REGISTERED', created_at: '2099-05-01' },
  {
    id: 's-2', volunteer_name: 'Ravi', volunteer_email: 'ravi@example.org', status: 'REGISTERED', created_at: '2099-05-02',
    attendance_status: 'PRESENT', checked_in_at: '2099-06-01T09:05:00Z', hours_logged: '3.00', hours_status: 'PENDING',
  },
]

const setup = ({ waitlist = [] } = {}) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: COORDINATOR } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  getOpportunityByIdApi.mockResolvedValue({ data: { opportunity: OPP } })
  getOpportunityAttendeesApi.mockResolvedValue({ data: { signups: ATTENDEES, waitlist, opportunity: OPP } })
  return renderWithProviders(<OpportunityAttendees />, { route: '/opportunities/opp-1/attendees', path: '/opportunities/:id/attendees' })
}

describe('Roster', () => {
  it('shows the check-in code for an upcoming published event', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Check-in code' })).toBeInTheDocument()
    expect(screen.getByText('K7Q2ZP')).toBeInTheDocument()
  })

  it('marks attendance and shows who already checked in', async () => {
    setAttendanceApi.mockResolvedValue({ data: { signup: { attendance_status: 'PRESENT', checked_in_at: '2099-06-01T09:10:00Z' } } })
    setup()

    const asha = await screen.findByRole('group', { name: 'Attendance for Asha' })
    await userEvent.click(within(asha).getByRole('button', { name: 'Present' }))
    expect(setAttendanceApi).toHaveBeenCalledWith('s-1', 'PRESENT', 'test-token')
    expect(within(asha).getByRole('button', { name: 'Present' })).toHaveAttribute('aria-pressed', 'true')

    const ravi = screen.getByRole('group', { name: 'Attendance for Ravi' })
    expect(within(ravi).getByRole('button', { name: 'Present' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows submitted hours with a link to review them', async () => {
    setup()
    expect(await screen.findByRole('link', { name: 'Review' })).toHaveAttribute('href', '/coordinator-hours')
  })

  it('lists the waitlist in order', async () => {
    setup({ waitlist: [{ id: 'w-1', volunteer_name: 'Meera', volunteer_email: 'meera@example.org', position: 1, created_at: '2099-05-03' }] })
    const section = await screen.findByRole('region', { name: 'Waitlist' })
    expect(within(section).getByText('#1')).toBeInTheDocument()
    expect(within(section).getByText('Meera')).toBeInTheDocument()
    expect(screen.getByText(/1 on waitlist/)).toBeInTheDocument()
  })
})
