import { useState } from 'react'
import './Navbar.css'

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev)
  }

  return (
    <header className="navbar">
      <div className="navbar-container">
        <a href="#" className="navbar-brand">
          ServeHub
        </a>

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

        <nav className={`navbar-menu ${isMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-nav">
            <li>
              <a href="#" className="nav-link">
                Home
              </a>
            </li>
            <li>
              <a href="#" className="nav-link">
                Opportunities
              </a>
            </li>
            <li>
              <a href="#" className="nav-link">
                Login
              </a>
            </li>
            <li>
              <a href="#" className="nav-link nav-btn-primary">
                Register
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
