import React from 'react';
import './Navbar.css';

/**
 * Navbar Component
 * Simple top navigation header for ServeHub platform.
 */
function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand / Logo */}
        <div className="navbar-brand">
          <span className="navbar-logo-icon">🤝</span>
          <span className="navbar-brand-name">ServeHub</span>
        </div>

        {/* Navigation Links */}
        <nav className="navbar-nav">
          <a href="#" className="nav-link active">
            Home
          </a>
          <a href="#opportunities" className="nav-link">
            Opportunities
          </a>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
