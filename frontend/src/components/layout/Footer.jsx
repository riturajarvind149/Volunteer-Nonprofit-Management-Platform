import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <h3>ServeHub</h3>
          <p>
            A volunteer and nonprofit management platform. Connect with organizations,
            discover opportunities, and track your contribution hours.
          </p>
        </div>

        <div className="footer-nav-groups">
          <div className="footer-nav-group">
            <h4>Platform</h4>
            <nav aria-label="Platform links">
              <Link to="/opportunities">Browse Opportunities</Link>
              <Link to="/organizations">Organizations</Link>
              <Link to="/register">Create Account</Link>
              <Link to="/login">Sign In</Link>
            </nav>
          </div>

          <div className="footer-nav-group">
            <h4>Legal</h4>
            <nav aria-label="Legal links">
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Use</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {year} ServeHub. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer
