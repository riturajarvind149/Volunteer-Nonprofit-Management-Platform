import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AcceptInvitation from './AcceptInvitation'
import { getMeApi, previewInvitationApi, acceptInvitationApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR, VOLUNTEER } from '../../test/fixtures'

vi.mock('../../services/api')

const INVITE = {
  organization_name: 'River Care',
  invited_by_name: 'Priya Owner',
  email: 'neha@ngo.org',
  expires_at: '2099-01-01',
  account_exists: false,
  account_can_accept: true,
}

const setup = ({ invitation = INVITE, previewError, signedInAs } = {}) => {
  if (signedInAs) {
    localStorage.setItem(TOKEN_KEY, 'test-token')
    getMeApi.mockResolvedValue({ data: { user: signedInAs } })
  }
  if (previewError) previewInvitationApi.mockRejectedValue(previewError)
  else previewInvitationApi.mockResolvedValue({ data: { invitation } })
  return renderWithProviders(<AcceptInvitation />, {
    route: '/invitations/accept?token=tok-1',
    path: '/invitations/accept',
    routes: [
      { path: '/organization-profile', element: <h1>My organizations page</h1> },
      { path: '/login', element: <h1>Sign in page</h1> },
    ],
  })
}

describe('Accept invitation', () => {
  it('creates a coordinator account and signs the new person in', async () => {
    acceptInvitationApi.mockResolvedValue({
      data: { token: 'new-token', organization_name: 'River Care', user: { ...COORDINATOR, email: 'neha@ngo.org' } },
    })
    setup()
    expect(await screen.findByRole('heading', { name: 'Join River Care' })).toBeInTheDocument()
    expect(screen.getByText(/Priya Owner invited you/)).toBeInTheDocument()
    expect(screen.getByText('neha@ngo.org')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Your full name'), 'Neha New')
    await userEvent.type(screen.getByLabelText('Choose a password'), 'Secret123!')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: 'Create account and join' }))

    expect(await screen.findByRole('heading', { name: 'My organizations page' })).toBeInTheDocument()
    expect(acceptInvitationApi).toHaveBeenCalledWith('tok-1', { full_name: 'Neha New', password: 'Secret123!' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token')
  })

  it('checks the name and password first', async () => {
    setup()
    await screen.findByRole('heading', { name: 'Join River Care' })
    await userEvent.click(screen.getByRole('button', { name: 'Create account and join' }))
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(acceptInvitationApi).not.toHaveBeenCalled()
  })

  it('asks an existing account to sign in first', async () => {
    setup({ invitation: { ...INVITE, account_exists: true } })
    await userEvent.click(await screen.findByRole('link', { name: 'Sign in to accept' }))
    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
  })

  it('lets the invited account join once signed in', async () => {
    acceptInvitationApi.mockResolvedValue({ data: { organization_name: 'River Care' } })
    setup({ invitation: { ...INVITE, account_exists: true }, signedInAs: { ...COORDINATOR, email: 'neha@ngo.org' } })
    await userEvent.click(await screen.findByRole('button', { name: 'Join River Care' }))
    expect(acceptInvitationApi).toHaveBeenCalledWith('tok-1', {}, 'test-token')
    expect(await screen.findByRole('heading', { name: 'My organizations page' })).toBeInTheDocument()
  })

  it('tells someone signed in as another account', async () => {
    setup({ signedInAs: VOLUNTEER })
    expect(await screen.findByText(/but this invitation is for/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out to continue' })).toBeInTheDocument()
  })

  it('explains an invalid or expired link', async () => {
    setup({ previewError: Object.assign(new Error('This invitation link is invalid, has expired or was already used.'), { code: 'INVITATION_INVALID' }) })
    expect(await screen.findByRole('heading', { name: 'Invitation not available' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('has expired')
  })
})
