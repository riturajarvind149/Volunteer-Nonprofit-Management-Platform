import { Link, useLocation } from 'react-router-dom'
import './NotFound.css'

function NotFound() {
  const { pathname } = useLocation()

  return (
    <main className="not-found-page">
      <div className="not-found-container">
        <div className="not-found-code">404</div>
        <h1>Page not found</h1>
        <p>
          The page at <code className="not-found-path">{pathname}</code> doesn't exist or has been moved.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">Go to Home</Link>
          <Link to="/opportunities" className="btn btn-secondary">Browse Opportunities</Link>
        </div>
      </div>
    </main>
  )
}

export default NotFound
