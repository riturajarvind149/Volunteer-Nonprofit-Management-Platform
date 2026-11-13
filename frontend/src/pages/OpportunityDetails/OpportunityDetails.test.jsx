import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityDetails from './OpportunityDetails'
import {
  getMeApi,
  getOpportunitiesApi,
  getMySignupsApi,
  getOpportunityByIdApi,
  signUpForOpportunityApi,
  cancelSignUpApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, VOLUNTEER, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const OPEN = {
  id: 'opp-1',
  organization_id: 'org-1',
  organization_name: 'Community Food Rescue',
  coordinator_id: COORDINATOR.id,
  title: 'Saturday food sorting',
  description: 'Sort donations for the weekend distribution.',
  category: 'Food',
  event_date: '2099-06-15',
  start_time: '09:00:00',
  end_time: '12:00:00',
  location: 'Main warehouse',
  capacity: 10,
  active_signups: 4,
  spots_remaining: 6,
  status: 'PUBLISHED',
}

// Signs `user` in and serves `opportunity` + the volunteer's existing signups.
const setup = ({ user = VOLUNTEER, opportunity = OPEN, signups = [], loadError } = {}) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [opportunity] } })
  getMySignupsApi.mockResolvedValue({ data: { signups } })
  if (loadError) getOpportunityByIdApi.mockRejectedValue(loadError)
  else getOpportunityByIdApi.mockResolvedValue({ data: { opportunity } })

  return renderWithProviders(<OpportunityDetails />, { route: `/opportunities/${opportunity.id}`, path: '/opportunities/:id' })
}

describe('Opportunity sign-up panel', () => {
  beforeEach(() => {
    signUpForOpportunityApi.mockResolvedValue({ status: 'success' })
    cancelSignUpApi.mockResolvedValue({ status: 'success' })
  })

  it('shows the opportunity with remaining capacity', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Saturday food sorting' })).toBeInTheDocument()
    expect(screen.getByText('6 of 10 spots left')).toBeInTheDocument()
  })

  it('lets a volunteer register when spots are open', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))

    expect(signUpForOpportunityApi).toHaveBeenCalledWith('opp-1', 'test-token')
    expect(await screen.findByText(/You’re registered\. It’s now listed under My registrations\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel registration' })).toBeInTheDocument()
  })

  it('shows the API error if registration fails (e.g. it filled up meanwhile)', async () => {
    signUpForOpportunityApi.mockRejectedValue(new Error('Opportunity is at full capacity'))
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Opportunity is at full capacity')
    expect(screen.getByRole('button', { name: 'Register for this opportunity' })).toBeEnabled()
  })

  it('closes registration when the opportunity is at exact capacity', async () => {
    setup({ opportunity: { ...OPEN, active_signups: 10, spots_remaining: 0 } })

    expect(await screen.findByRole('button', { name: 'Registration closed' })).toBeDisabled()
    expect(screen.getByText('Every spot has been taken.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register for this opportunity' })).not.toBeInTheDocument()
  })

  it('closes registration for past dates', async () => {
    setup({ opportunity: { ...OPEN, event_date: '2020-01-01' } })
    expect(await screen.findByText('This date has passed.')).toBeInTheDocument()
  })

  it('closes registration for draft opportunities', async () => {
    setup({ opportunity: { ...OPEN, status: 'DRAFT' } })
    expect(await screen.findByText('This opportunity isn’t open for registration.')).toBeInTheDocument()
  })

  it('asks for confirmation before cancelling, and frees the spot', async () => {
    setup({ signups: [{ opportunity_id: 'opp-1', status: 'REGISTERED' }] })

    expect(await screen.findByText('You’re registered for this opportunity.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel registration' }))
    expect(cancelSignUpApi).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }))
    expect(cancelSignUpApi).toHaveBeenCalledWith('opp-1', 'test-token')
    expect(await screen.findByText('Your registration was cancelled.')).toBeInTheDocument()
  })

  it('keeps the registration when the volunteer backs out of cancelling', async () => {
    setup({ signups: [{ opportunity_id: 'opp-1', status: 'REGISTERED' }] })
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel registration' }))
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(cancelSignUpApi).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel registration' })).toBeInTheDocument()
  })

  it('blocks a second registration after a cancelled one (duplicate sign-up rule)', async () => {
    setup({ signups: [{ opportunity_id: 'opp-1', status: 'CANCELLED' }] })
    expect(await screen.findByRole('button', { name: 'Registration closed' })).toBeDisabled()
    expect(screen.getByText(/Your registration was cancelled\./)).toBeInTheDocument()
  })

  it('shows roster and edit actions to the organizing coordinator', async () => {
    setup({ user: COORDINATOR })
    const roster = await screen.findByRole('link', { name: /Open roster/ })
    expect(roster).toHaveAttribute('href', '/opportunities/opp-1/attendees')
    expect(screen.getByRole('link', { name: /Edit opportunity/ })).toHaveAttribute('href', '/opportunities/opp-1/edit')
    expect(screen.queryByRole('button', { name: 'Register for this opportunity' })).not.toBeInTheDocument()
  })

  it('does not let another coordinator register or edit', async () => {
    setup({ user: { ...COORDINATOR, id: 'someone-else' } })
    const note = await screen.findByText(/Coordinator accounts can’t register for opportunities/)
    expect(note).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Edit opportunity/ })).not.toBeInTheDocument()
  })

  it('shows a not-found state when the opportunity cannot be loaded', async () => {
    setup({ loadError: new Error('This opportunity no longer exists') })

    const heading = await screen.findByRole('heading', { name: 'Opportunity not found' })
    const panel = heading.closest('.panel')
    expect(within(panel).getByText('This opportunity no longer exists')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Back to all opportunities' })).toHaveAttribute('href', '/opportunities')
  })
})
