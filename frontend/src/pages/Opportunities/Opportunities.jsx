import { useState } from 'react'
import OpportunityCard from '../../components/OpportunityCard'
import { MOCK_OPPORTUNITIES } from './mockOpportunities'
import './Opportunities.css'

const CATEGORIES = ['All', 'Hunger & Food', 'Education', 'Environment', 'Animal Welfare', 'Community Support']
const LOCATIONS = ['All', 'Downtown Center', 'Community Library', 'Riverside Park', 'Westside Shelter', 'Sunset Senior Home']

function Opportunities() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('All')

  const filteredOpportunities = MOCK_OPPORTUNITIES.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.organization.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || item.category === category
    const matchesLocation = location === 'All' || item.location === location
    return matchesSearch && matchesCategory && matchesLocation
  })

  const handleClearFilters = () => {
    setSearch('')
    setCategory('All')
    setLocation('All')
  }

  return (
    <main className="opportunities-page">
      <div className="opportunities-container">
        <header className="opportunities-header">
          <h1>Volunteer Opportunities</h1>
          <p>Discover meaningful ways to give back, support local causes, and make a real difference.</p>
        </header>

        <section className="filter-bar">
          <input
            type="text"
            className="filter-input"
            placeholder="Search by title or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="filter-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <select
            className="filter-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc === 'All' ? 'All Locations' : loc}
              </option>
            ))}
          </select>
        </section>

        {filteredOpportunities.length > 0 ? (
          <div className="opportunities-grid">
            {filteredOpportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No opportunities match your search criteria.</p>
            <button type="button" className="btn btn-secondary" onClick={handleClearFilters}>
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

export default Opportunities
