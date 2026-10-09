import { Link } from 'react-router-dom'
import './OpportunityCard.css'

function OpportunityCard({ opportunity }) {
  const {
    id,
    title,
    // Real API uses organization_name; mock uses organization
    organization_name,
    organization,
    category,
    // Real API uses event_date / start_time; mock uses date / time
    event_date,
    date,
    location,
    // Real API uses spots_remaining; mock uses spots
    spots_remaining,
    spots,
  } = opportunity

  const orgDisplay = organization_name || organization || 'Unknown Organization'

  // Format date display
  let dateDisplay = date || ''
  if (!dateDisplay && event_date) {
    dateDisplay = new Date(event_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Spots display
  const spotsCount = spots_remaining !== undefined ? Number(spots_remaining) : spots !== undefined ? Number(spots) : null
  const spotsDisplay =
    spotsCount === null
      ? null
      : spotsCount <= 0
      ? 'Fully Booked'
      : `${spotsCount} spot${spotsCount !== 1 ? 's' : ''} left`

  return (
    <article className="opportunity-card">
      <div className="card-top">
        {category && <span className="card-category">{category}</span>}
        {spotsDisplay && <span className="card-spots">{spotsDisplay}</span>}
      </div>
      <h3 className="card-title">{title}</h3>
      <p className="card-org">{orgDisplay}</p>
      <div className="card-details">
        {dateDisplay && <p><strong>Date:</strong> {dateDisplay}</p>}
        {location && <p><strong>Location:</strong> {location}</p>}
      </div>
      <Link to={`/opportunities/${id}`} className="btn btn-outline card-btn">
        View Details
      </Link>
    </article>
  )
}

export default OpportunityCard
