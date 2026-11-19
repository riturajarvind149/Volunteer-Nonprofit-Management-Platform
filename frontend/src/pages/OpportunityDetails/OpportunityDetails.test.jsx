import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityDetails from './OpportunityDetails'
import {
  getMeApi,
  getOpportunitiesApi,
  getMySignupsApi,
  getOpportunityByIdApi,
  getProfileApi,
  updateProfileApi,
  signUpForOpportunityApi,
  cancelSignUpApi,
  joinWaitlistApi,
  leaveWaitlistApi,
  opportunityCalendarUrl,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, VOLUNTEER, COMPLETE_VOLUNTEER, COORDINATOR } from '../../test/fixtures'


vi.mock('../../services/api')

const OPEN = {
  id: 'opp-1',
  organization_id: 'org-1',
  organization_name: 'Community Food Rescue',
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
const setup = ({ user = COMPLETE_VOLUNTEER, opportunity = OPEN, signups = [], loadError } = {}) => {
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
    expect(await screen.findByText(/You’re registered\. A confirmation email/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel registration' })).toBeInTheDocument()
  })

  it('registers in one click without asking for details when they are already complete', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))
    expect(getProfileApi).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(signUpForOpportunityApi).toHaveBeenCalledTimes(1)
  })

  it('asks a volunteer with missing details to complete them, then registers', async () => {
    getProfileApi.mockResolvedValue({ data: { user: VOLUNTEER } })
    updateProfileApi.mockImplementation(async (fields) => ({ data: { user: { ...VOLUNTEER, ...fields } } }))
    setup({ user: VOLUNTEER })

    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))
    const dialog = await screen.findByRole('dialog', { name: 'Complete your details' })
    expect(signUpForOpportunityApi).not.toHaveBeenCalled()

    // Submitting empty shows errors and does not save.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and register' }))
    expect(within(dialog).getByText('Enter your phone number.')).toBeInTheDocument()
    expect(updateProfileApi).not.toHaveBeenCalled()

    await userEvent.type(within(dialog).getByLabelText(/^Phone/, { selector: '#register-details-phone' }), '+91 98765 43210')
    await userEvent.type(within(dialog).getByLabelText(/^City/), 'Pune')
    await userEvent.type(within(dialog).getByLabelText(/^Date of birth/), '1998-04-12')
    await userEvent.type(within(dialog).getByLabelText(/^Name/), 'Ravi Kumar')
    await userEvent.type(within(dialog).getByLabelText(/^Phone/, { selector: '#register-details-emergency_contact_phone' }), '9123456789')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and register' }))

    expect(updateProfileApi).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+91 98765 43210',
        location: 'Pune',
        date_of_birth: '1998-04-12',
        emergency_contact_name: 'Ravi Kumar',
        emergency_contact_phone: '9123456789',
        id_type: null,
        id_last4: null,
      }),
      'test-token',
    )
    await vi.waitFor(() => expect(signUpForOpportunityApi).toHaveBeenCalledWith('opp-1', 'test-token'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText(/You’re registered\. A confirmation email/)).toBeInTheDocument()
  })

  it('never accepts a full ID number in the details dialog', async () => {
    getProfileApi.mockResolvedValue({ data: { user: { ...COMPLETE_VOLUNTEER, date_of_birth: null } } })
    setup({ user: { ...COMPLETE_VOLUNTEER, date_of_birth: null } })
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/^Last 4 characters/)).toHaveAttribute('maxLength', '4')
    await userEvent.selectOptions(within(dialog).getByLabelText(/^ID type/), 'AADHAAR')
    await userEvent.type(within(dialog).getByLabelText(/^Date of birth/), '1998-04-12')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and register' }))
    expect(within(dialog).getByText('Add the last 4 characters, or clear the ID type.')).toBeInTheDocument()
    expect(updateProfileApi).not.toHaveBeenCalled()
  })

  it('opens the details dialog when the server reports an incomplete profile', async () => {
    signUpForOpportunityApi.mockRejectedValueOnce(Object.assign(new Error('Please complete your details'), { status: 400, code: 'PROFILE_INCOMPLETE' }))
    getProfileApi.mockResolvedValue({ data: { user: { ...COMPLETE_VOLUNTEER, phone: null } } })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))
    expect(await screen.findByRole('dialog', { name: 'Complete your details' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows why a flagged volunteer cannot register', async () => {
    signUpForOpportunityApi.mockRejectedValue(
      Object.assign(new Error('Your account is under review by the ServeHub team'), { status: 403, code: 'VOLUNTEER_FLAGGED' }),
    )
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your account is under review')
  })

  it('shows the API error if registration fails (e.g. it filled up meanwhile)', async () => {
    signUpForOpportunityApi.mockRejectedValue(new Error('Opportunity is at full capacity'))
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Register for this opportunity' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Opportunity is at full capacity')
    expect(screen.getByRole('button', { name: 'Register for this opportunity' })).toBeEnabled()
  })

  it('offers the waitlist when the opportunity is at exact capacity', async () => {
    joinWaitlistApi.mockResolvedValue({ message: 'You’re #2 on the waitlist. We’ll email you if a spot opens up.' })
    setup({ opportunity: { ...OPEN, active_signups: 10, spots_remaining: 0, waitlist_count: 1 } })

    expect(await screen.findByText('Full · 1 on waitlist')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register for this opportunity' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }))

    expect(joinWaitlistApi).toHaveBeenCalledWith('opp-1', 'test-token')
    expect(await screen.findByText(/You’re #2 on the waitlist/)).toBeInTheDocument()
  })

  it('shows the waitlist position and lets the volunteer leave', async () => {
    leaveWaitlistApi.mockResolvedValue({ status: 'success' })
    setup({ opportunity: { ...OPEN, spots_remaining: 0, my_signup: null, my_waitlist_position: 3 } })

    expect(await screen.findByText(/You’re #3 on the waitlist/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leave waitlist' }))
    expect(leaveWaitlistApi).toHaveBeenCalledWith('opp-1', 'test-token')
  })

  it('asks signed-out visitors to sign in, remembering the page', async () => {
    getOpportunityByIdApi.mockResolvedValue({ data: { opportunity: OPEN } })
    renderWithProviders(<OpportunityDetails />, { route: '/opportunities/opp-1', path: '/opportunities/:id' })

    const link = await screen.findByRole('link', { name: 'Sign in to register' })
    expect(link).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /Create a free volunteer account/ })).toHaveAttribute('href', '/register')
    expect(getOpportunityByIdApi).toHaveBeenCalledWith('opp-1', null)
  })

  it('offers add-to-calendar and share for published opportunities', async () => {
    opportunityCalendarUrl.mockReturnValue('http://api.test/api/opportunities/opp-1/calendar.ics')
    setup()
    const calendar = await screen.findByRole('link', { name: /Add to calendar/ })
    expect(calendar).toHaveAttribute('href', 'http://api.test/api/opportunities/opp-1/calendar.ics')
    expect(screen.getByRole('button', { name: /Share/ })).toBeInTheDocument()
  })

  it('explains why a cancelled opportunity was cancelled', async () => {
    setup({ opportunity: { ...OPEN, status: 'CANCELLED', cancellation_reason: 'Heavy rain forecast' } })
    expect(await screen.findByText(/Reason: Heavy rain forecast/)).toBeInTheDocument()
    expect(screen.getByText('This opportunity was cancelled by the organizer.', { selector: '.signup-note' })).toBeInTheDocument()
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

  it('lets a volunteer register again after cancelling', async () => {
    setup({ opportunity: { ...OPEN, my_signup: { id: 's-1', status: 'CANCELLED' } } })
    expect(await screen.findByText(/You cancelled your registration earlier/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Register again' }))
    expect(signUpForOpportunityApi).toHaveBeenCalledWith('opp-1', 'test-token')
  })

  it('shows roster and edit actions to the organizing coordinator', async () => {
    // The server marks the opportunity as manageable for members of its organization.
    setup({ user: COORDINATOR, opportunity: { ...OPEN, can_manage: true } })
    const roster = await screen.findByRole('link', { name: /Open roster/ })
    expect(roster).toHaveAttribute('href', '/opportunities/opp-1/attendees')
    expect(screen.getByRole('link', { name: /Edit opportunity/ })).toHaveAttribute('href', '/opportunities/opp-1/edit')
    expect(screen.queryByRole('button', { name: 'Register for this opportunity' })).not.toBeInTheDocument()
  })

  it('does not let another coordinator register or edit', async () => {
    setup({ user: { ...COORDINATOR, id: 'someone-else' }, opportunity: { ...OPEN, can_manage: false } })
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
