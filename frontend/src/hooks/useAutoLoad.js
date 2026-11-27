import { useEffect } from 'react'

/**
 * Run a page's `load` function on mount and whenever it changes (that is, whenever the
 * inputs of its useCallback change) — the job `useEffect(() => { load() }, [load])` did.
 *
 * `load` starts from a microtask instead of the effect body, so its "loading…" state
 * updates don't render inside the effect. A run that is superseded before it starts
 * (inputs changed again, the page unmounted, or StrictMode's double effect in
 * development) is skipped, so it never sends a stale request.
 *
 * @param {() => unknown} load - stable callback (wrap it in useCallback)
 */
export function useAutoLoad(load) {
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) load()
    })
    return () => {
      active = false
    }
  }, [load])
}
