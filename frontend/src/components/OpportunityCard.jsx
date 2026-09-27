function OpportunityCard({ opportunity }) {
  const { title, organization, category, date, location, spots } = opportunity

  return (
    <article className="opportunity-card">
      <div className="card-top">
        <span className="card-category">{category}</span>
        <span className="card-spots">{spots} spots left</span>
      </div>
      <h3 className="card-title">{title}</h3>
      <p className="card-org">{organization}</p>
      <div className="card-details">
        <p><strong>Date:</strong> {date}</p>
        <p><strong>Location:</strong> {location}</p>
      </div>
      <button type="button" className="btn btn-outline card-btn">
        View Details
      </button>
    </article>
  )
}

export default OpportunityCard
