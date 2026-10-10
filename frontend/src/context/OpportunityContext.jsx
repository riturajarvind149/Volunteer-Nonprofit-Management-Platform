import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { MOCK_OPPORTUNITIES } from '../pages/Opportunities/mockOpportunities'
import { useAuth } from './AuthContext'
import {
  getOpportunitiesApi,
  signUpForOpportunityApi,
  cancelSignUpApi,
  getMySignupsApi,
  createOpportunityApi,
  updateOpportunityApi,
} from '../services/api'

const OpportunityContext = createContext(null)

export function OpportunityProvider({ children }) {
  const { token, user, isAuthenticated } = useAuth()

  const [opportunities, setOpportunities] = useState([])
  const [mySignupIds, setMySignupIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Track whether we're using real API or mock data
  const [usingMock, setUsingMock] = useState(false)

  // ── Fetch all opportunities ──────────────────────────────────────────────
  const fetchOpportunities = useCallback(async () => {
    if (!token) {
      // Not logged in — use mock so public pages still render
      setOpportunities(MOCK_OPPORTUNITIES)
      setUsingMock(true)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await getOpportunitiesApi(token)
      const data = res?.data?.opportunities || []
      if (data.length > 0) {
        setOpportunities(data)
        setUsingMock(false)
      } else {
        // Empty DB — still show mock data so pages aren't blank
        setOpportunities(MOCK_OPPORTUNITIES)
        setUsingMock(true)
      }
    } catch {
      // API unreachable (backend not deployed yet) — fall back to mock
      setOpportunities(MOCK_OPPORTUNITIES)
      setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }, [token])

  // ── Fetch my signups (volunteer only) ────────────────────────────────────
  const fetchMySignups = useCallback(async () => {
    if (!token || user?.role !== 'VOLUNTEER' || usingMock) return
    try {
      const res = await getMySignupsApi(token)
      const signups = res?.data?.signups || res?.data?.opportunities || []
      const registeredOppIds = signups
        .filter((s) => s.status !== 'CANCELLED')
        .map((s) => s.opportunity_id || s.id)
      setMySignupIds(registeredOppIds)
    } catch {
      // Non-fatal — leave mySignupIds as-is
    }
  }, [token, user, usingMock])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  useEffect(() => {
    if (isAuthenticated) fetchMySignups()
  }, [isAuthenticated, fetchMySignups])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isRegistered = (oppId) => {
    if (usingMock) {
      // Fallback: use localStorage for mock mode
      try {
        const saved = JSON.parse(localStorage.getItem('servehub_user_registrations') || '{}')
        const userId = user?.id || user?.email || 'guest'
        return (saved[userId] || []).includes(Number(oppId))
      } catch {
        return false
      }
    }
    return mySignupIds.includes(oppId)
  }

  const signUp = async (oppId) => {
    if (usingMock) {
      // Mock mode: local state only
      const idNum = Number(oppId)
      const userId = user?.id || user?.email || 'guest'
      try {
        const saved = JSON.parse(localStorage.getItem('servehub_user_registrations') || '{}')
        if ((saved[userId] || []).includes(idNum)) return false
        saved[userId] = [...(saved[userId] || []), idNum]
        localStorage.setItem('servehub_user_registrations', JSON.stringify(saved))
        setOpportunities((prev) =>
          prev.map((o) => (o.id === idNum && o.spots > 0 ? { ...o, spots: o.spots - 1 } : o))
        )
        return true
      } catch {
        return false
      }
    }

    try {
      await signUpForOpportunityApi(oppId, token)
      setMySignupIds((prev) => [...prev, oppId])
      // Refresh to get updated spots_remaining
      fetchOpportunities()
      return true
    } catch (err) {
      throw err
    }
  }

  const cancelSignUp = async (oppId) => {
    if (usingMock) {
      const idNum = Number(oppId)
      const userId = user?.id || user?.email || 'guest'
      try {
        const saved = JSON.parse(localStorage.getItem('servehub_user_registrations') || '{}')
        saved[userId] = (saved[userId] || []).filter((id) => id !== idNum)
        localStorage.setItem('servehub_user_registrations', JSON.stringify(saved))
        setOpportunities((prev) =>
          prev.map((o) => (o.id === idNum ? { ...o, spots: o.spots + 1 } : o))
        )
        return true
      } catch {
        return false
      }
    }

    try {
      await cancelSignUpApi(oppId, token)
      setMySignupIds((prev) => prev.filter((id) => id !== oppId))
      fetchOpportunities()
      return true
    } catch (err) {
      throw err
    }
  }

  const getRegisteredOpportunities = () => {
    if (usingMock) {
      const userId = user?.id || user?.email || 'guest'
      try {
        const saved = JSON.parse(localStorage.getItem('servehub_user_registrations') || '{}')
        const ids = saved[userId] || []
        return opportunities.filter((o) => ids.includes(Number(o.id)))
      } catch {
        return []
      }
    }
    return opportunities.filter((o) => mySignupIds.includes(o.id))
  }

  const createOpportunity = async (payload) => {
    if (usingMock) {
      // Mock mode: local state only
      const created = {
        id: Date.now(),
        spots_remaining: Number(payload.capacity) || 5,
        organization_name: 'My Organization',
        status: 'PUBLISHED',
        ...payload,
      }
      setOpportunities((prev) => [created, ...prev])
      return created
    }

    const res = await createOpportunityApi(payload, token)
    const created = res?.data?.opportunity
    fetchOpportunities()
    return created
  }

  const updateOpportunity = async (id, payload) => {
    if (usingMock) {
      setOpportunities((prev) =>
        prev.map((o) => (String(o.id) === String(id) ? { ...o, ...payload } : o))
      )
      return { id, ...payload }
    }

    const res = await updateOpportunityApi(id, payload, token)
    const updated = res?.data?.opportunity
    fetchOpportunities()
    return updated
  }

  const value = {
    opportunities,
    mySignupIds,
    loading,
    error,
    usingMock,
    isRegistered,
    signUp,
    cancelSignUp,
    getRegisteredOpportunities,
    createOpportunity,
    updateOpportunity,
    refetch: fetchOpportunities,
    refetchMySignups: fetchMySignups,
  }

  return <OpportunityContext.Provider value={value}>{children}</OpportunityContext.Provider>
}

export function useOpportunities() {
  const context = useContext(OpportunityContext)
  if (!context) {
    throw new Error('useOpportunities must be used within an OpportunityProvider')
  }
  return context
}
