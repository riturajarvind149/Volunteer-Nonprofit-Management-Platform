import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VolunteerHours from './VolunteerHours'
import { getMeApi, getMyHoursApi, getMyHoursSummaryApi, getOpportunitiesApi, downloadCertificateApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, VOLUNTEER } from '../../test/fixtures'

vi.mock('../../services/api')

const setup = (summary) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: VOLUNTEER } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  getMyHoursApi.mockResolvedValue({ data: { volunteer_hours: [] } })
  getMyHoursSummaryApi.mockResolvedValue({ data: { summary } })
  return renderWithProviders(<VolunteerHours />, { route: '/my-hours', path: '/my-hours' })
}

describe('My hours certificate', () => {
  it('is disabled until the volunteer has verified hours', async () => {
    setup({ verified_hours: 0, recorded_hours: 0, pending_hours: 2, total_hours: 2, total_records: 1 })
    const button = await screen.findByRole('button', { name: /Download certificate/ })
    expect(button).toBeDisabled()
    expect(screen.getByText('Available once you have verified hours.')).toBeInTheDocument()
  })

  it('downloads the certificate when verified hours exist', async () => {
    downloadCertificateApi.mockResolvedValue({ filename: 'certificate.pdf' })
    setup({ verified_hours: 5, recorded_hours: 0, pending_hours: 0, total_hours: 5, total_records: 2 })

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /Download certificate/ })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: /Download certificate/ }))
    expect(downloadCertificateApi).toHaveBeenCalledWith('test-token')
  })

  it('shows an error if the certificate cannot be generated', async () => {
    downloadCertificateApi.mockRejectedValue(new Error('You have no verified volunteer hours yet.'))
    setup({ verified_hours: 1, recorded_hours: 0, pending_hours: 0, total_hours: 1, total_records: 1 })

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /Download certificate/ })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: /Download certificate/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no verified volunteer hours')
  })
})
