import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useOpportunities } from '../../context/OpportunityContext'
import { useAuth } from '../../context/AuthContext'
import { getOpportunitiesApi } from '../../services/api'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import Icon from '../../components/Icon'
import OpportunityRow from '../../components/OpportunityRow'
import { PageHeader, LoadingState, EmptyState, Alert } from '../../components/ui'
import { parseDate, pluralize, formatDate } from '../../utils/format'
import { CATEGORIES } from '../../utils/categories'
import './Opportunities.css'

const PAGE_SIZE = 20

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

/** Text input that edits a URL parameter after the user pauses typing. */
function useDebouncedParam(params, updateParam, key) {
  const urlValue = params.get(key) || ''
  const [text, setText] = useState(urlValue)
  const debounced = useDebouncedValue(text, 350)

  // Keep the box in sync when the URL changes elsewhere (chips, "Clear all", back button).
  const lastUrlValue = useRef(urlValue)
  useEffect(() => {
    if (urlValue !== lastUrlValue.current) {
      lastUrlValue.current = urlValue
      setText(urlValue)
    }
  }, [urlValue])

  // Push the debounced text to the URL. Reads the URL value through a ref so that
  // an outside URL change (e.g. "Clear all") can't re-apply stale text.
  const updateRef = useRef(updateParam)
  useEffect(() => {
    updateRef.current = updateParam
  }, [updateParam])
  useEffect(() => {
    const next = debounced.trim()
    if (next !== lastUrlValue.current) {
      lastUrlValue.current = next
      updateRef.current(key, next)
    }
  }, [debounced, key])

  return [text, setText]
}

function Opportunities() {
  const { isRegistered } = useOpportunities()
  const { user, token, isAuthenticated } = useAuth()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') || ''
  const category = params.get('category') || ''
  const location = params.get('location') || ''
  const fromDate = params.get('from') || ''
  const toDate = params.get('to') || ''
  const showPast = params.get('when') === 'all'
  const openOnly = params.get('open') === '1'

  const updateParam = useCallback((key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }, [setParams])

  const [searchText, setSearchText] = useDebouncedParam(params, updateParam, 'q')
  const [locationText, setLocationText] = useDebouncedParam(params, updateParam, 'location')

  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const fetchPage = useCallback(async (page) => {
    const id = ++requestId.current
    if (page === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const res = await getOpportunitiesApi(token, {
        q: query,
        category,
        location,
        from_date: fromDate,
        to_date: toDate,
        upcoming: !showPast,
        available: openOnly,
        page,
        limit: PAGE_SIZE,
      })
      if (id !== requestId.current) return // a newer search superseded this one
      const next = res?.data?.opportunities || []
      setItems((prev) => (page === 1 ? next : [...prev, ...next]))
      setPagination(res?.data?.pagination || null)
    } catch (err) {
      if (id !== requestId.current) return
      setError(err.message || 'Opportunities could not be loaded.')
      if (page === 1) setItems([])
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [token, query, category, location, fromDate, toDate, showPast, openOnly])

  useEffect(() => { fetchPage(1) }, [fetchPage])

  const total = pagination?.total ?? items.length
  const hasMore = pagination ? pagination.page < pagination.total_pages : false

  const activeFilters = [
    query && { key: 'q', label: `“${query}”` },
    category && { key: 'category', label: category },
    location && { key: 'location', label: `Near “${location}”` },
    fromDate && { key: 'from', label: `From ${formatDate(fromDate)}` },
    toDate && { key: 'to', label: `Until ${formatDate(toDate)}` },
    showPast && { key: 'when', label: 'Including past dates' },
    openOnly && { key: 'open', label: 'Open spots only' },
  ].filter(Boolean)

  const clearAll = () => setParams({}, { replace: true })
  const isVolunteer = user?.role === 'VOLUNTEER'

  return (
    <div className="page">
      <PageHeader
        title="Browse opportunities"
        description="Published volunteer opportunities from verified organizations, soonest first."
        actions={!isAuthenticated && (
          <Link to="/register" className="btn btn-primary">Create an account to register</Link>
        )}
      />

      <div className="browse-toolbar" role="search">
        <label className="search">
          <span className="sr-only">Search opportunities</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            className="input"
            placeholder="Search by title, organization or keyword"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </label>
        <label className="search browse-location">
          <span className="sr-only">Location</span>
          <Icon name="map-pin" size={16} />
          <input
            type="search"
            className="input"
            placeholder="City or area"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
          />
        </label>
        <label className="browse-category">
          <span className="sr-only">Category</span>
          <select className="select" value={category} onChange={(e) => updateParam('category', e.target.value)}>
            <option value="">All categories</option>
            {(category && !CATEGORIES.includes(category) ? [category, ...CATEGORIES] : CATEGORIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="browse-dates">
          <label>
            <span className="browse-date-label">From</span>
            <input type="date" className="input" value={fromDate} max={toDate || undefined} onChange={(e) => updateParam('from', e.target.value)} />
          </label>
          <label>
            <span className="browse-date-label">To</span>
            <input type="date" className="input" value={toDate} min={fromDate || undefined} onChange={(e) => updateParam('to', e.target.value)} />
          </label>
        </div>
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
          {loading ? 'Loading…' : pluralize(total, 'opportunity', 'opportunities')}
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
              <button type="button" className="link-button" onClick={clearAll}>Clear all</button>
            </li>
          </ul>
        )}
      </div>

      {error && <Alert onRetry={() => fetchPage(1)}>{error}</Alert>}

      {loading ? (
        <LoadingState label="Loading opportunities…" />
      ) : items.length === 0 ? (
        !error && (
          <div className="panel">
            {activeFilters.length === 0 ? (
              <EmptyState icon="calendar" title="No upcoming opportunities yet">
                {isVolunteer
                  ? 'Check back soon — new opportunities appear here as soon as an organization publishes them.'
                  : 'Published opportunities from every verified organization will be listed here.'}
              </EmptyState>
            ) : (
              <EmptyState
                icon="search"
                title="Nothing matches these filters"
                action={<button type="button" className="btn btn-secondary" onClick={clearAll}>Clear filters</button>}
              >
                {showPast ? 'Try a different search term, place or category.' : 'Try another search term, or include past dates.'}
              </EmptyState>
            )}
          </div>
        )
      ) : (
        <>
          <div className="browse-groups">
            {groupByMonth(items).map((group) => (
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
          {hasMore && (
            <div className="browse-more">
              <button type="button" className="btn btn-secondary" onClick={() => fetchPage(pagination.page + 1)} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : `Show more (${total - items.length} remaining)`}
              </button>
            </div>
          )}
        </>
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
