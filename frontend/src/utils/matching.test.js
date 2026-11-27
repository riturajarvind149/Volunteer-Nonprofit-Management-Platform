import { describe, it, expect } from 'vitest'
import { matchedSkills, rankBySkills } from './matching'

const byDate = (a, b) => a.event_date.localeCompare(b.event_date)

describe('matchedSkills', () => {
  it('finds the opportunity skills the volunteer has, ignoring case and spaces', () => {
    expect(matchedSkills({ skills_required: ['Teaching', 'Maths'] }, [' teaching ', 'Art'])).toEqual(['Teaching'])
  })

  it('returns nothing when either side has no skills', () => {
    expect(matchedSkills({ skills_required: null }, ['Teaching'])).toEqual([])
    expect(matchedSkills({ skills_required: ['Teaching'] }, [])).toEqual([])
  })
})

describe('rankBySkills', () => {
  it('puts better matches first, then the soonest', () => {
    const opps = [
      { id: 'a', event_date: '2099-01-01', skills_required: [] },
      { id: 'b', event_date: '2099-01-05', skills_required: ['First aid', 'Kannada'] },
      { id: 'c', event_date: '2099-01-03', skills_required: ['Kannada'] },
      { id: 'd', event_date: '2099-01-02', skills_required: [] },
    ]
    const ranked = rankBySkills(opps, ['Kannada', 'First aid'], byDate)
    expect(ranked.map((o) => o.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(ranked[0].matched_skills).toEqual(['First aid', 'Kannada'])
  })
})
