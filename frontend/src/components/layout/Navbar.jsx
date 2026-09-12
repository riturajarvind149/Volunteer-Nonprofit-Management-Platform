import { useState } from 'react';
import './Navbar.css';

/**
 * Navbar Component
 * Reusable navigation header for the application layout.
 */
function Navbar({ currentPage = 'login', onNavigate }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleNavClick = (e, page) => {
    e.preventDefault();
    setIsMenuOpen(false);
    if (onNavigate) {
      onNavigate(page);
    }
  };

  return (
    <header className="navbar">
      <div className="container navbar-container">
        <a
          href="/"
          className="navbar-brand"
          onClick={(e) => handleNavClick(e, 'login')}
        >
          Volunteer & Nonprofit Platform
        </a>

        <button
          type="button"
          className="navbar-toggle"
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          ☰
        </button>

        <nav className={`navbar-menu ${isMenuOpen ? 'is-open' : ''}`}>
          <a
            href="#login"
            className={`navbar-link ${currentPage === 'login' ? 'active' : ''}`}
            onClick={(e) => handleNavClick(e, 'login')}
          >
            Login
          </a>
          <a
            href="#signup"
            className={`navbar-link ${currentPage === 'signup' ? 'active' : ''}`}
            onClick={(e) => handleNavClick(e, 'signup')}
          >
            Sign Up
          </a>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
