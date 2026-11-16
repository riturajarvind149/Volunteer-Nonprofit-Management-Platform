import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './Login'
import VerifyEmail from '../VerifyEmail/VerifyEmail'
import { loginApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { VOLUNTEER } from '../../test/fixtures'

vi.mock('../../services/api')

const renderLogin = (options = {}) =>
  renderWithProviders(<Login />, {
    route: '/login',
    path: '/login',
    routes: [{ path: '/dashboard', element: <h1>Dashboard page</h1> }],
    ...options,
  })

describe('Login page', () => {
  it('shows field errors and does not call the API when the form is empty', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true')
    expect(loginApi).not.toHaveBeenCalled()
  })

  it('signs in, stores the token and goes to the dashboard', async () => {
    loginApi.mockResolvedValue({ data: { token: 'jwt-token', user: VOLUNTEER } })
    renderLogin()

    await userEvent.type(screen.getByLabelText('Email address'), '  asha@example.org ')
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument()
    expect(loginApi).toHaveBeenCalledWith({ email: 'asha@example.org', password: 'Secret123!' })
    expect(localStorage.getItem('servehub_token')).toBe('jwt-token')
  })

  it('shows the server error when sign-in fails', async () => {
    loginApi.mockRejectedValue(new Error('Incorrect password. Try again or use "Forgot password?" to reset it.'))
    renderLogin()

    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.org')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('toggles password visibility', async () => {
    renderLogin()
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('sends an unverified user to the code screen with their email', async () => {
    loginApi.mockRejectedValue(
      Object.assign(new Error('Please verify your email address before logging in.'), {
        status: 403,
        code: 'EMAIL_NOT_VERIFIED',
      })
    )
    renderLogin({ routes: [{ path: '/verify-email', element: <VerifyEmail /> }] })
    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.org')
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('verify your email')
    await userEvent.click(screen.getByRole('link', { name: 'Enter verification code' }))

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email address', { selector: '#verify-email' })).toHaveValue('asha@example.org')
  })

  it('says when the email is not registered and links to sign up', async () => {
    loginApi.mockRejectedValue(
      Object.assign(new Error('No account is registered with this email address.'), {
        status: 404,
        code: 'EMAIL_NOT_REGISTERED',
      })
    )
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email address'), 'new@example.org')
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No account is registered')
    expect(screen.getAllByRole('link', { name: 'Create an account' })[0]).toHaveAttribute('href', '/register')
  })

  it('links to the forgot-password page', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
  })

  it('shows the success message passed from registration', () => {
    renderLogin({ initialState: { message: 'Your account was created. Sign in to continue.' } })
    expect(screen.getByRole('status')).toHaveTextContent('Your account was created.')
  })
})
