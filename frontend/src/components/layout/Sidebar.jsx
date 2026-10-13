import { useState } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Sidebar.css'

const VolunteerNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { to: '/opportunities', label: 'Browse', icon: '◎' },
  { to: '/my-signups', label: 'My Registrations', icon: '▦' },
  { to: '/my-hours', label: 'My Hours', icon: '◷' },
  { to: '/notifications', label: 'Notifications', icon: '◎' },
  { to: '/profile', label: 'Profile & Settings', icon: '⊙' },
]

const CoordinatorNav = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { to: '/manage-opportunities', label: 'Opportunities', icon: '◎' },
  { to: '/volunteers', label: 'Volunteers', icon: '◎' },
  { to: '/coordinator-hours', label: 'Hours & Attendance', icon: '◷' },
  { to: '/analytics', label: 'Analytics', icon: '▦' },
  { to: '/reports', label: 'Reports', icon: '▤' },
  { to: '/notifications', label: 'Notifications', icon: '◎' },
  { to: '/organization-profile', label: 'Organization', icon: '⊙' },
]

function NavItem({ to, label, icon, onClick }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
        onClick={onClick}
        end={to === '/dashboard'}
      >
        <span className="sidebar-nav-icon">{icon}</span>
        <span className="sidebar-nav-label">{label}</span>
      </NavLink>
    </li>
  )
}

function Sidebar({ onClose, theme, onToggleTheme }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isCoordinator = user?.role === 'COORDINATOR'
  const navItems = isCoordinator ? CoordinatorNav : VolunteerNav

  const handleLogout = () => {
    if (onClose) onClose()
    logout()
    navigate('/login')
  }

  const userName = user?.full_name || 'User'
  const roleLabel = isCoordinator ? 'Coordinator Platform' : 'Volunteer Platform'
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Link to="/" className="sidebar-logo-link">
          <div className="sidebar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <div>
            <span className="sidebar-app-name">ServeHub</span>
            <span className="sidebar-role-label">{roleLabel}</span>
          </div>
        </Link>
      </div>

      <div className="sidebar-user-card">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-role">{isCoordinator ? 'Coordinator' : 'Volunteer'}</span>
          <span className="sidebar-user-name">{userName}</span>
        </div>
      </div>

      {isCoordinator && (
        <div className="sidebar-cta">
          <Link to="/opportunities/create" className="sidebar-new-opp-btn" onClick={onClose}>
            + New Opportunity
          </Link>
        </div>
      )}

      <nav className="sidebar-nav">
        <span className="sidebar-nav-label-group">NAVIGATION</span>
        <ul>
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} onClick={onClose} />
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-theme-btn"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={handleLogout}
        >
          <span>↩</span>
          <span>Sign Out</span>
        </button>
        <Link to="/" className="sidebar-demo-link">
          <span>⊙</span>
          <span>Demo Mode</span>
        </Link>
      </div>
    </aside>
  )
}

export default Sidebar
