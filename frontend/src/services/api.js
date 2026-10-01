const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`)
  }
  return data
}

const authFetch = async (endpoint, { method = 'GET', body, token } = {}) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const config = { method, headers }
  if (body) {
    config.body = JSON.stringify(body)
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
  return handleResponse(response)
}

export const registerApi = (payload) => authFetch('/auth/register', { method: 'POST', body: payload })
export const loginApi = (payload) => authFetch('/auth/login', { method: 'POST', body: payload })
export const getMeApi = (token) => authFetch('/auth/me', { token })
export const testCoordinatorApi = (token) => authFetch('/auth/coordinator-test', { token })
export const testVolunteerApi = (token) => authFetch('/auth/volunteer-test', { token })

export const getOrganizationsApi = (token) => authFetch('/organizations', { token })
export const getOrganizationByIdApi = (id, token) => authFetch(`/organizations/${id}`, { token })
export const createOrganizationApi = (payload, token) => authFetch('/organizations', { method: 'POST', body: payload, token })

export const getHealthApi = () => authFetch('/health')

