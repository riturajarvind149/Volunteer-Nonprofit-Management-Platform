import { useState } from 'react'
import OpportunityCard from '../../components/OpportunityCard'
import './Opportunities.css'

const MOCK_OPPORTUNITIES = [
  {
    id: 1,
    title: 'Community Food Drive',
    organization: 'City Food Bank',
    category: 'Hunger & Food',
    date: 'Oct 15, 2026',
    location: 'Downtown Center',
    spots: 8,
  },
  {
    id: 2,
    title: 'Youth Mentorship Program',
    organization: 'Bright Future Foundation',
    category: 'Education',
    date: 'Oct 18, 2026',
    location: 'Community Library',
    spots: 4,
  },
  {
    id: 3,
    title: 'Park Clean-Up & Tree Planting',
    organization: 'Green Earth Initiative',
    category: 'Environment',
    date: 'Oct 22, 2026',
    location: 'Riverside Park',
    spots: 12,
  },
  {
    id: 4,
    title: 'Animal Shelter Assistant',
    organization: 'Happy Paws Rescue',
    category: 'Animal Welfare',
    date: 'Oct 25, 2026',
    location: 'Westside Shelter',
    spots: 6,
  },
  {
    id: 5,
    title: 'Senior Care Companion',
    organization: 'Silver Care Network',
    category: 'Community Support',
    date: 'Nov 02, 2026',
    location: 'Sunset Senior Home',
    spots: 5,
  },
  {
    id: 6,
    title: 'Tech Literacy Workshop',
    organization: 'Code For All',
    category: 'Education',
    date: 'Nov 05, 2026',
    location: 'Downtown Center',
    spots: 10,
  },
]

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
