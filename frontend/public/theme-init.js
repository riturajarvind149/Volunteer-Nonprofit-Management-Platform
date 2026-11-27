// Applied before React mounts so the stored theme is used on first paint.
// Kept as a file (not inline in index.html) so the Content-Security-Policy can
// allow scripts from this site only, without 'unsafe-inline'.
try {
  var stored = localStorage.getItem('servehub_theme')
  var theme = stored === 'dark' || stored === 'light'
    ? stored
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
} catch {
  document.documentElement.setAttribute('data-theme', 'light')
}
