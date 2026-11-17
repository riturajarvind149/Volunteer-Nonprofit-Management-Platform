import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPassword from './ResetPassword'
import Login from '../Login/Login'
import { resetPasswordApi, resetPasswordWithCodeApi, forgotPasswordApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderPage = (route = '/reset-password?token=abc123', options = {}) =>
  renderWithProviders(<ResetPassword />, {
    route,
    path: '/reset-password',
    routes: [{ path: '/login', element: <Login /> }],
    ...options,
  })

const fillPasswords = async (password = 'NewPass123', confirm = password) => {
  await userEvent.type(screen.getByLabelText('New password'), password)
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm)
}

describe('Reset password page (link)', () => {
  it('enforces the password rules and matching confirmation', async () => {
    renderPage()
    await fillPasswords('lettersonly', 'different1')
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(screen.getByText('Include at least one letter and one number.')).toBeInTheDocument()
    expect(screen.getByText('Passwords don’t match.')).toBeInTheDocument()
    expect(resetPasswordApi).not.toHaveBeenCalled()
  })

  it('resets the password and sends the user to sign in', async () => {
    resetPasswordApi.mockResolvedValue({ status: 'success' })
    renderPage()
    expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument()
    await fillPasswords()
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
    await fillPasswords()
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByRole('heading', { name: 'Link invalid or expired' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired')
    expect(screen.getByRole('link', { name: 'Request a new code' })).toHaveAttribute('href', '/forgot-password')
  })
})

describe('Reset password page (code)', () => {
  const withEmail = { initialState: { email: 'asha@example.org' } }

  it('resets the password with the 6-digit code', async () => {
    resetPasswordWithCodeApi.mockResolvedValue({ status: 'success' })
    renderPage('/reset-password', withEmail)

    expect(screen.getByLabelText('Email address')).toHaveValue('asha@example.org')
    await userEvent.type(screen.getByLabelText('Reset code'), '654321')
    await fillPasswords()
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(resetPasswordWithCodeApi).toHaveBeenCalledWith('asha@example.org', '654321', 'NewPass123')
  })

  it('requires the full code', async () => {
    renderPage('/reset-password', withEmail)
    await fillPasswords()
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(screen.getByText('Enter all 6 digits.')).toBeInTheDocument()
    expect(resetPasswordWithCodeApi).not.toHaveBeenCalled()
  })

  it('shows a wrong-code message next to the code field', async () => {
    resetPasswordWithCodeApi.mockRejectedValue(
      Object.assign(new Error('Incorrect code. 4 attempts left.'), { code: 'INVALID_CODE', status: 400 })
    )
    renderPage('/reset-password', withEmail)
    await userEvent.type(screen.getByLabelText('Reset code'), '000000')
    await fillPasswords()
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByText('Incorrect code. 4 attempts left.')).toBeInTheDocument()
  })

  it('sends a new code', async () => {
    forgotPasswordApi.mockResolvedValue({ message: 'A password reset code has been sent to asha@example.org.' })
    renderPage('/reset-password', withEmail)
    await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }))

    expect(await screen.findByRole('status')).toHaveTextContent('A password reset code has been sent')
    expect(forgotPasswordApi).toHaveBeenCalledWith('asha@example.org')
  })
})
