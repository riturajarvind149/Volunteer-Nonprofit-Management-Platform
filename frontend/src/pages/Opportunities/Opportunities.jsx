import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import OpportunityCard from '../../components/OpportunityCard'
import { useOpportunities } from '../../context/OpportunityContext'
import { useAuth } from '../../context/AuthContext'
import './Opportunities.css'

const CATEGORIES = ['All', 'Hunger & Food', 'Education', 'Environment', 'Animal Welfare', 'Community Support', 'Health & Wellness', 'Arts & Culture', 'Other']

function Opportunities() {
  const { opportunities, loading, error, usingMock } = useOpportunities()
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const successMessage = location.state?.message || ''
  const isCoordinator = user?.role === 'COORDINATOR'

  // Derive unique locations from current data
  const locationOptions = [
    'All',
    ...new Set(opportunities.map((o) => o.location).filter(Boolean)),
  ]

  const filteredOpportunities = opportunities.filter((item) => {
    const title = item.title || ''
    const org = item.organization || item.organization_name || ''
    const matchesSearch =
      title.toLowerCase().includes(search.toLowerCase()) ||
      org.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || item.category === category
    const matchesLocation = locationFilter === 'All' || item.location === locationFilter
    return matchesSearch && matchesCategory && matchesLocation
  })

  const handleClearFilters = () => {
    setSearch('')
    setCategory('All')
    setLocationFilter('All')
  }

  return (
    <main className="opportunities-page">
      <div className="opportunities-container">
        <header className="opportunities-header">
          <div className="opps-header-row">
            <div>
              <h1>Volunteer Opportunities</h1>
              <p>Discover meaningful ways to give back, support local causes, and make a real difference.</p>
            </div>
            {isAuthenticated && isCoordinator && (
              <Link to="/opportunities/new" className="btn btn-primary">+ Post Opportunity</Link>
            )}
          </div>
          {usingMock && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Showing sample opportunities — connect the backend to see live listings.
            </p>
          )}
        </header>

        {successMessage && <div className="alert-success">{successMessage}</div>}

        <section className="filter-bar">
          <input
            type="text"
            className="filter-input"
            placeholder="Search by title or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="filter-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>
          <select className="filter-input" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
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