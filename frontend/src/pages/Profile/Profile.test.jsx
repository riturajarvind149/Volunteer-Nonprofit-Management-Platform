import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Profile from './Profile'
import {
  getMeApi,
  getOpportunitiesApi,
  getProfileApi,
  updateProfileApi,
  changePasswordApi,
  logoutAllApi,
  deleteAccountApi,
} from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, VOLUNTEER } from '../../test/fixtures'

vi.mock('../../services/api')

const PROFILE = {
  ...VOLUNTEER,
  phone: '',
  location: 'Pune',
  bio: '',
  skills: ['First aid'],
  email_notifications: true,
  stats: { total_hours: 12.5, completed_events: 4, organizations_supported: 2 },
}

const renderProfile = () =>
  renderWithProviders(<Profile />, {
    route: '/profile',
    path: '/profile',
    routes: [{ path: '/login', element: <h1>Sign in page</h1> }],
  })

describe('Account settings', () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'test-token')
    getMeApi.mockResolvedValue({ data: { user: VOLUNTEER } })
    getOpportunitiesApi.mockResolvedValue({ data: { opportunities: [] } })
    getProfileApi.mockResolvedValue({ data: { user: PROFILE } })
  })

  it('shows the volunteer’s impact', async () => {
    renderProfile()
    expect(await screen.findByText('Hours volunteered')).toBeInTheDocument()
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('saves profile details with skills as a list', async () => {
    updateProfileApi.mockResolvedValue({ data: { user: { ...PROFILE, location: 'Mumbai', skills: ['First aid', 'Hindi'] } } })
    renderProfile()

    const location = await screen.findByLabelText('City or area')
    await userEvent.clear(location)
    await userEvent.type(location, 'Mumbai')
    await userEvent.type(screen.getByLabelText('Skills'), ', Hindi, first aid')
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(updateProfileApi).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Mumbai', skills: ['First aid', 'Hindi'] }),
      'test-token',
    )
    expect(await screen.findByText('Your profile was saved.')).toBeInTheDocument()
  })

  it('toggles email updates', async () => {
    updateProfileApi.mockResolvedValue({ data: { user: { ...PROFILE, email_notifications: false } } })
    renderProfile()
    const toggle = await screen.findByRole('switch', { name: 'Email updates' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(toggle)
    expect(updateProfileApi).toHaveBeenCalledWith({ email_notifications: false }, 'test-token')
    await vi.waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })

  it('changes the password and keeps this session with the new token', async () => {
    changePasswordApi.mockResolvedValue({ data: { token: 'fresh-token' } })
    renderProfile()

    await userEvent.type(await screen.findByLabelText('Current password'), 'OldPass123')
    await userEvent.type(screen.getByLabelText('New password'), 'NewPass456')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass456')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(changePasswordApi).toHaveBeenCalledWith('OldPass123', 'NewPass456', 'test-token')
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
  })

  it('rejects a weak new password without calling the API', async () => {
    renderProfile()
    await userEvent.type(await screen.findByLabelText('Current password'), 'OldPass123')
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(changePasswordApi).not.toHaveBeenCalled()
  })

  it('signs out everywhere after confirmation', async () => {
    logoutAllApi.mockResolvedValue({ status: 'success' })
    renderProfile()
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere' }))
    expect(logoutAllApi).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('group', { name: 'Confirm signing out everywhere' }).querySelector('.btn-danger'))
    expect(logoutAllApi).toHaveBeenCalledWith('test-token')
    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('only deletes the account after password and typed confirmation', async () => {
    deleteAccountApi.mockResolvedValue({ status: 'success' })
    renderProfile()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account…' }))

    const confirmButton = screen.getByRole('button', { name: 'Permanently delete account' })
    await userEvent.type(screen.getByLabelText('Your password'), 'Secret123')
    expect(confirmButton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
    expect(confirmButton).toBeEnabled()

    await userEvent.click(confirmButton)
    expect(deleteAccountApi).toHaveBeenCalledWith('Secret123', 'test-token')
    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
  })

  it('shows why a coordinator cannot delete their account', async () => {
    deleteAccountApi.mockRejectedValue(new Error('You still manage an organization. Transfer or close it before deleting your account.'))
    renderProfile()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account…' }))
    await userEvent.type(screen.getByLabelText('Your password'), 'Secret123')
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE')
    await userEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You still manage an organization')
  })
})
