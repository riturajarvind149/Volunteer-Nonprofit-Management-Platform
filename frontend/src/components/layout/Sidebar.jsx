import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../Icon'
import './Sidebar.css'

const VolunteerNav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/opportunities', label: 'Browse', icon: 'browse' },
  { to: '/my-signups', label: 'My Registrations', icon: 'registrations' },
  { to: '/my-hours', label: 'My Hours', icon: 'hours' },
  { to: '/notifications', label: 'Notifications', icon: 'notifications' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
]

const CoordinatorNav = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/manage-opportunities', label: 'Opportunities', icon: 'manage' },
  { to: '/volunteers', label: 'Volunteers', icon: 'volunteers' },
  { to: '/coordinator-hours', label: 'Hours & Attendance', icon: 'hours' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/notifications', label: 'Notifications', icon: 'notifications' },
  { to: '/organization-profile', label: 'Organization', icon: 'organization' },
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
        <Icon name={icon} size={15} className="sidebar-nav-icon" />
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
  const roleLabel = isCoordinator ? 'Coordinator' : 'Volunteer'
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Link to="/" className="sidebar-logo-link">
          <div className="sidebar-logo-icon">
            <Icon name="heart" size={14} />
          </div>
          <div>
            <span className="sidebar-app-name">ServeHub</span>
            <span className="sidebar-role-label">{roleLabel} Platform</span>
          </div>
        </Link>
      </div>

      <div className="sidebar-user-card">
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-role">{roleLabel}</span>
          <span className="sidebar-user-name">{userName}</span>
        </div>
      </div>

      {isCoordinator && (
        <div className="sidebar-cta">
          <Link to="/opportunities/create" className="sidebar-new-opp-btn" onClick={onClose}>
            <Icon name="plus" size={13} />
            New Opportunity
          </Link>
        </div>
      )}

      <nav className="sidebar-nav">
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
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={14} />
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={handleLogout}
        >
          <Icon name="log-out" size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
