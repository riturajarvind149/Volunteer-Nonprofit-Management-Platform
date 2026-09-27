const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`)
  }
  return data
}

const postJson = async (endpoint, payload) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export const registerApi = (payload) => postJson('/auth/register', payload)
export const loginApi = (payload) => postJson('/auth/login', payload)

export const getMeApi = async (token) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  return handleResponse(response)
}
