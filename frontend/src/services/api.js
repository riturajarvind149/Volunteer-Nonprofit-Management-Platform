const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

/**
 * Helper to handle response parsing and standardized errors
 */
const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }
  return data;
};

const postJson = async (endpoint, payload) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

/**
 * Register a new user (VOLUNTEER or COORDINATOR)
 */
export const registerApi = (payload) => postJson('/auth/register', payload);

/**
 * Login user and receive JWT + profile
 */
export const loginApi = (payload) => postJson('/auth/login', payload);

/**
 * Retrieve authenticated user profile using JWT Bearer token
 */
export const getMeApi = async (token) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(response);
};
