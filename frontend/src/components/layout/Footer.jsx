import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <h3>ServeHub</h3>
          <p>Connecting volunteers with impactful nonprofit opportunities.</p>
        </div>
        <div className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/opportunities">Opportunities</Link>
          <Link to="/organizations">Organizations</Link>
          <a href="/#about">About Us</a>
          <Link to="/my-signups">My Signups</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} ServeHub. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer

