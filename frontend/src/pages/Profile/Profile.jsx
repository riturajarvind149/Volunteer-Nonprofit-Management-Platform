import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getProfileApi } from '../../services/api'
import Icon from '../../components/Icon'
import { Alert, LoadingState } from '../../components/ui'
import { formatDate, formatHours } from '../../utils/format'
import { ProfileDetailsForm, NotificationPreference } from './ProfileDetailsForm'
import SecuritySettings from './SecuritySettings'
import PrivacySettings from './PrivacySettings'
import './Profile.css'

const ROLE_LABELS = { ADMIN: 'Administrator', COORDINATOR: 'Coordinator' }

function ImpactStats({ role, stats }) {
  if (!stats || role === 'ADMIN') return null
  const items = role === 'COORDINATOR'
    ? [
        { label: 'Opportunities created', value: stats.total_opportunities },
        { label: 'Volunteers engaged', value: stats.total_volunteers },
        { label: 'Hours logged', value: formatHours(stats.total_hours) },
      ]
    : [
        { label: 'Hours volunteered', value: formatHours(stats.total_hours) },
        { label: 'Events completed', value: stats.completed_events },
        { label: 'Organizations supported', value: stats.organizations_supported },
      ]
  return (
    <section className="figures" aria-label="Your impact">
      {items.map((item) => (
        <div key={item.label} className="figure">
          <span className="figure-value">{item.value ?? 0}</span>
          <span className="figure-label">{item.label}</span>
        </div>
      ))}
    </section>
  )
}

function Section({ id, title, description, children }) {
  return (
    <section className="panel settings-section" aria-labelledby={id}>
      <div className="panel-header">
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p className="muted settings-section-desc">{description}</p>}
        </div>
      </div>
      <div className="settings-body">{children}</div>
    </section>
  )
}

function Profile() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getProfileApi(token)
      setProfile(res?.data?.user || null)
    } catch (err) {
      setError(err.message || 'Your profile could not be loaded.')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // The route guard normally waits for the session, but don't assume it: the user is null
  // while the session is being checked and for a moment after signing out.
  if (!user) return <LoadingState label="Loading your profile…" />

  const roleLabel = ROLE_LABELS[user.role] || 'Volunteer'
  const name = profile?.full_name || user.full_name || '?'
  const initials = name.split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

  const handleSaved = (updated) => setProfile((prev) => ({ ...prev, ...updated }))

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="page page-narrow">
      <header className="profile-header">
        <span className="profile-avatar" aria-hidden="true">{initials}</span>
        <div>
          <h1>{name}</h1>
          <p className="muted">
            {roleLabel} account · {user.email} · member since {formatDate(user.created_at, { month: 'long' })}
          </p>
        </div>
      </header>

      {error && <Alert onRetry={load}>{error}</Alert>}

      {!profile && !error ? (
        <LoadingState label="Loading your profile…" />
      ) : profile && (
        <>
          <ImpactStats role={user.role} stats={profile.stats} />

          {user.role === 'COORDINATOR' && (
            <Link to="/organization-profile" className="panel profile-link">
              <Icon name="building" size={18} />
              <span>
                <strong>My organizations</strong>
                <span className="muted">Organizations you manage and their opportunities</span>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
          )}

          <Section id="profile-title" title="Profile" description="How you appear to coordinators when you register.">
            <ProfileDetailsForm profile={profile} onSaved={handleSaved} />
          </Section>

          <Section id="notifications-title" title="Notifications">
            <NotificationPreference profile={profile} onSaved={handleSaved} />
          </Section>

          <Section id="security-title" title="Security">
            <SecuritySettings />
          </Section>

          <Section id="privacy-title" title="Your data">
            <PrivacySettings />
          </Section>
        </>
      )}

      <div className="profile-signout">
        <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
          <Icon name="log-out" size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}

export default Profile
