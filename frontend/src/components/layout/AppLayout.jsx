import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from '../ErrorBoundary'
import Icon from '../Icon'
import { Brand } from '../ui'
import Sidebar from './Sidebar'
import { useNotifications } from '../../context/NotificationContext'
import './AppLayout.css'

function AppLayout({ theme, onToggleTheme, children }) {
  const { pathname } = useLocation()
  const { unreadCount } = useNotifications()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="app-topbar">
        <button
          type="button"
          className="app-menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label={unreadCount > 0 ? `Open navigation (${unreadCount} unread notification${unreadCount === 1 ? '' : 's'})` : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <Icon name="menu" size={20} />
          {unreadCount > 0 && <span className="app-menu-dot" aria-hidden="true" />}
        </button>
        <Brand to="/dashboard" />
      </header>

      {menuOpen && <div className="app-scrim" onClick={closeMenu} aria-hidden="true" />}

      <aside id="app-sidebar" className={`app-sidebar${menuOpen ? ' is-open' : ''}`}>
        {menuOpen && (
          <button type="button" className="app-menu-close" onClick={closeMenu} aria-label="Close navigation" autoFocus>
            <Icon name="x" size={18} />
          </button>
        )}
        <Sidebar onNavigate={closeMenu} theme={theme} onToggleTheme={onToggleTheme} />
      </aside>

      <main id="main" className="app-main">
        <ErrorBoundary resetKey={pathname}>{children ?? <Outlet />}</ErrorBoundary>
      </main>
    </div>
  )
}

export default AppLayout
