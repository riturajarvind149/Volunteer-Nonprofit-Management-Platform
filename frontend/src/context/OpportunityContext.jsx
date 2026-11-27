import { createContext, useContext } from 'react'

/** Opportunities and the volunteer's signup states; provided by OpportunityProvider. */
export const OpportunityContext = createContext(null)

export function useOpportunities() {
  const context = useContext(OpportunityContext)
  if (!context) {
    throw new Error('useOpportunities must be used within an OpportunityProvider')
  }
  return context
}
