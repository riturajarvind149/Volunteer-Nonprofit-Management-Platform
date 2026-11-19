import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NgoRegister from './NgoRegister'
import RegisterMyNgo from './RegisterMyNgo'
import { getMeApi, registerOrganizationApi, registerMyNgoApi } from '../../services/api'
import { renderWithProviders } from '../../test/renderWithProviders'
import { TOKEN_KEY, COORDINATOR } from '../../test/fixtures'

vi.mock('../../services/api')

const renderPublic = () =>
  renderWithProviders(<NgoRegister />, {
    route: '/register/ngo',
    path: '/register/ngo',
    routes: [{ path: '/verify-email', element: <h1>Verify page</h1> }],
  })

const fillNgo = async ({ name = 'Riverside Trust', type = 'TRUST', city = 'Pune', number = 'MH/2024/12', website = '' } = {}) => {
  if (name) await userEvent.type(screen.getByLabelText(/^NGO name/), name)
  if (type) await userEvent.selectOptions(screen.getByLabelText(/^Type of NGO/), type)
  if (number) await userEvent.type(screen.getByLabelText(/^Registration number/), number)
  if (city) await userEvent.type(screen.getByLabelText(/^City/), city)
  if (website) await userEvent.type(screen.getByLabelText(/^Website/), website)
}

const fillPerson = async ({ name = 'Asha Rao', email = 'asha@riverside.org', phone = '+91 98765 43210', password = 'Secret123!' } = {}) => {
  await userEvent.type(screen.getByLabelText('Your full name'), name)
  await userEvent.type(screen.getByLabelText('Email address'), email)
  await userEvent.type(screen.getByLabelText('Phone number'), phone)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.type(screen.getByLabelText('Confirm password'), password)
}

describe('Register your NGO (public)', () => {
  it('offers the volunteer path too, with the NGO option selected', () => {
    renderPublic()
    expect(screen.getByRole('link', { name: /I represent an NGO/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /I want to volunteer/ })).toHaveAttribute('href', '/register')
  })

  it('checks the NGO and personal details before calling the API', async () => {
    renderPublic()
    await userEvent.click(screen.getByRole('button', { name: 'Register NGO' }))

    expect(screen.getByText('Enter your NGO’s name.')).toBeInTheDocument()
    expect(screen.getByText('Choose the type of NGO.')).toBeInTheDocument()
    expect(screen.getByText('Enter the city your NGO works in.')).toBeInTheDocument()
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a phone number the ServeHub team can reach you on.')).toBeInTheDocument()
    expect(registerOrganizationApi).not.toHaveBeenCalled()
  })

  it('registers the NGO with its admin and goes to email verification', async () => {
    registerOrganizationApi.mockResolvedValue({ data: { requires_email_verification: true } })
    renderPublic()
    await fillNgo({ website: 'https://riverside.org' })
    await fillPerson()
    await userEvent.click(screen.getByRole('button', { name: 'Register NGO' }))

    expect(await screen.findByRole('heading', { name: 'Verify page' })).toBeInTheDocument()
    expect(registerOrganizationApi).toHaveBeenCalledWith({
      full_name: 'Asha Rao',
      email: 'asha@riverside.org',
      phone: '+91 98765 43210',
      password: 'Secret123!',
      organization: {
        name: 'Riverside Trust',
        description: undefined,
        registration_type: 'TRUST',
        registration_number: 'MH/2024/12',
        city: 'Pune',
        website: 'https://riverside.org',
      },
    })
  })

  it('shows a taken NGO name next to the name field', async () => {
    registerOrganizationApi.mockRejectedValue(
      Object.assign(new Error('An NGO with this name is already registered.'), { status: 409, code: 'ORG_NAME_TAKEN' })
    )
    renderPublic()
    await fillNgo()
    await fillPerson()
    await userEvent.click(screen.getByRole('button', { name: 'Register NGO' }))

    expect(await screen.findByText('An NGO with this name is already registered.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^NGO name/)).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Register your NGO (signed in)', () => {
  it('lets a coordinator without an NGO register one', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token')
    getMeApi.mockResolvedValue({ data: { user: COORDINATOR } })
    registerMyNgoApi.mockResolvedValue({ data: { organization: { id: 'org-9', verification_status: 'PENDING' } } })
    renderWithProviders(<RegisterMyNgo />, {
      route: '/organizations/register',
      path: '/organizations/register',
      routes: [{ path: '/organization-profile', element: <h1>My organizations page</h1> }],
    })

    await fillNgo({ number: '' })
    await userEvent.click(screen.getByRole('button', { name: 'Register NGO' }))

    expect(await screen.findByRole('heading', { name: 'My organizations page' })).toBeInTheDocument()
    expect(registerMyNgoApi).toHaveBeenCalledWith(
      { name: 'Riverside Trust', description: undefined, registration_type: 'TRUST', registration_number: undefined, city: 'Pune', website: undefined },
      'test-token'
    )
  })
})
