import { createContext, useContext, useState, useEffect } from 'react'
import { MOCK_OPPORTUNITIES } from '../pages/Opportunities/mockOpportunities'
import { useAuth } from './AuthContext'

const OpportunityContext = createContext(null)

const OPPORTUNITIES_STORAGE_KEY = 'servehub_opportunities'
const REGISTRATIONS_STORAGE_KEY = 'servehub_user_registrations'

export function OpportunityProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id || user?.email || 'guest'

  // Initialize opportunities list from localStorage or mock data
  const [opportunities, setOpportunities] = useState(() => {
    try {
      const saved = localStorage.getItem(OPPORTUNITIES_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Failed to load opportunities from storage:', e)
    }
    return MOCK_OPPORTUNITIES
  })

  // User registrations mapping: { [userId]: [oppId1, oppId2] }
  const [registrations, setRegistrations] = useState(() => {
    try {
      const saved = localStorage.getItem(REGISTRATIONS_STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load registrations from storage:', e)
    }
    return {}
  })

  // Persist opportunities when updated
  useEffect(() => {
    try {
      localStorage.setItem(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(opportunities))
    } catch (e) {
      console.error('Failed to save opportunities:', e)
    }
  }, [opportunities])

  // Persist registrations when updated
  useEffect(() => {
    try {
      localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(registrations))
    } catch (e) {
      console.error('Failed to save registrations:', e)
    }
  }, [registrations])

  // User's registered opportunity IDs
  const userRegisteredIds = registrations[userId] || []

  const isRegistered = (oppId) => {
    return userRegisteredIds.includes(Number(oppId))
  }

  const signUp = (oppId) => {
    const idNum = Number(oppId)
    if (isRegistered(idNum)) return false

    // Update registration map
    setRegistrations((prev) => {
      const currentList = prev[userId] || []
      return {
        ...prev,
        [userId]: [...currentList, idNum],
      }
    })

    // Decrement available spots if > 0
    setOpportunities((prev) =>
      prev.map((opp) => {
        if (opp.id === idNum && opp.spots > 0) {
          return { ...opp, spots: opp.spots - 1 }
        }
        return opp
      })
    )

    return true
  }

  const cancelSignUp = (oppId) => {
    const idNum = Number(oppId)
    if (!isRegistered(idNum)) return false

    // Update registration map
    setRegistrations((prev) => {
      const currentList = prev[userId] || []
      return {
        ...prev,
        [userId]: currentList.filter((item) => item !== idNum),
      }
    })

    // Increment spots back
    setOpportunities((prev) =>
      prev.map((opp) => {
        if (opp.id === idNum) {
          return { ...opp, spots: opp.spots + 1 }
        }
        return opp
      })
    )

    return true
  }

  const getRegisteredOpportunities = () => {
    return opportunities.filter((opp) => userRegisteredIds.includes(opp.id))
  }

  const createOpportunity = (newOpp) => {
    const created = {
      id: Date.now(),
      spots: Number(newOpp.spots) || 5,
      requirements: Array.isArray(newOpp.requirements)
        ? newOpp.requirements
        : typeof newOpp.requirements === 'string'
        ? newOpp.requirements.split(',').map((r) => r.trim()).filter(Boolean)
        : ['General enthusiasm and willingness to help'],
      ...newOpp,
    }

    setOpportunities((prev) => [created, ...prev])
    return created
  }

  const value = {
    opportunities,
    userRegisteredIds,
    isRegistered,
    signUp,
    cancelSignUp,
    getRegisteredOpportunities,
    createOpportunity,
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
