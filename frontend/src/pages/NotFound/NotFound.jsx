import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './NotFound.css'

function NotFound() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()

  return (
    <div className="not-found">
      <p className="not-found-code">Error 404</p>
      <h1>This page doesn’t exist</h1>
      <p>
        Nothing is available at <code>{pathname}</code>. The link may be mistyped, or the page may have been removed.
      </p>
      <div className="not-found-actions">
        {isAuthenticated ? (
          <Link to="/dashboard" className="btn btn-primary">Go to your overview</Link>
        ) : (
          <Link to="/" className="btn btn-primary">Go to the home page</Link>
        )}
        <Link to="/opportunities" className="btn btn-secondary">Browse opportunities</Link>
      </div>
    </div>
  )
}

export default NotFound
