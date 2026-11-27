import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import CheckIn from './CheckIn'
import { ApiError, getMeApi, getOpportunitiesApi, getMySignupsApi, getOpportunityByIdApi, checkInApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, VOLUNTEER } from '../../test/fixtures'

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal()
  const mocked = Object.fromEntries(Object.keys(actual).map((k) => [k, typeof actual[k] === 'function' ? vi.fn() : actual[k]]))
  return { ...mocked, ApiError: actual.ApiError }
})

const EVENT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const OPP = { id: EVENT_ID, title: 'Bellandur Lake shoreline clean-up', event_date: '2099-06-01', start_time: '07:00:00', end_time: '10:00:00', location: 'Bellandur Lake' }

const setup = (query = `?event=${EVENT_ID}&code=k7q2zp`) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: VOLUNTEER } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  getMySignupsApi.mockResolvedValue({ data: { signups: [] } })
  getOpportunityByIdApi.mockResolvedValue({ data: { opportunity: OPP } })
  return renderWithProviders(<CheckIn />, { route: `/check-in${query}`, path: '/check-in' })
}

describe('QR check-in', () => {
  it('checks the volunteer in with the code from the link', async () => {
    checkInApi.mockResolvedValue({ data: { signup: { id: 's-1', attendance_status: 'PRESENT' } } })
    setup()
    expect(await screen.findByRole('heading', { name: 'You’re checked in!' })).toBeInTheDocument()
    expect(checkInApi).toHaveBeenCalledWith(EVENT_ID, 'K7Q2ZP', 'test-token')
    expect(screen.getByText('Bellandur Lake shoreline clean-up')).toBeInTheDocument()
  })

  it('says so when the volunteer already checked in', async () => {
    checkInApi.mockResolvedValue({ data: { signup: { id: 's-1', already: true } } })
    setup()
    expect(await screen.findByRole('heading', { name: 'You’re already checked in' })).toBeInTheDocument()
  })

  it('explains when check-in isn’t open yet', async () => {
    checkInApi.mockRejectedValue(new ApiError('closed', { status: 400, code: 'CHECK_IN_CLOSED' }))
    setup()
    expect(await screen.findByRole('heading', { name: 'Couldn’t check you in' })).toBeInTheDocument()
    expect(screen.getByText(/Check-in opens 1 hour before the event starts/)).toBeInTheDocument()
  })

  it('rejects an incomplete link without calling the server', async () => {
    setup('?event=nope')
    expect(await screen.findByText(/This check-in link is incomplete/)).toBeInTheDocument()
    expect(checkInApi).not.toHaveBeenCalled()
  })
})
