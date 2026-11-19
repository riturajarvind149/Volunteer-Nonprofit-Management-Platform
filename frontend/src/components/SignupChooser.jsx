import { Link } from 'react-router-dom'
import Icon from './Icon'

const OPTIONS = [
  {
    key: 'volunteer',
    to: '/register',
    icon: 'user',
    title: 'I want to volunteer',
    desc: 'Find opportunities and track your hours',
  },
  {
    key: 'ngo',
    to: '/register/ngo',
    icon: 'building',
    title: 'I represent an NGO',
    desc: 'Register your NGO and invite coordinators',
  },
]

/**
 * The two ways to join ServeHub, shown at the top of both sign-up pages so the
 * NGO path is as visible as the volunteer one. `active` is 'volunteer' or 'ngo'.
 */
function SignupChooser({ active }) {
  return (
    <nav className="signup-chooser" aria-label="Choose an account type">
      {OPTIONS.map((o) => (
        <Link
          key={o.key}
          to={o.to}
          className={`signup-choice${active === o.key ? ' is-active' : ''}`}
          aria-current={active === o.key ? 'page' : undefined}
        >
          <Icon name={o.icon} size={20} className="signup-choice-icon" />
          <span className="signup-choice-text">
            <span className="signup-choice-title">{o.title}</span>
            <span className="signup-choice-desc">{o.desc}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}

export default SignupChooser
