import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Navbar.css'

function Navbar({ theme, onToggleTheme }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          ServeHub
        </Link>

        <nav className={`navbar-menu ${isMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-nav">
            <li>
              <Link to="/" className="nav-link" onClick={closeMenu}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/opportunities" className="nav-link" onClick={closeMenu}>
                Opportunities
              </Link>
            </li>
            <li>
              <Link to="/login" className="nav-link" onClick={closeMenu}>
                Login
              </Link>
            </li>
            <li>
              <Link to="/register" className="nav-link nav-btn-primary" onClick={closeMenu}>
                Register
              </Link>
            </li>
          </ul>
        </nav>

        <div className="navbar-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button
            type="button"
            className="navbar-toggle"
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
            onClick={toggleMenu}
          >
            <span className={`toggle-line ${isMenuOpen ? 'open' : ''}`} />
            <span className={`toggle-line ${isMenuOpen ? 'open' : ''}`} />
            <span className={`toggle-line ${isMenuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar

