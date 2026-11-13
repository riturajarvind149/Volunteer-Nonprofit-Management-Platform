import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMeApi, setSessionExpiredHandler } from '../services/api'

const AuthContext = createContext(null)
const TOKEN_STORAGE_KEY = 'servehub_token'

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null
  } catch {
    return null
  }
}

const writeToken = (value) => {
  try {
    if (value) localStorage.setItem(TOKEN_STORAGE_KEY, value)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode): the session lasts for this tab only.
  }
}

const SESSION_MESSAGES = {
  TOKEN_EXPIRED: 'Your session expired. Please sign in again.',
  SESSION_REVOKED: 'You were signed out because your password changed or you signed out on all devices.',
  ACCOUNT_SUSPENDED: 'This account has been suspended. Contact support if you think this is a mistake.',
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(readToken()))
  // One-time message shown on the sign-in page after a forced sign-out.
  const [sessionNotice, setSessionNotice] = useState('')

  const logout = useCallback((notice = '') => {
    writeToken(null)
    setToken(null)
    setUser(null)
    setSessionNotice(typeof notice === 'string' ? notice : '')
  }, [])

  // Any authenticated request that comes back with a dead session signs the user out.
  useEffect(() => {
    setSessionExpiredHandler((error) => {
      logout(SESSION_MESSAGES[error.code] || 'Your session ended. Please sign in again.')
    })
    return () => setSessionExpiredHandler(null)
  }, [logout])

  useEffect(() => {
    let isMounted = true

    if (!token) {
      setLoading(false)
      return
    }

    const initializeAuth = async () => {
      try {
        const response = await getMeApi(token)
        if (isMounted && response?.data?.user) {
          setUser(response.data.user)
        }
      } catch (error) {
        // Network errors keep the token so a flaky connection doesn't sign people out.
        if (isMounted && error.status) {
          writeToken(null)
          setToken(null)
          setUser(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
    }
  }, [token])

  const login = useCallback((newToken, userData) => {
    writeToken(newToken)
    setSessionNotice('')
    setToken(newToken)
    setUser(userData)
  }, [])

  /** Replace the token (e.g. after a password change) without signing out. */
  const replaceToken = useCallback((newToken) => {
    writeToken(newToken)
    setToken(newToken)
  }, [])

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    sessionNotice,
    clearSessionNotice: () => setSessionNotice(''),
    login,
    logout,
    replaceToken,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
