import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'
import { isStaleBuildError, reloadOnceForNewVersion } from '../utils/staleBuild'

function Boom({ message }) {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('shows a recovery screen instead of a blank page', () => {
    render(
      <ErrorBoundary>
        <Boom message="cannot read properties of undefined" />
      </ErrorBoundary>
    )
    expect(screen.getByRole('heading', { name: 'Something went wrong on this page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home page' })).toHaveAttribute('href', '/')
  })

  it('recovers when the user navigates to another page', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/broken">
        <Boom message="broken page" />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="/dashboard">
        <p>Dashboard content</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('explains an update when files from an old deploy are missing', () => {
    sessionStorage.setItem('servehub_reloaded_for_new_version', String(Date.now())) // already reloaded once
    render(
      <ErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/Page-abc.js" />
      </ErrorBoundary>
    )
    expect(screen.getByRole('heading', { name: 'ServeHub was just updated' })).toBeInTheDocument()
  })
})

describe('stale build detection', () => {
  afterEach(() => sessionStorage.clear())

  it('recognises missing-chunk errors from all major browsers', () => {
    expect(isStaleBuildError(new Error('Failed to fetch dynamically imported module: x.js'))).toBe(true)
    expect(isStaleBuildError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isStaleBuildError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isStaleBuildError(new Error('user is undefined'))).toBe(false)
  })

  it('does not reload again within a minute, so it can never loop', () => {
    sessionStorage.setItem('servehub_reloaded_for_new_version', String(Date.now()))
    expect(reloadOnceForNewVersion()).toBe(false)
  })
})
