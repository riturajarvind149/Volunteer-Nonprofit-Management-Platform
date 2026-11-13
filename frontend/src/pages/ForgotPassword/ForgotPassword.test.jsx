import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPassword from './ForgotPassword'
import { forgotPasswordApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderPage = (options = {}) =>
  renderWithProviders(<ForgotPassword />, { route: '/forgot-password', path: '/forgot-password', ...options })

describe('Forgot password page', () => {
  it('validates the email before calling the API', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(forgotPasswordApi).not.toHaveBeenCalled()
  })

  it('sends the reset link and shows a generic confirmation', async () => {
    forgotPasswordApi.mockResolvedValue({ status: 'success' })
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), ' asha@example.org ')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists for asha@example.org')
    expect(forgotPasswordApi).toHaveBeenCalledWith('asha@example.org')
  })

  it('prefills the email passed from the sign-in page', () => {
    renderPage({ initialState: { email: 'asha@example.org' } })
    expect(screen.getByLabelText('Email address')).toHaveValue('asha@example.org')
  })

  it('shows server errors such as rate limiting', async () => {
    forgotPasswordApi.mockRejectedValue(new Error('Too many requests for this action. Please try again later.'))
    renderPage()
    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.org')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
  })
})
