import './Button.css';

/**
 * Reusable Button Component
 */
function Button({
  children,
  variant = 'primary',
  type = 'button',
  fullWidth = false,
  disabled = false,
  onClick,
  className = '',
  ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    fullWidth ? 'btn-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
