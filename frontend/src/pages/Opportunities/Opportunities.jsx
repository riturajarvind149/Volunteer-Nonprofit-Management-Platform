import { useState } from 'react'
import OpportunityCard from '../../components/OpportunityCard'
import { useOpportunities } from '../../context/OpportunityContext'
import './Opportunities.css'

const CATEGORIES = ['All', 'Hunger & Food', 'Education', 'Environment', 'Animal Welfare', 'Community Support']

function Opportunities() {
  const { opportunities, loading, error, usingMock } = useOpportunities()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('All')

  // Derive unique locations from current data
  const locationOptions = [
    'All',
    ...new Set(
      opportunities
        .map((o) => o.location)
        .filter(Boolean)
    ),
  ]

  const filteredOpportunities = opportunities.filter((item) => {
    const title = item.title || ''
    const org = item.organization || item.organization_name || ''
    const matchesSearch =
      title.toLowerCase().includes(search.toLowerCase()) ||
      org.toLowerCase().includes(search.toLowerCase())
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
          {usingMock && (
            <p className="mock-notice" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted, #888)', marginTop: '0.25rem' }}>
              Showing sample opportunities — connect the backend to see live listings.
            </p>
          )}
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
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc === 'All' ? 'All Locations' : loc}
              </option>
            ))}
          </select>
        </section>

        {error && <div className="alert-error">{error}</div>}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading opportunities...</p>
          </div>
        ) : filteredOpportunities.length > 0 ? (
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
