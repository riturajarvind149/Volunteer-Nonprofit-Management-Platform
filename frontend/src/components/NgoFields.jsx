import { REGISTRATION_TYPES } from '../utils/ngo'

/**
 * The "About your NGO" part of NGO registration, shared by public sign-up and
 * signed-in registration. Controlled: `values` + `errors`, `onChange(field, value)`.
 */
function NgoFields({ values, errors, onChange, disabled }) {
  const describedBy = (id, hint) => (errors[id] ? `ngo-${id}-error` : hint ? `ngo-${id}-hint` : undefined)
  const message = (id, hint) =>
    errors[id] ? (
      <span id={`ngo-${id}-error`} className="field-error">{errors[id]}</span>
    ) : (
      hint && <span id={`ngo-${id}-hint`} className="field-hint">{hint}</span>
    )
  const input = (id, label, { required = false, hint, type = 'text', autoComplete } = {}) => (
    <div className="field">
      <label className="field-label" htmlFor={`ngo-${id}`}>
        {label}
        {required ? <span className="req" aria-hidden="true">*</span> : <span className="opt">(optional)</span>}
      </label>
      <input
        id={`ngo-${id}`}
        type={type}
        className="input"
        value={values[id]}
        onChange={(e) => onChange(id, e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={describedBy(id, hint)}
        required={required}
      />
      {message(id, hint)}
    </div>
  )

  return (
    <>
      {input('name', 'NGO name', { required: true, autoComplete: 'organization' })}

      <div className="field">
        <label className="field-label" htmlFor="ngo-registration_type">
          Type of NGO<span className="req" aria-hidden="true">*</span>
        </label>
        <select
          id="ngo-registration_type"
          className="input"
          value={values.registration_type}
          onChange={(e) => onChange('registration_type', e.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(errors.registration_type)}
          aria-describedby={describedBy('registration_type')}
          required
        >
          <option value="">Choose…</option>
          {REGISTRATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {message('registration_type')}
      </div>

      {input('registration_number', 'Registration number or NGO Darpan ID', {
        hint: 'Helps the ServeHub team verify your NGO faster.',
      })}
      {input('city', 'City', { required: true, autoComplete: 'address-level2' })}
      {input('website', 'Website', { type: 'url', hint: 'e.g. https://yourngo.org', autoComplete: 'url' })}

      <div className="field">
        <label className="field-label" htmlFor="ngo-description">
          What does your NGO do?<span className="opt">(optional)</span>
        </label>
        <textarea
          id="ngo-description"
          className="input textarea"
          rows={3}
          value={values.description}
          onChange={(e) => onChange('description', e.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy('description', 'Shown on your public NGO page.')}
        />
        {message('description', 'Shown on your public NGO page.')}
      </div>
    </>
  )
}

export default NgoFields
