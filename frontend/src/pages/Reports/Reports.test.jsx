import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Reports from './Reports'
import {
  getMeApi,
  getOrganizationOpportunitiesSummaryApi,
  getParticipationReportApi,
  getVolunteerHoursReportApi,
  getOpportunityPerformanceReportApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const setup = () => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: COORDINATOR } })
  getOrganizationOpportunitiesSummaryApi.mockResolvedValue({
    data: { opportunities: [{ opportunity_id: 'o-1', opportunity_title: 'Beach cleanup', organization_name: 'Green Earth', total_volunteers: 4, total_hours: 12, verified_hours: 10, recorded_hours: 2, pending_hours: 0 }] },
  })
  getOpportunityPerformanceReportApi.mockResolvedValue({
    data: { report: [{ opportunity_id: 'o-1', title: 'Beach cleanup', event_date: '2026-10-04', status: 'COMPLETED', active_registrations: 8, capacity: 10, fill_rate_percentage: 80, cancelled_registrations: 2, total_hours_logged: 24 }] },
  })
  getParticipationReportApi.mockResolvedValue({
    data: { report: [{ volunteer_id: 'v-1', volunteer_name: 'Asha', volunteer_email: 'asha@example.org', total_signups: 3, events_attended: 2, events_cancelled: 1, total_hours_logged: 6, verified_hours: 6, last_active_date: '2026-10-04' }] },
  })
  getVolunteerHoursReportApi.mockResolvedValue({
    data: { report: [{ hour_record_id: 'h-1', recorded_at: '2026-10-05T10:00:00Z', volunteer_name: 'Asha', volunteer_email: 'asha@example.org', opportunity_title: 'Beach cleanup', organization_name: 'Green Earth', status: 'VERIFIED', hours: 3 }] },
  })
  return renderWithProviders(<Reports />, { route: '/reports', path: '/reports' })
}

const openReport = (name) => userEvent.click(within(screen.getByRole('group', { name: 'Report' })).getByRole('button', { name }))

describe('Reports', () => {
  it('shows hours by opportunity first', async () => {
    setup()
    expect(await screen.findByRole('cell', { name: 'Beach cleanup' })).toBeInTheDocument()
    expect(screen.getByText('All time · 1 opportunity')).toBeInTheDocument()
  })

  it('shows event performance with the fill rate', async () => {
    setup()
    await screen.findByRole('cell', { name: 'Beach cleanup' })
    await openReport('Event performance')
    expect(await screen.findByRole('cell', { name: '80%' })).toBeInTheDocument()
    expect(screen.getByText('All time · 1 event')).toBeInTheDocument()
    expect(getOpportunityPerformanceReportApi).toHaveBeenCalledWith('test-token', { from_date: '', to_date: '' })
  })

  it('loads the hours log from the server-side report', async () => {
    setup()
    await screen.findByRole('cell', { name: 'Beach cleanup' })
    await openReport('Hours log')
    expect(await screen.findByRole('cell', { name: 'Green Earth' })).toBeInTheDocument()
    expect(screen.getByText('All time · 1 entry')).toBeInTheDocument()
    expect(getVolunteerHoursReportApi).toHaveBeenCalledWith('test-token', { from_date: '', to_date: '' })
  })

  it('shows volunteer participation', async () => {
    setup()
    await screen.findByRole('cell', { name: 'Beach cleanup' })
    await openReport('Volunteer participation')
    expect(await screen.findByRole('cell', { name: 'asha@example.org' })).toBeInTheDocument()
  })
})
