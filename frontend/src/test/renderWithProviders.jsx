import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { OpportunityProvider } from '../context/OpportunityContext'
import LocationDisplay from './LocationDisplay'

/**
 * Renders `ui` inside the real Auth/Opportunity providers and a MemoryRouter.
 * `routes` lets a test register extra paths (e.g. the page a redirect lands on).
 */
export function renderWithProviders(ui, { route = '/', path = '*', routes = [], initialState } = {}) {
  const entry = initialState ? { pathname: route, state: initialState } : route
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <OpportunityProvider>
          <Routes>
            <Route path={path} element={ui} />
            {routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          </Routes>
          <LocationDisplay />
        </OpportunityProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}
