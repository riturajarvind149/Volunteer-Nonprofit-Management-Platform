import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminOrganizations from './AdminOrganizations'
import AdminUsers from './AdminUsers'
import {
  getMeApi,
  getOpportunitiesApi,
  getAdminOrganizationsApi,
  reviewOrganizationApi,
  getAdminUsersApi,
  setUserActiveApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, ADMIN } from '../../test/fixtures'

vi.mock('../../services/api')

const PENDING_ORG = {
  id: 'org-1',
  name: 'Coast Care Trust',
  description: 'Beach cleanups every weekend.',
  verification_status: 'PENDING',
  coordinator_name: 'Ravi',
  coordinator_email: 'ravi@example.org',
  opportunity_count: 2,
  created_at: '2026-11-01',
}

const signInAsAdmin = () => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: ADMIN } })
  getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
}

describe('Organization review', () => {
  beforeEach(() => {
    signInAsAdmin()
    getAdminOrganizationsApi.mockResolvedValue({
      data: { organizations: [PENDING_ORG], pagination: { page: 1, limit: 20, total: 1, total_pages: 1 } },
    })
  })

  it('loads the pending queue by default', async () => {
    renderWithProviders(<AdminOrganizations />, { route: '/admin/organizations', path: '/admin/organizations' })
    expect(await screen.findByText('Coast Care Trust')).toBeInTheDocument()
    expect(getAdminOrganizationsApi).toHaveBeenCalledWith('test-token', expect.objectContaining({ status: 'PENDING', page: 1 }))
  })

  it('approves an organization', async () => {
    reviewOrganizationApi.mockResolvedValue({ data: { organization: { ...PENDING_ORG, verification_status: 'APPROVED' } } })
    renderWithProviders(<AdminOrganizations />, { route: '/admin/organizations', path: '/admin/organizations' })

    await userEvent.click(await screen.findByRole('button', { name: /Coast Care Trust/ }))
    expect(screen.getByText('Beach cleanups every weekend.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(reviewOrganizationApi).toHaveBeenCalledWith('org-1', 'APPROVED', undefined, 'test-token')
    expect(await screen.findByText(/is now approved\. The coordinator has been emailed\./)).toBeInTheDocument()
  })

  it('requires a note before rejecting', async () => {
    reviewOrganizationApi.mockResolvedValue({ data: { organization: { ...PENDING_ORG, verification_status: 'REJECTED' } } })
    renderWithProviders(<AdminOrganizations />, { route: '/admin/organizations', path: '/admin/organizations' })

    await userEvent.click(await screen.findByRole('button', { name: /Coast Care Trust/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note explaining why')
    expect(reviewOrganizationApi).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/Note to the coordinator/), 'Could not verify registration')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(reviewOrganizationApi).toHaveBeenCalledWith('org-1', 'REJECTED', 'Could not verify registration', 'test-token')
  })
})

describe('User management', () => {
  beforeEach(() => {
    signInAsAdmin()
    getAdminUsersApi.mockResolvedValue({
      data: {
        users: [
          { id: 'u-1', full_name: 'Asha', email: 'asha@example.org', role: 'VOLUNTEER', is_active: true, email_verified_at: '2026-01-01', created_at: '2026-01-01' },
          { ...ADMIN, is_active: true, email_verified_at: '2026-01-01' },
        ],
        pagination: { page: 1, limit: 25, total: 2, total_pages: 1 },
      },
    })
  })

  it('suspends a user after confirmation', async () => {
    setUserActiveApi.mockResolvedValue({ data: { user: { id: 'u-1', is_active: false } } })
    renderWithProviders(<AdminUsers />, { route: '/admin/users', path: '/admin/users' })

    const row = (await screen.findByText('Asha')).closest('tr')
    await userEvent.click(within(row).getByRole('button', { name: 'Suspend' }))
    expect(setUserActiveApi).not.toHaveBeenCalled()
    await userEvent.click(within(row).getByRole('button', { name: 'Yes, suspend' }))

    expect(setUserActiveApi).toHaveBeenCalledWith('u-1', false, 'test-token')
    expect(await screen.findByText(/Asha was suspended and signed out of every device/)).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('does not offer to suspend yourself or other admins', async () => {
    renderWithProviders(<AdminUsers />, { route: '/admin/users', path: '/admin/users' })
    const row = (await screen.findByText('You')).closest('tr')
    expect(within(row).queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument()
  })
})
