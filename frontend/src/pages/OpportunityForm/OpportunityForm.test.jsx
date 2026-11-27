import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunityForm from './OpportunityForm'
import { getMeApi, getOpportunitiesApi, getMyOrganizationsApi, createOpportunityApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const ORG = { id: 'org-1', name: 'Night Shelter Trust', verification_status: 'APPROVED', my_role: 'OWNER' }

const setup = async () => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: COORDINATOR } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  getMyOrganizationsApi.mockResolvedValue({ data: { organizations: [ORG] } })
  createOpportunityApi.mockResolvedValue({ data: { opportunity: { id: 'opp-1' } } })
  renderWithProviders(<OpportunityForm />, { route: '/opportunities/create', path: '/opportunities/create' })

  await userEvent.type(await screen.findByLabelText(/^Title/), 'Night shelter shift')
  fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2099-06-01' } })
  fireEvent.change(screen.getByLabelText(/^Starts/, { selector: 'input[type="time"]' }), { target: { value: '22:00' } })
  fireEvent.change(screen.getByLabelText(/^Ends/, { selector: 'input[type="time"]' }), { target: { value: '02:00' } })
}

const submit = () => userEvent.click(screen.getByRole('button', { name: /Publish opportunity|Save draft/ }))

describe('Opportunity form — events that end after midnight', () => {
  it('points to the “ends the next day” option when the end is before the start', async () => {
    await setup()
    await submit()
    expect(await screen.findByText(/tick “Ends the next day”/)).toBeInTheDocument()
    expect(createOpportunityApi).not.toHaveBeenCalled()
  })

  it('sends ends_next_day when the box is ticked', async () => {
    await setup()
    await userEvent.click(screen.getByRole('checkbox', { name: /Ends the next day/ }))
    await submit()
    expect(createOpportunityApi).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '22:00', end_time: '02:00', ends_next_day: true, organization_id: 'org-1' }),
      'test-token'
    )
  })
})
