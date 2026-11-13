/** "Teamwork, first aid,  lifting" → ['Teamwork', 'first aid', 'lifting'] (case-insensitive dedupe, max 20) */
export function parseSkills(text) {
  const seen = new Set()
  const skills = []
  for (const raw of (text || '').split(',')) {
    const skill = raw.trim()
    const key = skill.toLowerCase()
    if (!skill || seen.has(key)) continue
    seen.add(key)
    skills.push(skill)
  }
  return skills.slice(0, 20)
}
