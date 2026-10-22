import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getDashboardStatsApi, getOrganizationHoursSummaryApi } from '../../services/api'
import './Analytics.css'

function LineChart({ data, color = 'var(--color-primary)' }) {
  const max = Math.max(...data)
  const w = 320
  const h = 90
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / max) * h * 0.9 + 4,
  }))
  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${h + 4} L 0 ${h + 4} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h + 10}`} className="analytics-svg">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="4" fill={color} />
      ))}
    </svg>
  )
}

function BarChart({ data, colors }) {
  const max = Math.max(...data)
  return (
    <div className="analytics-bar-chart">
      {data.map((v, i) => (
        <div key={i} className="analytics-bar-col">
          <div
            className="analytics-bar"
            style={{ height: `${Math.max((v / max) * 90, 4)}px`, backgroundColor: colors ? colors[i % colors.length] : 'var(--color-primary)' }}
          />
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.pct, 0)
  let cumulative = 0
  const radius = 50
  const cx = 70
  const cy = 70
  const segments = data.map((d) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    cumulative += d.pct
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + radius * Math.cos(start)
    const y1 = cy + radius * Math.sin(start)
    const x2 = cx + radius * Math.cos(end)
    const y2 = cy + radius * Math.sin(end)
    const largeArc = d.pct / total > 0.5 ? 1 : 0
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z` }
  })

  return (
    <div className="donut-chart-wrapper">
      <svg viewBox="0 0 140 140" className="donut-svg">
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity="0.9" />
        ))}
        <circle cx={cx} cy={cy} r={28} fill="var(--bg-card)" />
      </svg>
      <div className="donut-legend">
        {data.map((d) => (
          <div key={d.label} className="donut-legend-item">
            <span className="donut-dot" style={{ backgroundColor: d.color }} />
            <span>{d.label}</span>
            <span className="donut-pct">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value))
  return (
    <div className="horiz-bar-list">
      {data.map((d) => (
        <div key={d.label} className="horiz-bar-row">
          <span className="horiz-bar-label">{d.label}</span>
          <div className="horiz-bar-track">
            <div className="horiz-bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="horiz-bar-val">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

function Analytics() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const [period, setPeriod] = useState('3months')
  const [stats, setStats] = useState(null)
  const [hoursSum, setHoursSum] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [sRes, hRes] = await Promise.all([
        getDashboardStatsApi(token).catch(() => null),
        getOrganizationHoursSummaryApi(token).catch(() => null),
      ])
      setStats(sRes?.data?.stats || null)
      setHoursSum(hRes?.data?.summary || hRes?.data || null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />

  const totalVols = stats?.total_volunteers_registered ?? null
  const activeOpps = stats?.active_opportunities ?? null
  const completedEvents = stats?.completed_count ?? null
  const totalHours = hoursSum?.total_hours != null ? Number(hoursSum.total_hours) : null
  const totalReg = stats?.total_registrations ?? null
  const categoryData = hoursSum?.by_category || null
  const monthlyHours = hoursSum?.by_month || null
  const oppBreakdown = hoursSum?.by_opportunity || null

  const summaryStats = [
    { label: 'Total Volunteers', value: totalVols },
    { label: 'Active Opportunities', value: activeOpps },
    { label: 'Total Registrations', value: totalReg },
    { label: 'Volunteer Hours', value: totalHours != null ? totalHours.toLocaleString() : null },
    { label: 'Completed Events', value: completedEvents },
  ].filter(s => s.value != null)

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1>Analytics</h1>
          <p>Understand your organization's volunteer impact.</p>
        </div>
        <div className="analytics-controls">
          {['7days', '30days', '3months', 'year'].map((p) => (
            <button
              key={p}
              type="button"
              className={`analytics-period-btn${period === p ? ' active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === '7days' ? 'Last 7 days' : p === '30days' ? 'Last 30 days' : p === '3months' ? 'Last 3 months' : 'Last year'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : summaryStats.length === 0 ? (
        <div className="analytics-empty">
          <p>No analytics data available yet. Analytics will appear once your organization has volunteers and events.</p>
        </div>
      ) : (
        <>
          <div className="analytics-stats-row">
            {summaryStats.map((s) => (
              <div key={s.label} className="analytics-stat-card">
                <div className="analytics-stat-value">{s.value}</div>
                <div className="analytics-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="analytics-charts-grid">
            {monthlyHours && monthlyHours.length > 1 && (
              <div className="analytics-chart-card">
                <div className="analytics-chart-header">
                  <h2>Volunteer Hours by Month</h2>
                  {totalHours != null && <span className="analytics-chart-total">{totalHours.toLocaleString()} total hrs</span>}
                </div>
                <LineChart data={monthlyHours.map(m => m.hours || 0)} />
                <div className="analytics-x-labels">
                  {monthlyHours.map((m) => <span key={m.month}>{m.month}</span>)}
                </div>
              </div>
            )}

            {categoryData && categoryData.length > 0 && (
              <div className="analytics-chart-card">
                <div className="analytics-chart-header">
                  <h2>By Category</h2>
                </div>
                <DonutChart data={categoryData} />
              </div>
            )}

            {oppBreakdown && oppBreakdown.length > 0 && (
              <div className="analytics-chart-card">
                <div className="analytics-chart-header">
                  <h2>Volunteers per Opportunity</h2>
                </div>
                <HorizBarChart data={oppBreakdown.map(o => ({ label: o.title || o.label, value: o.volunteer_count || o.value || 0 }))} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Analytics
