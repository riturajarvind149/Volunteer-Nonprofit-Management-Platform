import './Input.css';

/**
 * Reusable Form Input Component
 */
function Input({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  required = false,
  disabled = false,
  error = '',
  className = '',
  ...rest
}) {
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`form-input ${className}`.trim()}
        {...rest}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export default Input;
