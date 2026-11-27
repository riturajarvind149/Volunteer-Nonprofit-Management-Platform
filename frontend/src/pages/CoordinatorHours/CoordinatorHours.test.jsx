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
  getOrganizationHoursApi.mockImplementation((token, params = {}) =>
    Promise.resolve({
      data: {
        volunteer_hours: params.limit === 1 ? [] : [ENTRY],
        pagination: { page: params.page || 1, limit: params.limit, total: params.status === 'VERIFIED' ? 0 : 1, total_pages: 1 },
      },
    })
  )
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

  it('loads the review queue a page at a time and shows tab counts from the server', async () => {
    setup()
    await screen.findByText('Submitted by volunteer')
    expect(getOrganizationHoursApi).toHaveBeenCalledWith('test-token', { status: 'PENDING,RECORDED', page: 1, limit: 25 })
    expect(screen.getByRole('button', { name: /Verified\s*0/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Verified/ }))
    expect(getOrganizationHoursApi).toHaveBeenCalledWith('test-token', { status: 'VERIFIED', page: 1, limit: 25 })
  })

  it('shows a pager when there is more than one page', async () => {
    setup()
    getOrganizationHoursApi.mockImplementation((token, params = {}) =>
      Promise.resolve({
        data: {
          volunteer_hours: [ENTRY],
          pagination: { page: params.page || 1, limit: params.limit, total: 30, total_pages: params.limit === 1 ? 30 : 2 },
        },
      })
    )
    await userEvent.click(await screen.findByRole('button', { name: /All entries/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Next/ }))
    expect(getOrganizationHoursApi).toHaveBeenCalledWith('test-token', { status: '', page: 2, limit: 25 })
  })
})
