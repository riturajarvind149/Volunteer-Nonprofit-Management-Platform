import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminOrganizations from './AdminOrganizations'
import AdminUsers from './AdminUsers'
import AdminOverview from './AdminOverview'
import {
  getMeApi,
  getOpportunitiesApi,
  getAdminOrganizationsApi,
  reviewOrganizationApi,
  closeOrganizationApi,
  getAdminUsersApi,
  setUserActiveApi,
  reviewVolunteerApi,
  getAdminStatsApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, ADMIN } from '../../test/fixtures'

vi.mock('../../services/api')

const PENDING_ORG = {
  id: 'org-1',
  name: 'Coast Care Trust',
  description: 'Beach cleanups every weekend.',
  verification_status: 'PENDING',
  owner_name: 'Ravi',
  owner_email: 'ravi@example.org',
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
    expect(await screen.findByText(/is now approved\. The NGO admin has been emailed\./)).toBeInTheDocument()
  })

  it('requires a note before rejecting', async () => {
    reviewOrganizationApi.mockResolvedValue({ data: { organization: { ...PENDING_ORG, verification_status: 'REJECTED' } } })
    renderWithProviders(<AdminOrganizations />, { route: '/admin/organizations', path: '/admin/organizations' })

    await userEvent.click(await screen.findByRole('button', { name: /Coast Care Trust/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note explaining why')
    expect(reviewOrganizationApi).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/Note to the NGO admin/), 'Could not verify registration')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(reviewOrganizationApi).toHaveBeenCalledWith('org-1', 'REJECTED', 'Could not verify registration', 'test-token')
  })

  it('closes an NGO only after a reason and a confirmation', async () => {
    closeOrganizationApi.mockResolvedValue({
      data: { organization: { ...PENDING_ORG, verification_status: 'CLOSED' }, cancelled_events: 2 },
    })
    renderWithProviders(<AdminOrganizations />, { route: '/admin/organizations', path: '/admin/organizations' })

    await userEvent.click(await screen.findByRole('button', { name: /Coast Care Trust/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Close NGO' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note explaining why')

    await userEvent.type(screen.getByLabelText(/Note to the NGO admin/), 'The NGO asked to leave')
    await userEvent.click(screen.getByRole('button', { name: 'Close NGO' }))
    expect(screen.getByText(/This can’t be undone/)).toBeInTheDocument()
    expect(closeOrganizationApi).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Yes, close this NGO' }))
    expect(closeOrganizationApi).toHaveBeenCalledWith('org-1', 'The NGO asked to leave', 'test-token')
    expect(await screen.findByText(/was closed\. 2 upcoming events were cancelled/)).toBeInTheDocument()
  })

  it('shows closed NGOs without review actions', async () => {
    getAdminOrganizationsApi.mockResolvedValue({
      data: {
        organizations: [{ ...PENDING_ORG, verification_status: 'CLOSED', owner_name: null, owner_email: null, verification_note: 'Asked to leave', closed_at: '2026-11-20' }],
        pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
      },
    })
    renderWithProviders(<AdminOrganizations />, { route: '/admin/organizations', path: '/admin/organizations' })

    await userEvent.click(await screen.findByRole('button', { name: /Coast Care Trust/ }))
    expect(screen.getByText(/Closed NGOs can’t be reviewed or reopened/)).toBeInTheDocument()
    expect(screen.getByText('Asked to leave')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close NGO' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
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
    expect(within(row).queryByRole('button', { name: 'Review details' })).not.toBeInTheDocument()
  })
})

describe('Volunteer verification', () => {
  const VOL = {
    id: 'u-2',
    full_name: 'Meera Real',
    email: 'meera@example.org',
    role: 'VOLUNTEER',
    is_active: true,
    email_verified_at: '2026-01-01',
    created_at: '2026-01-01',
    phone: '+91 98765 43210',
    location: 'Bengaluru',
    date_of_birth: '1998-04-12',
    emergency_contact_name: 'Ravi Kumar',
    emergency_contact_phone: '+91 91234 56789',
    id_type: 'AADHAAR',
    id_last4: '1234',
    verification_status: 'UNVERIFIED',
    missing_details: [],
  }

  const listWith = (users) =>
    getAdminUsersApi.mockResolvedValue({ data: { users, pagination: { page: 1, limit: 25, total: users.length, total_pages: 1 } } })

  beforeEach(() => signInAsAdmin())

  it('shows a volunteer’s details and marks them verified', async () => {
    listWith([VOL])
    reviewVolunteerApi.mockResolvedValue({ data: { user: { ...VOL, verification_status: 'VERIFIED' } } })
    renderWithProviders(<AdminUsers />, { route: '/admin/users', path: '/admin/users' })

    const row = (await screen.findByText('Meera Real')).closest('tr')
    expect(within(row).getByText('Not reviewed')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Review details' }))

    expect(screen.getByText('Ravi Kumar · +91 91234 56789')).toBeInTheDocument()
    expect(screen.getByText('Aadhaar ending 1234')).toBeInTheDocument()
    expect(screen.getByText(/April 12, 1998 \(age \d+\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark verified' }))

    expect(reviewVolunteerApi).toHaveBeenCalledWith('u-2', 'VERIFIED', undefined, 'test-token')
    expect(await screen.findByText(/Meera Real is marked as a verified volunteer/)).toBeInTheDocument()
    expect(within(row).getByText('Verified')).toBeInTheDocument()
  })

  it('requires a note before flagging a volunteer', async () => {
    listWith([VOL])
    reviewVolunteerApi.mockResolvedValue({ data: { user: { ...VOL, verification_status: 'FLAGGED' } } })
    renderWithProviders(<AdminUsers />, { route: '/admin/users', path: '/admin/users' })

    await userEvent.click(await screen.findByRole('button', { name: 'Review details' }))
    await userEvent.click(screen.getByRole('button', { name: 'Flag as suspicious' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note explaining why')
    expect(reviewVolunteerApi).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/^Note/), 'Phone does not answer')
    await userEvent.click(screen.getByRole('button', { name: 'Flag as suspicious' }))
    expect(reviewVolunteerApi).toHaveBeenCalledWith('u-2', 'FLAGGED', 'Phone does not answer', 'test-token')
  })

  it('cannot verify a volunteer whose details are incomplete', async () => {
    listWith([{ ...VOL, date_of_birth: null, missing_details: ['date_of_birth'] }])
    renderWithProviders(<AdminUsers />, { route: '/admin/users', path: '/admin/users' })

    const row = (await screen.findByText('Meera Real')).closest('tr')
    expect(within(row).getByText('Details incomplete')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Review details' }))
    expect(screen.getByText(/missing date of birth/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark verified' })).toBeDisabled()
  })

  it('filters volunteers by verification status', async () => {
    listWith([VOL])
    renderWithProviders(<AdminUsers />, { route: '/admin/users', path: '/admin/users' })
    await screen.findByText('Meera Real')
    await userEvent.click(screen.getByRole('button', { name: 'Volunteers' }))
    await userEvent.click(screen.getByRole('button', { name: 'Flagged' }))
    await vi.waitFor(() =>
      expect(getAdminUsersApi).toHaveBeenLastCalledWith('test-token', expect.objectContaining({ role: 'VOLUNTEER', verification: 'FLAGGED' })),
    )
  })
})

describe('Admin overview email status', () => {
  const renderOverview = async (email) => {
    signInAsAdmin()
    getAdminStatsApi.mockResolvedValue({ data: { stats: { volunteers: 3 }, email } })
    getAdminOrganizationsApi.mockResolvedValue({ data: { organizations: [] } })
    renderWithProviders(<AdminOverview />, { route: '/admin', path: '/admin' })
    return screen.findByText(/Email (delivery|is)/)
  }

  it('confirms when email works', async () => {
    await renderOverview({ state: 'ok', host: 'smtp-relay.brevo.com', from: 'ServeHub <a@b.org>' })
    expect(screen.getByText(/Messages are sent through smtp-relay\.brevo\.com/)).toBeInTheDocument()
  })

  it('warns when email is not set up and explains verification is paused', async () => {
    await renderOverview({ state: 'not_configured' })
    expect(screen.getByRole('alert')).toHaveTextContent('Email is not set up')
    expect(screen.getByRole('alert')).toHaveTextContent('Email verification is switched off')
  })

  it('shows the reason when delivery is failing', async () => {
    await renderOverview({ state: 'failed', detail: 'The mail server rejected SMTP_USER / SMTP_PASS.' })
    expect(screen.getByRole('alert')).toHaveTextContent('The mail server rejected SMTP_USER / SMTP_PASS.')
  })
})
