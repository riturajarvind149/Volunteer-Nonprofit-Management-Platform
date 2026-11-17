import { Component } from 'react'
import { isStaleBuildError, reloadOnceForNewVersion } from '../utils/staleBuild'

/**
 * Catches render errors so a crash shows a recovery screen instead of a blank page.
 * `resetKey` (e.g. the current path) clears the error when the user navigates away.
 */
class ErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey }
    return null
  }

  componentDidCatch(error, info) {
    // A new version was deployed while this tab was open: its old files are gone.
    if (isStaleBuildError(error) && reloadOnceForNewVersion()) return
    console.error('Unexpected error while rendering the page', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const stale = isStaleBuildError(error)
    return (
      <div className="state" role="alert">
        <h2>{stale ? 'ServeHub was just updated' : 'Something went wrong on this page'}</h2>
        <p>
          {stale
            ? 'Reload to get the latest version.'
            : 'Try reloading. If it keeps happening, go back to the home page and try again.'}
        </p>
        <div className="state-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="btn btn-secondary" href="/">
            Go to home page
          </a>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
