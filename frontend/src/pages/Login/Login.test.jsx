import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './Login'
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
    loginApi.mockRejectedValue(new Error('Invalid email or password'))
    renderLogin()

    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.org')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
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

  it('offers to resend the verification email when the address is not verified', async () => {
    loginApi.mockRejectedValue(
      Object.assign(new Error('Please verify your email address before logging in.'), {
        status: 403,
        code: 'EMAIL_NOT_VERIFIED',
      })
    )
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.org')
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('verify your email')
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email address', { selector: '#resend-email' })).toHaveValue('asha@example.org')
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
