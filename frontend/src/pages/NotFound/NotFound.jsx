import { Link } from 'react-router-dom'
import './NotFound.css'

function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-content">
        <span className="not-found-code">404</span>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">Go Home</Link>
          <Link to="/opportunities" className="btn btn-secondary">Browse Opportunities</Link>
        </div>
      </div>
    </main>
  )
}

export default NotFound
