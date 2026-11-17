/**
 * After a new deploy, a tab that was already open still references the previous
 * build's JavaScript files, which no longer exist. Loading one of them fails with
 * a "dynamically imported module" error. A single reload fixes it.
 */
const RELOAD_KEY = 'servehub_reloaded_for_new_version'

const STALE_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
]

export const isStaleBuildError = (error) => STALE_PATTERNS.some((re) => re.test(String(error?.message || error || '')))

/**
 * Reload the page at most once per minute, so a genuinely broken file can't cause a reload loop.
 * @returns {boolean} true when a reload was started
 */
export const reloadOnceForNewVersion = () => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
