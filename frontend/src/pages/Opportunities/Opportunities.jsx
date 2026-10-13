import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOpportunities } from '../../context/OpportunityContext'
import { useAuth } from '../../context/AuthContext'
import './Opportunities.css'

const CATEGORIES = ['All', 'Environment', 'Education', 'Food & Hunger', 'Animal Welfare', 'Health', 'Community']

function OpportunityBrowseCard({ opportunity }) {
  const { isRegistered } = useOpportunities()
  const registered = isRegistered(opportunity.id)

  const spotsRemaining = opportunity.spots_remaining ?? opportunity.spots
  const capacity = opportunity.capacity
  const active = opportunity.active_signups || 0
  const filled = capacity > 0 ? active : 0
  const total = capacity || 30
  const isFull = spotsRemaining !== undefined ? spotsRemaining <= 0 : false
  const fillPct = Math.min(Math.round((filled / total) * 100), 100)

  const formatDate = (d) => {
    if (!d) return ''
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch { return d }
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const d = new Date()
    d.setHours(Number(h), Number(m))
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <article className="browse-card">
      <div className="browse-card-img-wrapper">
        <div className="browse-card-img-placeholder" />
        <span className={`browse-category-tag browse-cat-${(opportunity.category || 'community').toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, '')}`}>
          {opportunity.category || 'Community'}
        </span>
        {isFull && <span className="browse-full-badge">FULLY BOOKED</span>}
        {!isFull && spotsRemaining !== undefined && spotsRemaining <= 5 && (
          <span className="browse-spots-badge">{spotsRemaining} SPOTS LEFT</span>
        )}
      </div>

      <div className="browse-card-body">
        <h3 className="browse-card-title">{opportunity.title}</h3>
        <p className="browse-card-org">
          {opportunity.organization_name || opportunity.organization || 'Organization'}
        </p>
        <p className="browse-card-desc">
          {opportunity.description ? opportunity.description.slice(0, 90) + (opportunity.description.length > 90 ? '...' : '') : ''}
        </p>

        <div className="browse-card-meta">
          {opportunity.event_date && (
            <span>📅 {formatDate(opportunity.event_date)}</span>
          )}
          {opportunity.start_time && (
            <span>🕐 {formatTime(opportunity.start_time)}</span>
          )}
          {opportunity.location && (
            <span>📍 {opportunity.location}</span>
          )}
        </div>

        <div className="browse-card-capacity">
          <div className="browse-cap-bar-track">
            <div className="browse-cap-bar-fill" style={{ width: `${fillPct}%` }} />
          </div>
          <span className="browse-cap-label">{filled}/{total} volunteers</span>
        </div>
      </div>

      <div className="browse-card-footer">
        {isFull ? (
          <button type="button" className="browse-btn-full" disabled>Opportunity Full</button>
        ) : (
          <Link to={`/opportunities/${opportunity.id}`} className="browse-btn-view">
            View Details
          </Link>
        )}
      </div>
    </article>
  )
}

function Opportunities() {
  const { opportunities, loading, error } = useOpportunities()
  const { isAuthenticated } = useAuth()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = opportunities.filter((item) => {
    const title = (item.title || '').toLowerCase()
    const org = (item.organization_name || item.organization || '').toLowerCase()
    const q = search.toLowerCase()
    const matchSearch = !q || title.includes(q) || org.includes(q)
    const matchCat = category === 'All' || item.category === category || (category === 'Food & Hunger' && item.category === 'Hunger & Food')
    return matchSearch && matchCat
  })

  return (
    <div className="browse-page">
      <div className="browse-header">
        <h1>Find Your Next Opportunity</h1>
        <p>Browse {filtered.length} verified volunteer opportunities.</p>
      </div>

      <div className="browse-search-row">
        <div className="browse-search-wrapper">
          <span className="browse-search-icon">🔍</span>
          <input
            type="text"
            className="browse-search-input"
            placeholder="Search opportunities, organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="browse-filters-btn">▼ Filters</button>
      </div>

      <div className="browse-category-pills">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`browse-cat-pill${category === cat ? ' active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading opportunities...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="browse-empty">
          <p>No opportunities found.</p>
          <button type="button" className="browse-reset-btn" onClick={() => { setSearch(''); setCategory('All') }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <p className="browse-results-count">{filtered.length} opportunities found</p>
          <div className="browse-grid">
            {filtered.map((opp) => (
              <OpportunityBrowseCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Opportunities
