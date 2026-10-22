import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import { PageHeader } from '../../components/ui'
import './Notifications.css'

const PLACES = {
  VOLUNTEER: [
    { to: '/my-signups', icon: 'registrations', title: 'My registrations', body: 'Shows if a coordinator cancels one of your registrations.' },
    { to: '/my-hours', icon: 'clock', title: 'My hours', body: 'Shows new hour entries and when they are verified.' },
  ],
  COORDINATOR: [
    { to: '/volunteers', icon: 'users', title: 'Rosters', body: 'Shows new and cancelled registrations for each event.' },
    { to: '/coordinator-hours', icon: 'clock', title: 'Hours & attendance', body: 'Shows hour entries that still need verification.' },
  ],
}

function Notifications() {
  const { user } = useAuth()
  const places = PLACES[user.role] || PLACES.VOLUNTEER

  return (
    <div className="page page-narrow">
      <PageHeader title="Notifications" />

      <section className="panel notif-unavailable">
        <Icon name="bell" size={24} className="state-icon" />
        <div>
          <h2>In-app notifications aren’t available yet</h2>
          <p>
            ServeHub doesn’t generate notifications at the moment, so nothing will appear here.
            Until it does, these pages always reflect the latest changes:
          </p>
        </div>
      </section>

      <ul role="list" className="notif-places">
        {places.map((place) => (
          <li key={place.to}>
            <Link to={place.to} className="notif-place">
              <Icon name={place.icon} size={18} />
              <span>
                <strong>{place.title}</strong>
                <span className="muted">{place.body}</span>
              </span>
              <Icon name="chevron-right" size={16} className="notif-chevron" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Notifications
