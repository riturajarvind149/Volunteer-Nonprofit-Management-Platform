import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import './AppLayout.css'

function AppLayout({ children, theme, onToggleTheme }) {
  const { isAuthenticated, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading || !isAuthenticated) return children

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`sidebar-wrapper${sidebarOpen ? ' sidebar-open' : ''}`}>
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </div>
      <div className="app-layout-main">
        <div className="app-topbar">
          <button
            type="button"
            className="topbar-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div className="app-layout-content">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AppLayout
