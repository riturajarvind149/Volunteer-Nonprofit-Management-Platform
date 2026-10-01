import { createContext, useContext, useState, useEffect } from 'react'
import { getMeApi } from '../services/api'

const AuthContext = createContext(null)
const TOKEN_STORAGE_KEY = 'servehub_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        if (isMounted) {
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

  const login = (newToken, userData) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken)
    setToken(newToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
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

