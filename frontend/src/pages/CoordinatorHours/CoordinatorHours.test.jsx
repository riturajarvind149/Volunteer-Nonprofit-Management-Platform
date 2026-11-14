import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CoordinatorHours from './CoordinatorHours'
import {
  getMeApi,
  getOpportunitiesApi,
  getOrganizationHoursApi,
  getOrganizationHoursSummaryApi,
  getOrganizationOpportunitiesSummaryApi,
  updateHoursStatusApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const ENTRY = {
  id: 'h-1',
  volunteer_name: 'Asha',
  volunteer_email: 'asha@example.org',
  opportunity_id: 'opp-1',
  opportunity_title: 'Beach cleanup',
  hours: '2.50',
  status: 'PENDING',
  self_reported: true,
  notes: 'Collected 12 bags',
  created_at: '2099-06-02',
}

const setup = () => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: COORDINATOR } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  getOrganizationHoursApi.mockResolvedValue({ data: { volunteer_hours: [ENTRY] } })
  getOrganizationHoursSummaryApi.mockResolvedValue({ data: { summary: { pending_hours: 2.5 } } })
  getOrganizationOpportunitiesSummaryApi.mockResolvedValue({ data: { opportunities: [] } })
  updateHoursStatusApi.mockResolvedValue({ status: 'success' })
  return renderWithProviders(<CoordinatorHours />, { route: '/coordinator-hours', path: '/coordinator-hours' })
}

describe('Hours review', () => {
  it('shows that hours were submitted by the volunteer, with their note', async () => {
    setup()
    expect(await screen.findByText('Submitted by volunteer')).toBeInTheDocument()
    expect(screen.getByText('“Collected 12 bags”')).toBeInTheDocument()
  })

  it('asks for confirmation before rejecting, then notifies', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    expect(updateHoursStatusApi).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Yes, reject' }))
    expect(updateHoursStatusApi).toHaveBeenCalledWith('h-1', 'REJECTED', 'test-token')
    expect(await screen.findByText(/marked as not approved\. The volunteer has been notified\./)).toBeInTheDocument()
  })

  it('verifies hours in one click', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Verify' }))
    expect(updateHoursStatusApi).toHaveBeenCalledWith('h-1', 'VERIFIED', 'test-token')
  })
})
