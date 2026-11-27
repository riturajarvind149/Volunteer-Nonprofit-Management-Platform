import { useEffect, useState } from 'react'
import { getImpactApi } from '../../services/api'

const FIGURES = [
  { key: 'verified_hours', label: 'Verified volunteer hours' },
  { key: 'volunteers', label: 'Volunteers with verified hours' },
  { key: 'organizations', label: 'Verified NGOs' },
  { key: 'events_completed', label: 'Events completed' },
]

const formatNumber = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN')

/**
 * Live platform totals on the home page. Hidden until they load, and when there is
 * nothing to show yet, so a new or unreachable deployment never shows zeros or errors.
 */
function ImpactStrip() {
  const [impact, setImpact] = useState(null)

  useEffect(() => {
    let active = true
    getImpactApi()
      .then((res) => { if (active) setImpact(res?.data?.impact || null) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  if (!impact || !Number(impact.verified_hours)) return null

  return (
    <section className="home-section home-impact" aria-labelledby="impact-title">
      <h2 id="impact-title" className="home-section-heading" data-reveal>Impact so far</h2>
      <dl className="impact-grid">
        {FIGURES.map((f) => (
          <div key={f.key} className="impact-figure">
            <dt>{f.label}</dt>
            <dd className="num">{formatNumber(impact[f.key])}</dd>
          </div>
        ))}
      </dl>
      {Number(impact.open_opportunities) > 0 && (
        <p className="impact-note muted">{formatNumber(impact.open_opportunities)} opportunities are open for registration right now.</p>
      )}
    </section>
  )
}

export default ImpactStrip
