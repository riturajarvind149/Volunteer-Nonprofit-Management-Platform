import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../Icon'
import './Navbar.css'

function Navbar({ theme, onToggleTheme }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isAuthenticated, logout, user } = useAuth()
  const navigate = useNavigate()

  const toggleMenu = () => setIsMenuOpen((prev) => !prev)
  const closeMenu = () => setIsMenuOpen(false)

  const handleLogout = () => {
    closeMenu()
    logout()
    navigate('/login')
  }

  const getNavLinkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

  const isVolunteer = user?.role === 'VOLUNTEER'
  const isCoordinator = user?.role === 'COORDINATOR'

  return (
    <header className="navbar-sticky">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <div className="brand-emblem">
            <Icon name="heart" size={15} />
          </div>
          <span className="brand-title">ServeHub</span>
        </Link>

        <nav className={`navbar-menu ${isMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-nav">
            <li>
              <NavLink to="/" className={getNavLinkClass} onClick={closeMenu} end>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/organizations" className={getNavLinkClass} onClick={closeMenu}>
                Organizations
              </NavLink>
            </li>
            <li>
              <NavLink to="/opportunities" className={getNavLinkClass} onClick={closeMenu}>
                Opportunities
              </NavLink>
            </li>

            {!isAuthenticated ? (
              <>
                <li>
                  <NavLink to="/login" className={getNavLinkClass} onClick={closeMenu}>
                    Login
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/register" className="nav-link-register" onClick={closeMenu}>
                    Register
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/dashboard" className={getNavLinkClass} onClick={closeMenu}>
                    Dashboard
                  </NavLink>
                </li>
                {isVolunteer && (
                  <>
                    <li>
                      <NavLink to="/my-signups" className={getNavLinkClass} onClick={closeMenu}>
                        My Signups
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/my-hours" className={getNavLinkClass} onClick={closeMenu}>
                        My Hours
                      </NavLink>
                    </li>
                  </>
                )}
                {isCoordinator && (
                  <>
                    <li>
                      <NavLink to="/manage-opportunities" className={getNavLinkClass} onClick={closeMenu}>
                        Manage
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/coordinator-hours" className={getNavLinkClass} onClick={closeMenu}>
                        Hours
                      </NavLink>
                    </li>
                  </>
                )}
                <li>
                  <NavLink to="/profile" className="nav-link-register" onClick={closeMenu}>
                    Profile
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
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={14} />
            <span className="theme-toggle-label">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          <button
            type="button"
            className="navbar-toggle-btn"
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
            onClick={toggleMenu}
          >
            <Icon name={isMenuOpen ? 'close' : 'menu'} size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
