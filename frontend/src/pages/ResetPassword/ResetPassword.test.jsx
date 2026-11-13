import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPassword from './ResetPassword'
import Login from '../Login/Login'
import { resetPasswordApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderPage = (route = '/reset-password?token=abc123') =>
  renderWithProviders(<ResetPassword />, {
    route,
    path: '/reset-password',
    routes: [{ path: '/login', element: <Login /> }],
  })

describe('Reset password page', () => {
  it('asks for a new link when the URL has no token', () => {
    renderPage('/reset-password')
    expect(screen.getByRole('heading', { name: 'Link invalid or expired' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('enforces the password rules and matching confirmation', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'lettersonly')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different1')
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(screen.getByText('Include at least one letter and one number.')).toBeInTheDocument()
    expect(screen.getByText('Passwords don’t match.')).toBeInTheDocument()
    expect(resetPasswordApi).not.toHaveBeenCalled()
  })

  it('resets the password and sends the user to sign in', async () => {
    resetPasswordApi.mockResolvedValue({ status: 'success' })
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'NewPass123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass123')
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your password was reset.')
    expect(resetPasswordApi).toHaveBeenCalledWith('abc123', 'NewPass123')
  })

  it('switches to the expired-link screen when the token is rejected', async () => {
    resetPasswordApi.mockRejectedValue(
      Object.assign(new Error('This reset link is invalid or has expired'), { code: 'INVALID_TOKEN', status: 400 })
    )
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'NewPass123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass123')
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByRole('heading', { name: 'Link invalid or expired' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired')
  })
})
