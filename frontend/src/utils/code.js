/** True when the value is a complete 6-digit email code. */
export const isCompleteCode = (code) => /^\d{6}$/.test(code)
