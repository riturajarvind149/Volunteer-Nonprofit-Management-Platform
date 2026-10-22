import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../Icon'
import { Brand } from '../ui'
import './PublicLayout.css'

function PublicLayout({ theme, onToggleTheme, children }) {
  const { isAuthenticated } = useAuth()
  const nextTheme = theme === 'light' ? 'dark' : 'light'

  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="public-header">
        <div className="public-header-inner">
          <Brand />
          <nav className="public-nav" aria-label="Account">
            <button
              type="button"
              className="icon-button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
            </button>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Sign in</Link>
                <Link to="/register" className="btn btn-primary">Create account</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="public-main">
        {children ?? <Outlet />}
      </main>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="public-footer-about">
            <Brand />
            <p>Volunteer registration, rosters and hour tracking for nonprofit teams.</p>
          </div>
          <nav className="public-footer-links" aria-label="Footer">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create account</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
        <p className="public-footer-copy">&copy; {new Date().getFullYear()} ServeHub</p>
      </footer>
    </div>
  )
}

export default PublicLayout
