import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationOpportunitiesSummaryApi } from '../../services/api'
import './Reports.css'

const REPORT_TYPES = [
  {
    id: 'participation',
    icon: '👥',
    title: 'Volunteer Participation Report',
    desc: 'Full breakdown of volunteer attendance, registrations, and engagement across all events.',
  },
  {
    id: 'hours',
    icon: '⏱',
    title: 'Volunteer Hours Report',
    desc: 'Complete record of all volunteering hours — pending, verified, and rejected — with totals per volunteer.',
  },
  {
    id: 'performance',
    icon: '📊',
    title: 'Opportunity Performance Report',
    desc: 'Analysis of each opportunity: fill rate, attendance, hours generated, and volunteer feedback.',
  },
]

function Reports() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState(null)

  if (authLoading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />
  if (user.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />

  const handleSelectReport = async (reportId) => {
    setSelectedReport(reportId)
    setGenerating(true)
    setReportData(null)
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await getOrganizationOpportunitiesSummaryApi(token, params).catch(() => null)
      setReportData(res?.data || null)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = () => {
    alert('Export functionality would generate a CSV or PDF file in a production environment.')
  }

  const report = REPORT_TYPES.find((r) => r.id === selectedReport)
  const opportunities = reportData?.opportunities || []

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Reports</h1>
          <p>Generate and export comprehensive reports for your organization.</p>
        </div>
      </div>

      <div className="reports-date-row">
        <div className="reports-date-group">
          <label>From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="reports-date-group">
          <label>To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button type="button" className="reports-apply-btn" onClick={() => selectedReport && handleSelectReport(selectedReport)}>
          Apply Date Range
        </button>
      </div>

      <div className="reports-types-grid">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`reports-type-card${selectedReport === r.id ? ' selected' : ''}`}
            onClick={() => handleSelectReport(r.id)}
          >
            <span className="reports-type-icon">{r.icon}</span>
            <h3 className="reports-type-title">{r.title}</h3>
            <p className="reports-type-desc">{r.desc}</p>
          </button>
        ))}
      </div>

      {!selectedReport && (
        <div className="reports-empty-state">
          <span className="reports-empty-icon">📊</span>
          <p>Select a report type above</p>
          <span>Choose a report to preview it and export.</span>
        </div>
      )}

      {selectedReport && (
        <div className="reports-preview-card">
          <div className="reports-preview-header">
            <h2>{report?.title}</h2>
            <button type="button" className="reports-export-btn" onClick={handleExport}>
              ↓ Export
            </button>
          </div>

          {generating ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>Generating report...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="reports-empty-state">
              <p>No data available for the selected date range.</p>
              <span>Try adjusting the date range or check back after events have been completed.</span>
            </div>
          ) : (
            <div className="reports-preview-table-wrapper">
              <PerformancePreview opportunities={opportunities} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PerformancePreview({ opportunities }) {
  return (
    <table className="reports-table">
      <thead>
        <tr>
          <th>Opportunity</th>
          <th>Event Date</th>
          <th>Total Hours</th>
          <th>Verified Hours</th>
          <th>Volunteers</th>
        </tr>
      </thead>
      <tbody>
        {opportunities.map((opp) => (
          <tr key={opp.opportunity_id || opp.id}>
            <td><strong>{opp.opportunity_title || opp.title || 'Opportunity'}</strong></td>
            <td>{opp.event_date ? new Date(opp.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
            <td>{Number(opp.total_hours || 0).toFixed(1)} hrs</td>
            <td>{Number(opp.verified_hours || 0).toFixed(1)} hrs</td>
            <td>{opp.volunteer_count ?? opp.total_volunteers ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default Reports
