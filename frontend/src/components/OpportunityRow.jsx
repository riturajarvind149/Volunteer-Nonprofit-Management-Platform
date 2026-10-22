import { Link } from 'react-router-dom'
import Icon from './Icon'
import { DateBlock, CapacityMeter } from './ui'
import { formatTime, spotsLabel } from '../utils/format'
import './OpportunityRow.css'

function OpportunityRow({ opportunity, registered = false, showOrganization = true }) {
  const time = formatTime(opportunity.start_time, opportunity.end_time)
  const spots = spotsLabel(opportunity)
  const isFull = spots === 'Full'

  return (
    <Link to={`/opportunities/${opportunity.id}`} className="opp-row">
      <DateBlock date={opportunity.event_date} />
      <div className="opp-row-main">
        {opportunity.category && <span className="tag">{opportunity.category}</span>}
        <h3 className="opp-row-title">{opportunity.title}</h3>
        <div className="meta-line">
          {showOrganization && opportunity.organization_name && (
            <span><Icon name="building" size={14} />{opportunity.organization_name}</span>
          )}
          {time && <span><Icon name="clock" size={14} />{time}</span>}
          {opportunity.location && <span><Icon name="map-pin" size={14} />{opportunity.location}</span>}
        </div>
      </div>
      <div className="opp-row-side">
        {registered ? (
          <span className="badge badge-success">You’re registered</span>
        ) : (
          spots && <span className={`opp-row-spots${isFull ? ' is-full' : ''}`}>{spots}</span>
        )}
        <CapacityMeter taken={opportunity.active_signups} capacity={opportunity.capacity} />
      </div>
      <Icon name="chevron-right" size={18} className="opp-row-chevron" />
    </Link>
  )
}

export default OpportunityRow
