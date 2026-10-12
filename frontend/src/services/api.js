const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api'

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || 'Request failed with status ' + response.status)
  }
  return data
}

const authFetch = async (endpoint, options = {}) => {
  const { method = 'GET', body, token } = options
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const config = { method, headers }
  if (body) config.body = JSON.stringify(body)
  const response = await fetch(API_BASE_URL + endpoint, config)
  return handleResponse(response)
}

export const registerApi = (payload) => authFetch('/auth/register', { method: 'POST', body: payload })
export const loginApi = (payload) => authFetch('/auth/login', { method: 'POST', body: payload })
export const getMeApi = (token) => authFetch('/auth/me', { token })
export const testCoordinatorApi = (token) => authFetch('/auth/coordinator-test', { token })
export const testVolunteerApi = (token) => authFetch('/auth/volunteer-test', { token })

export const getOrganizationsApi = (token) => authFetch('/organizations', { token })
export const getOrganizationByIdApi = (id, token) => authFetch('/organizations/' + id, { token })
export const createOrganizationApi = (payload, token) => authFetch('/organizations', { method: 'POST', body: payload, token })

export const getOpportunitiesApi = (token) => authFetch('/opportunities', { token })
export const getManagedOpportunitiesApi = (token) => authFetch('/opportunities?managed=true', { token })
export const getOpportunityByIdApi = (id, token) => authFetch('/opportunities/' + id, { token })
export const createOpportunityApi = (payload, token) => authFetch('/opportunities', { method: 'POST', body: payload, token })
export const updateOpportunityApi = (id, payload, token) => authFetch('/opportunities/' + id, { method: 'PATCH', body: payload, token })
export const getDashboardStatsApi = (token) => authFetch('/opportunities/dashboard-stats', { token })

export const signUpForOpportunityApi = (opportunityId, token) => authFetch('/opportunities/' + opportunityId + '/signup', { method: 'POST', token })
export const cancelSignUpApi = (opportunityId, token) => authFetch('/opportunities/' + opportunityId + '/signup', { method: 'DELETE', token })
export const getMySignupsApi = (token) => authFetch('/signups/my', { token })
export const getSignupByIdApi = (id, token) => authFetch('/signups/' + id, { token })
export const cancelSignupByIdApi = (id, token) => authFetch('/signups/' + id + '/cancel', { method: 'PATCH', token })
export const updateSignupStatusApi = (id, status, token) => authFetch('/signups/' + id + '/status', { method: 'PATCH', body: { status }, token })
export const getOpportunityAttendeesApi = (opportunityId, token) => authFetch('/opportunities/' + opportunityId + '/signups', { token })

export const recordHoursApi = (signupId, payload, token) => authFetch('/signups/' + signupId + '/hours', { method: 'POST', body: payload, token })
export const getMyHoursApi = (token, params = {}) => {
  const query = new URLSearchParams()
  if (params.from_date) query.set('from_date', params.from_date)
  if (params.to_date) query.set('to_date', params.to_date)
  const qs = query.toString()
  return authFetch('/hours/my' + (qs ? '?' + qs : ''), { token })
}
export const getMyHoursSummaryApi = (token) => authFetch('/hours/my/summary', { token })
export const getOrganizationHoursApi = (token) => authFetch('/hours/organization', { token })
export const getOrganizationHoursSummaryApi = (token) => authFetch('/hours/organization/summary', { token })
export const getOrganizationOpportunitiesSummaryApi = (token, params = {}) => {
  const query = new URLSearchParams()
  if (params.from_date) query.set('from_date', params.from_date)
  if (params.to_date) query.set('to_date', params.to_date)
  const qs = query.toString()
  return authFetch('/hours/organization/opportunities' + (qs ? '?' + qs : ''), { token })
}
export const updateHoursStatusApi = (id, status, token) => authFetch('/hours/' + id + '/status', { method: 'PATCH', body: { status }, token })
