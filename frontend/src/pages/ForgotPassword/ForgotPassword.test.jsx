import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPassword from './ForgotPassword'
import ResetPassword from '../ResetPassword/ResetPassword'
import { forgotPasswordApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderPage = (options = {}) =>
  renderWithProviders(<ForgotPassword />, {
    route: '/forgot-password',
    path: '/forgot-password',
    routes: [{ path: '/reset-password', element: <ResetPassword /> }],
    ...options,
  })

describe('Forgot password page', () => {
  it('validates the email before calling the API', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(forgotPasswordApi).not.toHaveBeenCalled()
  })

  it('sends the code and opens the code-entry screen with the email filled in', async () => {
    forgotPasswordApi.mockResolvedValue({ status: 'success', message: 'A password reset code has been sent to asha@example.org.' })
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), ' asha@example.org ')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('A password reset code has been sent')
    expect(screen.getByLabelText('Email address')).toHaveValue('asha@example.org')
    expect(forgotPasswordApi).toHaveBeenCalledWith('asha@example.org')
  })

  it('prefills the email passed from the sign-in page', () => {
    renderPage({ initialState: { email: 'asha@example.org' } })
    expect(screen.getByLabelText('Email address')).toHaveValue('asha@example.org')
  })

  it('says when the email is not registered', async () => {
    forgotPasswordApi.mockRejectedValue(
      Object.assign(new Error('No account is registered with this email address.'), { status: 404, code: 'EMAIL_NOT_REGISTERED' })
    )
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), 'nobody@example.org')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No account is registered')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
  })

  it('shows server errors such as rate limiting', async () => {
    forgotPasswordApi.mockRejectedValue(new Error('Too many requests for this action. Please try again later.'))
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.org')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
  })
})
