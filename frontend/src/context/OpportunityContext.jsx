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
  const [signupStatuses, setSignupStatuses] = useState({})
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState(null)

  const fetchOpportunities = useCallback(async () => {
    if (!token) {
      setOpportunities([])
      setLoading(false)
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
    if (!token || user?.role !== 'VOLUNTEER') {
      setSignupStatuses({})
      return
    }
    try {
      const res = await getMySignupsApi(token)
      const signups = res?.data?.signups || []
      setSignupStatuses(Object.fromEntries(signups.map((s) => [s.opportunity_id, s.status])))
    } catch {
      // non-fatal
    }
  }, [token, user])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])
  useEffect(() => { if (isAuthenticated) fetchMySignups() }, [isAuthenticated, fetchMySignups])

  const signupStatus = (oppId) => signupStatuses[oppId]
  const isRegistered = (oppId) => Boolean(signupStatuses[oppId]) && signupStatuses[oppId] !== 'CANCELLED'

  const signUp = async (oppId) => {
    const res = await signUpForOpportunityApi(oppId, token)
    setSignupStatuses((prev) => ({ ...prev, [oppId]: 'REGISTERED' }))
    fetchOpportunities()
    return res
  }

  const cancelSignUp = async (oppId) => {
    const res = await cancelSignUpApi(oppId, token)
    setSignupStatuses((prev) => ({ ...prev, [oppId]: 'CANCELLED' }))
    fetchOpportunities()
    return res
  }

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
    loading,
    error,
    isRegistered,
    signupStatus,
    signUp,
    cancelSignUp,
    createOpportunity,
    updateOpportunity,
    refetch: fetchOpportunities,
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
