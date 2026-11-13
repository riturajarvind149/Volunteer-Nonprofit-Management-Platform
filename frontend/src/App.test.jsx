import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import * as api from './services/api'
import LocationDisplay from './test/LocationDisplay'
import { TOKEN_KEY, VOLUNTEER, COORDINATOR } from './test/fixtures'

vi.mock('./services/api')

// Renders the real App routes at `route`, signed in as `user` (or signed out).
const renderApp = (route, user) => {
  if (user) {
    localStorage.setItem(TOKEN_KEY, 'test-token')
    api.getMeApi.mockResolvedValue({ data: { user } })
  }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
      <LocationDisplay />
    </MemoryRouter>,
  )
}

const expectPath = async (path) => {
  await vi.waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(new RegExp(`^${path}$`)))
}

describe('Role-based routing', () => {
  beforeEach(() => {
    // Every page's data call resolves to an empty response; these tests only check routing.
    for (const fn of Object.values(api)) {
      if (vi.isMockFunction(fn)) fn.mockResolvedValue({ data: {} })
    }
  })

  it('sends signed-out users to sign in, remembering where they were going', async () => {
    renderApp('/my-signups')
    await expectPath('/login')
    expect(screen.getByText('Sign in to continue to that page.')).toBeInTheDocument()
  })

  it('drops an invalid saved session and asks the user to sign in', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    api.getMeApi.mockRejectedValue(new Error('Token has expired'))
    renderApp('/dashboard')

    await expectPath('/login')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('keeps volunteers out of coordinator pages', async () => {
    renderApp('/manage-opportunities', VOLUNTEER)
    await expectPath('/dashboard')
  })

  it('keeps coordinators out of volunteer pages', async () => {
    renderApp('/my-signups', COORDINATOR)
    await expectPath('/dashboard')
  })

  it('lets coordinators open coordinator pages', async () => {
    renderApp('/manage-opportunities', COORDINATOR)
    expect(await screen.findByRole('heading', { level: 1, name: /Opportunities/ })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/manage-opportunities')
  })

  it('lets volunteers open volunteer pages', async () => {
    renderApp('/my-signups', VOLUNTEER)
    await screen.findByRole('navigation', { name: 'Main' })
    expect(screen.getByTestId('location')).toHaveTextContent('/my-signups')
  })

  it('shows role-specific navigation', async () => {
    renderApp('/dashboard', COORDINATOR)
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(nav).toHaveTextContent('Hours & attendance')
    expect(nav).not.toHaveTextContent('My registrations')
  })
})
