import { useSearchParams, Link } from 'react-router-dom'
import { useOpportunities } from '../../context/OpportunityContext'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'
import OpportunityRow from '../../components/OpportunityRow'
import { PageHeader, LoadingState, EmptyState, Alert } from '../../components/ui'
import { isUpcoming, compareByDate, parseDate, pluralize } from '../../utils/format'
import './Opportunities.css'

function matchesQuery(opportunity, query) {
  if (!query) return true
  const haystack = [
    opportunity.title,
    opportunity.organization_name,
    opportunity.location,
    opportunity.address,
    opportunity.category,
    opportunity.description,
  ].filter(Boolean).join(' ').toLowerCase()
  return query.toLowerCase().split(/\s+/).every((word) => haystack.includes(word))
}

function groupByMonth(items) {
  const groups = []
  for (const item of items) {
    const date = parseDate(item.event_date)
    const label = date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Date to be confirmed'
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

function Opportunities() {
  const { opportunities, loading, error, refetch, isRegistered } = useOpportunities()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') || ''
  const category = params.get('category') || ''
  const showPast = params.get('when') === 'all'
  const openOnly = params.get('open') === '1'

  const updateParam = (key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  const published = opportunities.filter((o) => o.status === 'PUBLISHED')
  const categories = [...new Set(published.map((o) => o.category).filter(Boolean))].sort()

  const results = published
    .filter((o) => showPast || isUpcoming(o.event_date))
    .filter((o) => !category || o.category === category)
    .filter((o) => !openOnly || Number(o.spots_remaining) > 0)
    .filter((o) => matchesQuery(o, query.trim()))
    .sort(compareByDate)

  const activeFilters = [
    query && { key: 'q', label: `“${query}”` },
    category && { key: 'category', label: category },
    showPast && { key: 'when', label: 'Including past dates' },
    openOnly && { key: 'open', label: 'Open spots only' },
  ].filter(Boolean)

  const isVolunteer = user?.role === 'VOLUNTEER'

  return (
    <div className="page">
      <PageHeader
        title="Browse opportunities"
        description="Published volunteer opportunities from every organization on ServeHub, soonest first."
      />

      <div className="browse-toolbar" role="search">
        <label className="search">
          <span className="sr-only">Search opportunities</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            className="input"
            placeholder="Search by title, organization, place or keyword"
            value={query}
            onChange={(e) => updateParam('q', e.target.value)}
          />
        </label>
        <label className="browse-category">
          <span className="sr-only">Category</span>
          <select className="select" value={category} onChange={(e) => updateParam('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="segmented" role="group" aria-label="Dates">
          <button type="button" aria-pressed={!showPast} onClick={() => updateParam('when', '')}>Upcoming</button>
          <button type="button" aria-pressed={showPast} onClick={() => updateParam('when', 'all')}>All dates</button>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={openOnly} onChange={(e) => updateParam('open', e.target.checked ? '1' : '')} />
          Open spots only
        </label>
      </div>

      <div className="browse-summary">
        <p aria-live="polite">
          {loading ? 'Loading…' : pluralize(results.length, 'opportunity', 'opportunities')}
        </p>
        {activeFilters.length > 0 && (
          <ul className="filter-chips" role="list">
            {activeFilters.map((f) => (
              <li key={f.key}>
                <button type="button" className="filter-chip" onClick={() => updateParam(f.key, '')} aria-label={`Remove filter ${f.label}`}>
                  {f.label}
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="link-button" onClick={() => setParams({}, { replace: true })}>Clear all</button>
            </li>
          </ul>
        )}
      </div>

      {error && <Alert onRetry={refetch}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading opportunities…" />
      ) : results.length === 0 ? (
        <div className="panel">
          {published.length === 0 && !error ? (
            <EmptyState icon="calendar" title="No opportunities have been published yet">
              {isVolunteer ? 'Check back soon — new opportunities appear here as soon as an organization publishes them.' : 'Published opportunities from every organization will be listed here.'}
            </EmptyState>
          ) : (
            <EmptyState
              icon="search"
              title="Nothing matches these filters"
              action={<button type="button" className="btn btn-secondary" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
            >
              {showPast ? 'Try a different search term or category.' : 'Try another search term, or include past dates.'}
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="browse-groups">
          {groupByMonth(results).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="browse-month">{group.label}</h2>
              <ul role="list" className="opp-list">
                {group.items.map((o) => (
                  <li key={o.id}>
                    <OpportunityRow opportunity={o} registered={isVolunteer && isRegistered(o.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {user?.role === 'COORDINATOR' && (
        <p className="muted browse-note">
          Drafts are hidden here. Manage your own drafts from <Link to="/manage-opportunities">Opportunities</Link>.
        </p>
      )}
    </div>
  )
}

export default Opportunities
