import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom doesn't implement scrolling; App's ScrollToTop calls it on every route change.
window.scrollTo = () => {}
