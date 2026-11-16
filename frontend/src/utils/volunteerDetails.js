// Identity details a volunteer must add once (on their profile) before registering,
// so a ServeHub admin can check they are a real person. Mirrors backend/src/utils/volunteerDetails.js.

export const REQUIRED_DETAILS = {
  full_name: 'Full name',
  phone: 'Phone',
  location: 'City',
  date_of_birth: 'Date of birth',
  emergency_contact_name: 'Emergency contact name',
  emergency_contact_phone: 'Emergency contact phone',
}

export const ID_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN card' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENCE', label: 'Driving licence' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'OTHER', label: 'Other' },
]

export const idTypeLabel = (value) => ID_TYPES.find((t) => t.value === value)?.label || value

export const VERIFICATION_LABELS = { UNVERIFIED: 'Not reviewed', VERIFIED: 'Verified', FLAGGED: 'Flagged' }

/** Keys of required details that are still empty. */
export const missingDetails = (user) =>
  Object.keys(REQUIRED_DETAILS).filter((key) => !String(user?.[key] ?? '').trim())

export const PHONE_PATTERN = /^[+()\-\s\d]{6,30}$/
