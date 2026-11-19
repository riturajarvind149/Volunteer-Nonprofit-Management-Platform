import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Team from './Team'
import {
  getMeApi,
  getTeamApi,
  inviteCoordinatorApi,
  revokeInvitationApi,
  removeMemberApi,
  transferOwnershipApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const OWNER = { ...COORDINATOR, id: 'owner-1', full_name: 'Priya Owner', email: 'priya@ngo.org' }
const STAFF = { id: 'staff-1', full_name: 'Sam Staff', email: 'sam@ngo.org', role: 'COORDINATOR', member_since: '2026-10-01' }

const teamFor = (myRole) => ({
  organization: { id: 'org-1', name: 'River Care', my_role: myRole },
  members: [
    { id: OWNER.id, full_name: OWNER.full_name, email: OWNER.email, role: 'OWNER', member_since: '2026-09-01' },
    STAFF,
  ],
  invitations: myRole === 'OWNER' ? [{ id: 'inv-1', email: 'new@ngo.org', created_at: '2026-11-01', expires_at: '2026-11-08' }] : [],
})

const setup = (me, myRole) => {
  localStorage.setItem(TOKEN_KEY, 'test-token')
  getMeApi.mockResolvedValue({ data: { user: me } })
  getTeamApi.mockResolvedValue({ data: teamFor(myRole) })
  return renderWithProviders(<Team />, {
    route: '/organizations/org-1/team',
    path: '/organizations/:id/team',
    routes: [{ path: '/organization-profile', element: <h1>My organizations page</h1> }],
  })
}

const rowFor = async (name) => (await screen.findByText(name)).closest('li')

describe('Team page — NGO admin', () => {
  it('lists members with their roles and the pending invitations', async () => {
    setup(OWNER, 'OWNER')
    expect(await screen.findByRole('heading', { name: 'River Care — Team' })).toBeInTheDocument()
    expect(within(await rowFor('Sam Staff')).getByText('Coordinator')).toBeInTheDocument()
    expect(within(await rowFor('Priya Owner')).getByText('NGO admin')).toBeInTheDocument()
    expect(screen.getByText('new@ngo.org')).toBeInTheDocument()
  })

  it('invites a coordinator by email', async () => {
    inviteCoordinatorApi.mockResolvedValue({ message: 'Invitation sent to ravi@ngo.org' })
    setup(OWNER, 'OWNER')
    await userEvent.type(await screen.findByLabelText('Invite a coordinator by email'), 'ravi@ngo.org')
    await userEvent.click(screen.getByRole('button', { name: /Send invitation/ }))

    expect(inviteCoordinatorApi).toHaveBeenCalledWith('org-1', 'ravi@ngo.org', 'test-token')
    expect(await screen.findByText('Invitation sent to ravi@ngo.org')).toBeInTheDocument()
  })

  it('checks the email before inviting', async () => {
    setup(OWNER, 'OWNER')
    await userEvent.type(await screen.findByLabelText('Invite a coordinator by email'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: /Send invitation/ }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(inviteCoordinatorApi).not.toHaveBeenCalled()
  })

  it('asks before removing a coordinator', async () => {
    removeMemberApi.mockResolvedValue({ status: 'success' })
    setup(OWNER, 'OWNER')
    const row = await rowFor('Sam Staff')
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(removeMemberApi).not.toHaveBeenCalled()
    await userEvent.click(within(row).getByRole('button', { name: 'Yes, remove' }))
    expect(removeMemberApi).toHaveBeenCalledWith('org-1', 'staff-1', 'test-token')
    expect(await screen.findByText('Sam Staff was removed from the team.')).toBeInTheDocument()
  })

  it('hands over the NGO admin role after confirming', async () => {
    transferOwnershipApi.mockResolvedValue({ status: 'success' })
    setup(OWNER, 'OWNER')
    const row = await rowFor('Sam Staff')
    await userEvent.click(within(row).getByRole('button', { name: 'Make NGO admin' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Yes, hand over' }))
    expect(transferOwnershipApi).toHaveBeenCalledWith('org-1', 'staff-1', 'test-token')
  })

  it('cancels and resends invitations', async () => {
    revokeInvitationApi.mockResolvedValue({ status: 'success' })
    inviteCoordinatorApi.mockResolvedValue({ message: 'Invitation sent to new@ngo.org' })
    setup(OWNER, 'OWNER')
    const row = await rowFor('new@ngo.org')
    await userEvent.click(within(row).getByRole('button', { name: 'Resend' }))
    expect(inviteCoordinatorApi).toHaveBeenCalledWith('org-1', 'new@ngo.org', 'test-token')
    await userEvent.click(within(await rowFor('new@ngo.org')).getByRole('button', { name: 'Cancel invitation' }))
    expect(revokeInvitationApi).toHaveBeenCalledWith('org-1', 'inv-1', 'test-token')
  })
})

describe('Team page — coordinator', () => {
  it('shows the team without management tools and lets them leave', async () => {
    removeMemberApi.mockResolvedValue({ status: 'success' })
    setup({ ...COORDINATOR, id: STAFF.id, email: STAFF.email, full_name: STAFF.full_name }, 'COORDINATOR')
    const myRow = await rowFor('Sam Staff')
    expect(screen.queryByLabelText('Invite a coordinator by email')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByText('Pending invitations')).not.toBeInTheDocument()

    await userEvent.click(within(myRow).getByRole('button', { name: 'Leave NGO' }))
    await userEvent.click(within(myRow).getByRole('button', { name: 'Yes, leave' }))
    expect(removeMemberApi).toHaveBeenCalledWith('org-1', 'staff-1', 'test-token')
    expect(await screen.findByRole('heading', { name: 'My organizations page' })).toBeInTheDocument()
  })
})
