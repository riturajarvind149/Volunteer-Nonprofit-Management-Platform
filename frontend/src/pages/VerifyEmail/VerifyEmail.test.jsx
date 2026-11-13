import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VerifyEmail from './VerifyEmail'
import { verifyEmailApi, resendVerificationApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderPage = (route, options = {}) =>
  renderWithProviders(<VerifyEmail />, { route, path: '/verify-email', ...options })

describe('Verify email page', () => {
  it('verifies the token from the email link once', async () => {
    verifyEmailApi.mockResolvedValue({ status: 'success' })
    renderPage('/verify-email?token=tok-1')

    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument()
    expect(verifyEmailApi).toHaveBeenCalledTimes(1)
    expect(verifyEmailApi).toHaveBeenCalledWith('tok-1')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('offers a new link when the token is invalid or expired', async () => {
    verifyEmailApi.mockRejectedValue(new Error('This verification link is invalid or has expired'))
    renderPage('/verify-email?token=old')

    expect(await screen.findByRole('heading', { name: 'Link invalid or expired' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeInTheDocument()
  })

  it('shows "check your inbox" after registering and can resend', async () => {
    resendVerificationApi.mockResolvedValue({ message: 'A new verification link has been sent.' })
    renderPage('/verify-email', { initialState: { email: 'asha@example.org' } })

    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(screen.getByText('asha@example.org')).toBeInTheDocument()
    expect(verifyEmailApi).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
    expect(await screen.findByRole('status')).toHaveTextContent('A new verification link has been sent.')
    expect(resendVerificationApi).toHaveBeenCalledWith('asha@example.org')
  })
})
