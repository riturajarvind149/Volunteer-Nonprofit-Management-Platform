import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Register from './Register'
import Login from '../Login/Login'
import { registerApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../services/api')

const renderRegister = (route = '/register') =>
  renderWithProviders(<Register />, {
    route,
    path: '/register',
    routes: [{ path: '/login', element: <Login /> }],
  })

const fill = async ({ name = 'Asha Rao', email = 'asha@example.org', password = 'Secret123!', confirm = password } = {}) => {
  if (name) await userEvent.type(screen.getByLabelText('Full name'), name)
  if (email) await userEvent.type(screen.getByLabelText('Email address'), email)
  if (password) await userEvent.type(screen.getByLabelText('Password'), password)
  if (confirm) await userEvent.type(screen.getByLabelText('Confirm password'), confirm)
}

describe('Register page', () => {
  it('validates every field before calling the API', async () => {
    renderRegister()
    await fill({ name: 'A', email: 'not-an-email', password: 'short', confirm: 'different' })
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Enter your full name (at least 2 characters).')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText('Passwords don’t match.')).toBeInTheDocument()
    expect(registerApi).not.toHaveBeenCalled()
  })

  it('clears a field error as soon as the user edits that field', async () => {
    renderRegister()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Re-enter your password.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Confirm password'), 'x')
    expect(screen.queryByText('Re-enter your password.')).not.toBeInTheDocument()
  })

  it('defaults to volunteer and preselects coordinator from ?role=coordinator', () => {
    renderRegister('/register?role=coordinator')
    expect(screen.getByRole('radio', { name: /Coordinator/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Volunteer/ })).not.toBeChecked()
  })

  it('registers with the chosen role and sends the user to sign in', async () => {
    registerApi.mockResolvedValue({ status: 'success' })
    renderRegister()

    await userEvent.click(screen.getByRole('radio', { name: /Coordinator/ }))
    await fill({ name: '  Asha Rao ' })
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your account was created. Sign in to continue.')
    expect(registerApi).toHaveBeenCalledWith({
      full_name: 'Asha Rao',
      email: 'asha@example.org',
      password: 'Secret123!',
      role: 'COORDINATOR',
    })
  })

  it('requires a letter and a number in the password', async () => {
    renderRegister()
    await fill({ password: 'onlyletters' })
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Include at least one letter and one number.')).toBeInTheDocument()
    expect(registerApi).not.toHaveBeenCalled()
  })

  it('sends the user to "check your inbox" when email verification is required', async () => {
    registerApi.mockResolvedValue({ status: 'success', data: { requires_email_verification: true } })
    renderWithProviders(<Register />, {
      route: '/register',
      path: '/register',
      routes: [{ path: '/verify-email', element: <h1>Verify page</h1> }],
    })
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Verify page' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/verify-email')
  })

  it('shows the server error, e.g. an email that is already registered', async () => {
    registerApi.mockRejectedValue(new Error('Email is already registered'))
    renderRegister()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered')
    expect(screen.getByTestId('location')).toHaveTextContent('/register')
  })
})
