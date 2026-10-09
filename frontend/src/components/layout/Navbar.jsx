import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Navbar.css'

function Navbar({ theme, onToggleTheme }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const handleLogout = () => {
    closeMenu()
    logout()
    navigate('/login')
  }

  const getNavLinkClass = ({ isActive }) =>
    isActive ? 'nav-link active' : 'nav-link'

  return (
    <header className="navbar-sticky">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <div className="brand-emblem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <span className="brand-title">ServeHub</span>
        </Link>

        <nav className={`navbar-menu ${isMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-nav">
            <li>
              <NavLink to="/" className={getNavLinkClass} onClick={closeMenu} end>
                <span>Home</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/organizations" className={getNavLinkClass} onClick={closeMenu}>
                <span>Organizations</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/opportunities" className={getNavLinkClass} onClick={closeMenu}>
                <span>Opportunities</span>
              </NavLink>
            </li>

            {!isAuthenticated ? (
              <>
                <li>
                  <NavLink to="/login" className={getNavLinkClass} onClick={closeMenu}>
                    <span>Login</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/register" className="nav-link-register" onClick={closeMenu}>
                    <span>Register</span>
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/dashboard" className={getNavLinkClass} onClick={closeMenu}>
                    <span>Dashboard</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/profile" className="nav-link-register" onClick={closeMenu}>
                    <span>Profile</span>
                  </NavLink>
                </li>
                <li>
                  <button type="button" className="nav-btn-logout" onClick={handleLogout}>
                    Logout
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>

        <div className="navbar-actions">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className={`theme-icon ${theme === 'dark' ? 'dark-active' : ''}`}>
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
          </button>

          <button
            type="button"
            className="navbar-toggle-btn"
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
            onClick={toggleMenu}
          >
            <span className={`toggle-bar ${isMenuOpen ? 'open' : ''}`} />
            <span className={`toggle-bar ${isMenuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar

