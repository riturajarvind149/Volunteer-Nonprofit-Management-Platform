import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrgProfile from './OrgProfile'
import { getMeApi, getMyOrganizationsApi, getManagedOpportunitiesApi, updateOrganizationApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const ORG = {
  id: 'org-1',
  name: 'Green Earth',
  description: 'Tree planting',
  coordinator_id: COORDINATOR.id,
  website: null,
  email: null,
  phone: null,
  address: null,
  social_links: {},
  created_at: '2026-01-10',
}

const setup = () => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: COORDINATOR } })
  getMyOrganizationsApi.mockResolvedValue({ data: { organizations: [ORG] } })
  getManagedOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
  return renderWithProviders(<OrgProfile />, { route: '/organization-profile', path: '/organization-profile' })
}

describe('My organizations — editing', () => {
  it('saves name, about, contact and social details', async () => {
    updateOrganizationApi.mockImplementation((id, fields) =>
      Promise.resolve({ data: { organization: { ...ORG, ...fields } } })
    )
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))

    const name = screen.getByLabelText(/^Name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Green Earth Trust')
    await userEvent.type(screen.getByLabelText(/^Website/), 'https://greenearth.org')
    await userEvent.type(screen.getByLabelText(/^Phone/), '+91 98765 43210')
    await userEvent.type(screen.getByLabelText(/^Instagram/), '@greenearth')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateOrganizationApi).toHaveBeenCalledWith(
      'org-1',
      {
        name: 'Green Earth Trust',
        description: 'Tree planting',
        website: 'https://greenearth.org',
        email: null,
        phone: '+91 98765 43210',
        address: null,
        social_links: { instagram: '@greenearth' },
      },
      'test-token'
    )
    expect(await screen.findByText(/Changes saved/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Green Earth Trust' })).toBeInTheDocument()
  })

  it('checks the details before saving', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
    await userEvent.type(screen.getByLabelText(/^Website/), 'greenearth')
    await userEvent.type(screen.getByLabelText(/^Email/), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByText('Enter a full address starting with https://')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(updateOrganizationApi).not.toHaveBeenCalled()
  })

  it('no longer says organizations can’t be edited', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Green Earth' })
    expect(screen.queryByText(/can’t be edited/)).not.toBeInTheDocument()
  })
})
