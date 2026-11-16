/**
 * Input for the 6-digit code sent by email. Accepts pasted codes with spaces
 * and lets phones offer the code from the email/SMS keyboard suggestion.
 */
function CodeField({ id = 'code', label = 'Verification code', value, onChange, error, disabled }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input code-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="000000"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        required
      />
      {error ? (
        <span id={`${id}-error`} className="field-error">{error}</span>
      ) : (
        <span id={`${id}-hint`} className="field-hint">The 6-digit code from the email we sent you.</span>
      )}
    </div>
  )
}

export default CodeField
