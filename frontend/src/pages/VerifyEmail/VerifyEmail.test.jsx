import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VerifyEmail from './VerifyEmail'
import { verifyEmailApi, verifyEmailCodeApi, resendVerificationApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderPage = (route, options = {}) =>
  renderWithProviders(<VerifyEmail />, { route, path: '/verify-email', ...options })

const codeError = (message) => Object.assign(new Error(message), { status: 400, code: 'INVALID_CODE' })

describe('Verify email page', () => {
  it('verifies the token from the email link once', async () => {
    verifyEmailApi.mockResolvedValue({ status: 'success' })
    renderPage('/verify-email?token=tok-1')

    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument()
    expect(verifyEmailApi).toHaveBeenCalledTimes(1)
    expect(verifyEmailApi).toHaveBeenCalledWith('tok-1')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('offers the code form when the link is invalid or expired', async () => {
    verifyEmailApi.mockRejectedValue(new Error('This verification link is invalid or has expired'))
    renderPage('/verify-email?token=old')

    expect(await screen.findByRole('heading', { name: 'Link invalid or expired' })).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeInTheDocument()
  })

  it('verifies with the 6-digit code after registering', async () => {
    verifyEmailCodeApi.mockResolvedValue({ message: 'Email verified successfully. You can now log in.' })
    renderPage('/verify-email', { initialState: { email: 'asha@example.org' } })

    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
    expect(screen.getByText('asha@example.org')).toBeInTheDocument()
    expect(verifyEmailApi).not.toHaveBeenCalled()

    // Pasted codes with spaces are cleaned up.
    await userEvent.type(screen.getByLabelText('Verification code'), '123 456')
    expect(screen.getByLabelText('Verification code')).toHaveValue('123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))

    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument()
    expect(verifyEmailCodeApi).toHaveBeenCalledWith('asha@example.org', '123456')
  })

  it('asks for all 6 digits before calling the API', async () => {
    renderPage('/verify-email', { initialState: { email: 'asha@example.org' } })
    await userEvent.type(screen.getByLabelText('Verification code'), '123')
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))

    expect(screen.getByText('Enter all 6 digits.')).toBeInTheDocument()
    expect(verifyEmailCodeApi).not.toHaveBeenCalled()
  })

  it('shows a wrong-code message next to the code field', async () => {
    verifyEmailCodeApi.mockRejectedValue(codeError('Incorrect code. 4 attempts left.'))
    renderPage('/verify-email', { initialState: { email: 'asha@example.org' } })
    await userEvent.type(screen.getByLabelText('Verification code'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))

    expect(await screen.findByText('Incorrect code. 4 attempts left.')).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toHaveAttribute('aria-invalid', 'true')
  })

  it('sends a new code', async () => {
    resendVerificationApi.mockResolvedValue({ message: 'A new verification code has been sent.', data: {} })
    renderPage('/verify-email', { initialState: { email: 'asha@example.org' } })

    await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    expect(await screen.findByRole('status')).toHaveTextContent('A new verification code has been sent.')
    expect(resendVerificationApi).toHaveBeenCalledWith('asha@example.org')
  })

  it('says when the email is not registered', async () => {
    resendVerificationApi.mockRejectedValue(
      Object.assign(new Error('No account is registered with this email address.'), { status: 404, code: 'EMAIL_NOT_REGISTERED' })
    )
    renderPage('/verify-email', { initialState: { email: 'nobody@example.org' } })

    await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No account is registered')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
  })
})
