// Mirrors the backend rule in authService.validatePasswordStrength.
export const PASSWORD_HINT = 'At least 8 characters, including a letter and a number.'

/** @returns {string} an error message, or '' when the password is acceptable */
export function passwordError(password) {
  if (!password) return 'Enter a password.'
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 72) return 'Use at most 72 characters.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.'
  return ''
}
