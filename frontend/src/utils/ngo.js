/** Legal forms an NGO can register as (values match the API). */
export const REGISTRATION_TYPES = [
  { value: 'TRUST', label: 'Trust' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'SECTION_8', label: 'Section 8 company' },
  { value: 'OTHER', label: 'Other' },
]

export const registrationTypeLabel = (value) => REGISTRATION_TYPES.find((t) => t.value === value)?.label || null

/** How a member's role in an NGO is shown. */
export const memberRoleLabel = (role) => (role === 'OWNER' ? 'NGO admin' : role === 'COORDINATOR' ? 'Coordinator' : null)

export const EMPTY_NGO = { name: '', description: '', registration_type: '', registration_number: '', city: '', website: '' }

/** Client-side checks matching the API's rules. Returns { field: message }. */
export function validateNgo(values) {
  const errors = {}
  if (values.name.trim().length < 2) errors.name = 'Enter your NGO’s name.'
  if (!values.registration_type) errors.registration_type = 'Choose the type of NGO.'
  const number = values.registration_number.trim()
  if (number && !/^[A-Za-z0-9][A-Za-z0-9 /.-]{1,59}$/.test(number)) {
    errors.registration_number = 'Use letters, numbers, spaces and / . - only.'
  }
  if (values.city.trim().length < 2) errors.city = 'Enter the city your NGO works in.'
  const website = values.website.trim()
  if (website && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(website)) errors.website = 'Enter a full address starting with https://'
  if (values.description.length > 2000) errors.description = 'Keep it under 2000 characters.'
  return errors
}

/** NGO details as the API expects them (blank optional fields omitted). */
export const ngoPayload = (values) => ({
  name: values.name.trim(),
  description: values.description.trim() || undefined,
  registration_type: values.registration_type,
  registration_number: values.registration_number.trim() || undefined,
  city: values.city.trim(),
  website: values.website.trim() || undefined,
})
