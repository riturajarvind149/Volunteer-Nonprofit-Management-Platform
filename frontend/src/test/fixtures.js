// Shared test data. Same localStorage key AuthContext uses for the JWT.
export const TOKEN_KEY = 'servehub_token'

export const VOLUNTEER = { id: 'vol-1', full_name: 'Asha Volunteer', email: 'asha@example.org', role: 'VOLUNTEER', created_at: '2026-01-10' }
// A volunteer who has already given the identity details required before registering.
export const VOLUNTEER_DETAILS = {
  phone: '+91 98765 43210',
  location: 'Pune',
  date_of_birth: '1998-04-12',
  emergency_contact_name: 'Ravi Kumar',
  emergency_contact_phone: '+91 91234 56789',
  id_type: null,
  id_last4: null,
  verification_status: 'UNVERIFIED',
}
export const COMPLETE_VOLUNTEER = { ...VOLUNTEER, ...VOLUNTEER_DETAILS }
export const ADMIN = { id: 'admin-1', full_name: 'Priya Admin', email: 'priya@example.org', role: 'ADMIN', created_at: '2026-01-10' }
export const COORDINATOR ={ id: 'coord-1', full_name: 'Ravi Coordinator', email: 'ravi@example.org', role: 'COORDINATOR', created_at: '2026-01-10' }
