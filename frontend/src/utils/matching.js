const norm = (s) => String(s || '').trim().toLowerCase()

/** The opportunity's helpful skills that the volunteer listed on their profile (case-insensitive). */
export function matchedSkills(opportunity, userSkills) {
  const mine = new Set((userSkills || []).map(norm).filter(Boolean))
  if (!mine.size) return []
  return (opportunity?.skills_required || []).filter((skill) => mine.has(norm(skill)))
}

/**
 * Order suggestions for a volunteer: events that match more of their skills first,
 * then the soonest. Each item gets `matched_skills`.
 */
export function rankBySkills(opportunities, userSkills, compareDates) {
  return opportunities
    .map((o) => ({ ...o, matched_skills: matchedSkills(o, userSkills) }))
    .sort((a, b) => b.matched_skills.length - a.matched_skills.length || compareDates(a, b))
}
