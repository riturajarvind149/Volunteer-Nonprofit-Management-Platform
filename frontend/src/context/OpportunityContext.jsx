import { createContext, useContext, useState, useEffect, useCallback } from 'react'
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

  const fetchOpportunities = useCallback(async () => {
    if (!token) {
      setOpportunities([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getOpportunitiesApi(token)
      setOpportunities(res?.data?.opportunities || [])
    } catch (err) {
      setError(err.message || 'Failed to load opportunities')
      setOpportunities([])
    } finally {
      setLoading(false)
    }
  }, [token])

  const fetchMySignups = useCallback(async () => {
    if (!token || user?.role !== 'VOLUNTEER') return
    try {
      const res = await getMySignupsApi(token)
      const signups = res?.data?.signups || res?.data?.opportunities || []
      const activeIds = signups
        .filter((s) => s.status !== 'CANCELLED')
        .map((s) => s.opportunity_id || s.id)
      setMySignupIds(activeIds)
    } catch {
      // non-fatal
    }
  }, [token, user])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])
  useEffect(() => { if (isAuthenticated) fetchMySignups() }, [isAuthenticated, fetchMySignups])

  const isRegistered = (oppId) => mySignupIds.includes(oppId)

  const signUp = async (oppId) => {
    const res = await signUpForOpportunityApi(oppId, token)
    setMySignupIds((prev) => [...prev, oppId])
    fetchOpportunities()
    return res
  }

  const cancelSignUp = async (oppId) => {
    const res = await cancelSignUpApi(oppId, token)
    setMySignupIds((prev) => prev.filter((id) => id !== oppId))
    fetchOpportunities()
    return res
  }

  const getRegisteredOpportunities = () =>
    opportunities.filter((o) => mySignupIds.includes(o.id))

  const createOpportunity = async (payload) => {
    const res = await createOpportunityApi(payload, token)
    const created = res?.data?.opportunity
    fetchOpportunities()
    return created
  }

  const updateOpportunity = async (id, payload) => {
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
