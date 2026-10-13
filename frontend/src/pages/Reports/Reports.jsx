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
    rows: 12,
  },
  {
    id: 'hours',
    icon: '⏱',
    title: 'Volunteer Hours Report',
    desc: 'Complete record of all volunteering hours — pending, verified, and rejected — with totals per volunteer.',
    rows: 28,
  },
  {
    id: 'performance',
    icon: '📊',
    title: 'Opportunity Performance Report',
    desc: 'Analysis of each opportunity: fill rate, attendance, hours generated, and volunteer feedback.',
    rows: 6,
  },
]

function Reports() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const [fromDate, setFromDate] = useState('01-04-2024')
  const [toDate, setToDate] = useState('30-09-2024')
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
      const from = fromDate.split('-').reverse().join('-')
      const to = toDate.split('-').reverse().join('-')
      const res = await getOrganizationOpportunitiesSummaryApi(token, { from_date: from, to_date: to }).catch(() => null)
      setReportData(res?.data || null)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = () => {
    alert('Export functionality would generate a CSV or PDF file in a production environment.')
  }

  const report = REPORT_TYPES.find((r) => r.id === selectedReport)

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
            value={fromDate.split('-').reverse().join('-')}
            onChange={(e) => setFromDate(e.target.value.split('-').reverse().join('-'))}
          />
        </div>
        <div className="reports-date-group">
          <label>To Date</label>
          <input
            type="date"
            value={toDate.split('-').reverse().join('-')}
            onChange={(e) => setToDate(e.target.value.split('-').reverse().join('-'))}
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
            <span className="reports-type-rows">{r.rows} data rows</span>
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
          ) : (
            <div className="reports-preview-table-wrapper">
              {selectedReport === 'participation' && (
                <ParticipationPreview />
              )}
              {selectedReport === 'hours' && (
                <HoursPreview />
              )}
              {selectedReport === 'performance' && (
                <PerformancePreview />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ParticipationPreview() {
  const rows = [
    { vol: 'Rahul Sharma', email: 'rahul@example.com', events: 4, hours: 14, status: 'Active' },
    { vol: 'Ananya Krishnan', email: 'ananya@example.com', events: 3, hours: 10, status: 'Active' },
    { vol: 'Mohammed Ali', email: 'mo@outlook.com', events: 2, hours: 7, status: 'Active' },
    { vol: 'Sneha Patel', email: 'sneha@gmail.com', events: 5, hours: 18, status: 'Active' },
    { vol: 'Arjun Nair', email: 'arjun@gmail.com', events: 1, hours: 4, status: 'Active' },
  ]
  return (
    <table className="reports-table">
      <thead>
        <tr>
          <th>Volunteer</th>
          <th>Email</th>
          <th>Events</th>
          <th>Hours</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.vol}>
            <td><strong>{r.vol}</strong></td>
            <td>{r.email}</td>
            <td>{r.events}</td>
            <td>{r.hours} hrs</td>
            <td><span className="report-badge badge-active">{r.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HoursPreview() {
  const rows = [
    { date: '20 Sep', opp: 'Lake Cleanup Drive', vol: 'Sneha Patel', hours: 4, status: 'PENDING' },
    { date: '21 Sep', opp: 'Lake Cleanup Drive', vol: 'Mohammed Ali', hours: 4, status: 'PENDING' },
    { date: '21 Sep', opp: 'Weekend Food Distribution', vol: 'Rahul Sharma', hours: 3.5, status: 'PENDING' },
    { date: '28 Sep', opp: 'Teach Kids Coding', vol: 'Ananya Krishnan', hours: 3, status: 'VERIFIED' },
    { date: '5 Oct', opp: 'Tree Plantation Campaign', vol: 'Arjun Nair', hours: 4, status: 'VERIFIED' },
  ]
  const statusClass = { PENDING: 'badge-pending', VERIFIED: 'badge-verified' }
  return (
    <table className="reports-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Opportunity</th>
          <th>Volunteer</th>
          <th>Hours</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.date}</td>
            <td>{r.opp}</td>
            <td>{r.vol}</td>
            <td>{r.hours}</td>
            <td><span className={`report-badge ${statusClass[r.status] || ''}`}>{r.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PerformancePreview() {
  const rows = [
    { opp: 'Lake Cleanup Drive', date: '20 Sep', capacity: 30, registered: 18, fill: 60, hours: 72 },
    { opp: 'Weekend Food Distribution', date: '21 Sep', capacity: 20, registered: 17, fill: 85, hours: 68 },
    { opp: 'Teach Kids Coding', date: '28 Sep', capacity: 12, registered: 9, fill: 75, hours: 27 },
    { opp: 'Tree Plantation Campaign', date: '5 Oct', capacity: 50, registered: 32, fill: 64, hours: 128 },
    { opp: 'Animal Shelter Support', date: '22 Sep', capacity: 15, registered: 15, fill: 100, hours: 60 },
    { opp: 'Community Health Drive', date: '12 Oct', capacity: 25, registered: 11, fill: 44, hours: 44 },
  ]
  return (
    <table className="reports-table">
      <thead>
        <tr>
          <th>Opportunity</th>
          <th>Date</th>
          <th>Capacity</th>
          <th>Registered</th>
          <th>Fill Rate</th>
          <th>Hours</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.opp}>
            <td><strong>{r.opp}</strong></td>
            <td>{r.date}</td>
            <td>{r.capacity}</td>
            <td>{r.registered}</td>
            <td>
              <div className="report-fill-bar-row">
                <div className="report-fill-track">
                  <div className="report-fill-bar" style={{ width: `${r.fill}%`, backgroundColor: r.fill >= 90 ? '#dc2626' : r.fill >= 60 ? '#d97706' : 'var(--color-primary)' }} />
                </div>
                <span>{r.fill}%</span>
              </div>
            </td>
            <td>{r.hours} hrs</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default Reports
