import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../Icon'
import { Brand, ThemeToggle } from '../ui'

const VOLUNTEER_NAV = [
  { items: [{ to: '/dashboard', label: 'Overview', icon: 'dashboard' }] },
  {
    label: 'Volunteering',
    items: [
      { to: '/opportunities', label: 'Browse opportunities', icon: 'search' },
      { to: '/my-signups', label: 'My registrations', icon: 'registrations' },
      { to: '/my-hours', label: 'My hours', icon: 'clock' },
    ],
  },
  { label: 'Directory', items: [{ to: '/organizations', label: 'Organizations', icon: 'building' }] },
  {
    label: 'Account',
    items: [
      { to: '/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/profile', label: 'Profile', icon: 'user' },
    ],
  },
]

const COORDINATOR_NAV = [
  { items: [{ to: '/dashboard', label: 'Overview', icon: 'dashboard' }] },
  {
    label: 'Operations',
    items: [
      { to: '/manage-opportunities', label: 'Opportunities', icon: 'layers' },
      { to: '/volunteers', label: 'Rosters', icon: 'users' },
      { to: '/coordinator-hours', label: 'Hours & attendance', icon: 'clock' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: 'chart' },
      { to: '/reports', label: 'Reports', icon: 'file-text' },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: '/organization-profile', label: 'My organizations', icon: 'building' },
      { to: '/organizations', label: 'Directory', icon: 'search' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/profile', label: 'Profile', icon: 'user' },
    ],
  },
]

function Sidebar({ onNavigate, theme, onToggleTheme }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isCoordinator = user?.role === 'COORDINATOR'
  const groups = isCoordinator ? COORDINATOR_NAV : VOLUNTEER_NAV

  const handleSignOut = () => {
    onNavigate()
    logout()
    navigate('/login')
  }

  const name = user?.full_name || 'Account'
  const initials = name.split(' ').filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <Brand to="/dashboard" onClick={onNavigate} />
        <span className="sidebar-role">{isCoordinator ? 'Coordinator' : 'Volunteer'}</span>
      </div>

      {isCoordinator && (
        <Link to="/opportunities/create" className="btn btn-primary sidebar-cta" onClick={onNavigate}>
          <Icon name="plus" size={15} />
          New opportunity
        </Link>
      )}

      <nav className="sidebar-nav" aria-label="Main">
        {groups.map((group, index) => (
          <div key={group.label || index} className="sidebar-group">
            {group.label && <p className="sidebar-group-label">{group.label}</p>}
            <ul role="list">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/dashboard'} className="sidebar-link" onClick={onNavigate}>
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link to="/profile" className="sidebar-user" onClick={onNavigate}>
          <span className="sidebar-avatar" aria-hidden="true">{initials}</span>
          <span className="sidebar-user-text">
            <span className="sidebar-user-name">{name}</span>
            <span className="sidebar-user-email">{user?.email}</span>
          </span>
        </Link>
        <div className="sidebar-footer-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} className="sidebar-action" />
          <button type="button" className="sidebar-action" onClick={handleSignOut}>
            <Icon name="log-out" size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
