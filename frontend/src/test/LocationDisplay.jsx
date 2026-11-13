import { useLocation } from 'react-router-dom'

// Shows the current path so tests can assert on redirects.
export default function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}
