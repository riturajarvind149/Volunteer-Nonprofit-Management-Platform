const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api'

/**
 * Error thrown for any failed request. `status` is the HTTP status (0 for network
 * failures) and `code` is the backend's machine-readable code when it sends one
 * (e.g. EMAIL_NOT_VERIFIED, SESSION_REVOKED, TOKEN_EXPIRED, ORG_NOT_VERIFIED).
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Session codes that mean "this token will never work again — sign the user out".
const DEAD_SESSION_CODES = new Set(['TOKEN_EXPIRED', 'SESSION_REVOKED', 'ACCOUNT_SUSPENDED'])

let sessionExpiredHandler = null

/**
 * AuthContext registers a callback here so that any authenticated request that
 * comes back with a dead session signs the user out, wherever it happened.
 */
export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = handler
}

const handleResponse = async (response, { sentToken }) => {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new ApiError(data.message || 'Request failed with status ' + response.status, {
      status: response.status,
      code: data.code,
    })
    const sessionDead = response.status === 401 || DEAD_SESSION_CODES.has(data.code)
    if (sentToken && sessionDead && sessionExpiredHandler) {
      sessionExpiredHandler(error)
    }
    throw error
  }
  return data
}

const authFetch = async (endpoint, options = {}) => {
  const { method = 'GET', body, token } = options
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = 'Bearer ' + token
  const config = { method, headers }
  if (body !== undefined) config.body = JSON.stringify(body)

  let response
  try {
    response = await fetch(API_BASE_URL + endpoint, config)
  } catch {
    throw new ApiError('Can’t reach the server. Check your internet connection and try again.', { status: 0 })
  }
  return handleResponse(response, { sentToken: Boolean(token) })
}

/**
 * Download a protected file (PDF, CSV…) and hand it to the browser as a download.
 * Errors from the server arrive as JSON and are thrown as ApiError like any other call.
 */
export const downloadFile = async (endpoint, token, fallbackName) => {
  let response
  try {
    response = await fetch(API_BASE_URL + endpoint, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  } catch {
    throw new ApiError('Can’t reach the server. Check your internet connection and try again.', { status: 0 })
  }
  if (!response.ok) return handleResponse(response, { sentToken: Boolean(token) })

  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const filename = match ? match[1] : fallbackName
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { filename }
}

// ---- Auth ----
export const registerApi = (payload) => authFetch('/auth/register', { method: 'POST', body: payload })
export const loginApi = (payload) => authFetch('/auth/login', { method: 'POST', body: payload })
export const getMeApi = (token) => authFetch('/auth/me', { token })
export const verifyEmailApi = (token) => authFetch('/auth/verify-email', { method: 'POST', body: { token } })
export const resendVerificationApi = (email) => authFetch('/auth/resend-verification', { method: 'POST', body: { email } })
export const forgotPasswordApi = (email) => authFetch('/auth/forgot-password', { method: 'POST', body: { email } })
export const resetPasswordApi = (token, password) => authFetch('/auth/reset-password', { method: 'POST', body: { token, password } })

/** Build "?a=1&b=2" from an object, skipping empty values. Arrays become comma lists. */
const toQuery = (params = {}) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    query.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  const qs = query.toString()
  return qs ? '?' + qs : ''
}

// ---- Organizations (list/detail are public; token optional) ----
export const getOrganizationsApi = (token, params = {}) => authFetch('/organizations' + toQuery(params), { token })
export const getMyOrganizationsApi = (token) => authFetch('/organizations/mine', { token })
export const getOrganizationByIdApi = (id, token) => authFetch('/organizations/' + id, { token })
export const getOrganizationOpportunitiesApi = (id, token, params = {}) =>
  authFetch('/organizations/' + id + '/opportunities' + toQuery(params), { token })
export const createOrganizationApi = (payload, token) => authFetch('/organizations', { method: 'POST', body: payload, token })

// ---- Opportunities (search/detail are public; token optional) ----
/**
 * Server-side search. params: q, category, location, from_date, to_date, skills,
 * available, upcoming, sort (date|newest|spots), organization_id, page, limit.
 * Response: { data: { opportunities, pagination: { page, limit, total, total_pages } } }
 */
export const getOpportunitiesApi = (token, params = {}) => authFetch('/opportunities' + toQuery(params), { token })
export const opportunityCalendarUrl = (id) => API_BASE_URL + '/opportunities/' + id + '/calendar.ics'
export const joinWaitlistApi = (opportunityId, token) => authFetch('/opportunities/' + opportunityId + '/waitlist', { method: 'POST', token })
export const leaveWaitlistApi = (opportunityId, token) => authFetch('/opportunities/' + opportunityId + '/waitlist', { method: 'DELETE', token })
export const getMyWaitlistApi = (token) => authFetch('/signups/my/waitlist', { token })

// ---- Volunteer activity ----
export const checkInApi = (opportunityId, code, token) =>
  authFetch('/opportunities/' + opportunityId + '/check-in', { method: 'POST', body: { code }, token })
export const logOwnHoursApi = (signupId, payload, token) =>
  authFetch('/signups/' + signupId + '/hours/self', { method: 'POST', body: payload, token })
export const downloadCertificateApi = (token) => downloadFile('/hours/my/certificate', token, 'volunteer-certificate.pdf')

// ---- Account settings ----
/** Profile with impact stats: { data: { user: { ...profile, stats } } } */
export const getProfileApi = (token) => authFetch('/users/profile', { token })
/** fields: full_name, phone, location, bio, skills (string[]), email_notifications (bool) */
export const updateProfileApi = (fields, token) => authFetch('/users/profile', { method: 'PATCH', body: fields, token })
/** Revokes every other session; responds with a fresh token in data.token. */
export const changePasswordApi = (currentPassword, newPassword, token) =>
  authFetch('/auth/change-password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword }, token })
export const logoutAllApi = (token) => authFetch('/auth/logout-all', { method: 'POST', token })
export const exportMyDataApi = (token) => downloadFile('/users/me/export', token, 'my-servehub-data.json')
export const deleteAccountApi = (password, token) => authFetch('/users/me', { method: 'DELETE', body: { password }, token })

// ---- Admin console (ADMIN role only) ----
export const getAdminStatsApi = (token) => authFetch('/admin/stats', { token })
/** params: status (PENDING|APPROVED|REJECTED|SUSPENDED), q, page, limit */
export const getAdminOrganizationsApi = (token, params = {}) => authFetch('/admin/organizations' + toQuery(params), { token })
/** status: APPROVED | REJECTED | SUSPENDED | PENDING; note required for REJECTED/SUSPENDED */
export const reviewOrganizationApi = (id, status, note, token) =>
  authFetch('/admin/organizations/' + id + '/verification', { method: 'PATCH', body: { status, note }, token })
/** params: q, role, page, limit */
export const getAdminUsersApi = (token, params = {}) => authFetch('/admin/users' + toQuery(params), { token })
export const setUserActiveApi = (id, isActive, token) =>
  authFetch('/admin/users/' + id, { method: 'PATCH', body: { is_active: isActive }, token })
export const getAuditLogsApi = (token, params = {}) => authFetch('/admin/audit-logs' + toQuery(params), { token })

// ---- Coordinator tools ----
/** attendance: 'PRESENT' | 'ABSENT' | null (clear) */
export const setAttendanceApi = (signupId, attendance, token) =>
  authFetch('/signups/' + signupId + '/attendance', { method: 'PATCH', body: { attendance_status: attendance }, token })
export const getParticipationReportApi = (token, params = {}) =>
  authFetch('/reports/volunteer-participation' + toQuery({ from_date: params.from_date, to_date: params.to_date }), { token })
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
