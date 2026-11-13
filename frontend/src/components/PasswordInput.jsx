import { useState } from 'react'
import Icon from './Icon'

/**
 * Password input with a show/hide toggle, matching the sign-in form.
 * Extra props (value, onChange, autoComplete, aria-*) go to the <input>.
 */
function PasswordInput({ id, ...inputProps }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="password-field">
      <input id={id} type={visible ? 'text' : 'password'} className="input" {...inputProps} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={17} />
      </button>
    </div>
  )
}

export default PasswordInput
