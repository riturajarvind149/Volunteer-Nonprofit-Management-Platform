import { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  getOrganizationOpportunitiesSummaryApi,
  getParticipationReportApi,
  getVolunteerHoursReportApi,
  getOpportunityPerformanceReportApi,
} from '../../services/api'
import Icon from '../../components/Icon'
import DateRangeForm from '../../components/DateRangeForm'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge } from '../../components/ui'
import { formatDate, formatHours, pluralize } from '../../utils/format'
import { toCsv } from '../../utils/csv'
import { useAutoLoad } from '../../hooks/useAutoLoad'
import './Reports.css'

/**
 * Every report the page offers. Each one loads its rows for a date range from the API
 * and says how its rows are keyed, counted and described.
 */
const REPORTS = {
  summary: {
    slug: 'hours-by-opportunity',
    label: 'Hours by opportunity',
    description: 'Totals for each opportunity, counting hours logged in the selected period.',
    rangeLabel: 'Hours logged between',
    load: async (token, range) => (await getOrganizationOpportunitiesSummaryApi(token, range))?.data?.opportunities,
    rowKey: (r) => r.opportunity_id,
    count: (n) => pluralize(n, 'opportunity', 'opportunities'),
    empty: 'You haven’t created any opportunities yet.',
    columns: [
      { key: 'opportunity_title', label: 'Opportunity' },
      { key: 'organization_name', label: 'Organization' },
      { key: 'total_volunteers', label: 'Volunteers', num: true },
      { key: 'total_hours', label: 'Logged', num: true, hours: true },
      { key: 'verified_hours', label: 'Verified', num: true, hours: true },
      { key: 'recorded_hours', label: 'Recorded', num: true, hours: true },
      { key: 'pending_hours', label: 'Pending', num: true, hours: true },
    ],
  },
  performance: {
    slug: 'event-performance',
    label: 'Event performance',
    description: 'One row per event: registrations, cancellations, how full it got and the hours logged.',
    rangeLabel: 'Events between',
    load: async (token, range) => (await getOpportunityPerformanceReportApi(token, range))?.data?.report,
    rowKey: (r) => r.opportunity_id,
    count: (n) => pluralize(n, 'event'),
    empty: 'No events took place in the selected period.',
    columns: [
      { key: 'title', label: 'Event' },
      { key: 'event_date', label: 'Date', date: true },
      { key: 'status', label: 'Status', status: true },
      { key: 'active_registrations', label: 'Registered', num: true },
      { key: 'capacity', label: 'Capacity', num: true },
      { key: 'fill_rate_percentage', label: 'Filled', num: true, percent: true },
      { key: 'cancelled_registrations', label: 'Cancelled', num: true },
      { key: 'total_hours_logged', label: 'Hours logged', num: true, hours: true },
    ],
  },
  participation: {
    slug: 'volunteer-participation',
    label: 'Volunteer participation',
    description: 'One row per volunteer: sign-ups, attendance and hours for events in the selected period.',
    rangeLabel: 'Events between',
    load: async (token, range) => (await getParticipationReportApi(token, range))?.data?.report,
    rowKey: (r) => r.volunteer_id,
    count: (n) => pluralize(n, 'volunteer'),
    empty: 'No volunteers signed up for your events in the selected period.',
    columns: [
      { key: 'volunteer_name', label: 'Volunteer' },
      { key: 'volunteer_email', label: 'Email' },
      { key: 'total_signups', label: 'Sign-ups', num: true },
      { key: 'events_attended', label: 'Attended', num: true },
      { key: 'events_cancelled', label: 'Cancelled', num: true },
      { key: 'total_hours_logged', label: 'Hours logged', num: true, hours: true },
      { key: 'verified_hours', label: 'Verified', num: true, hours: true },
      { key: 'last_active_date', label: 'Last active', date: true },
    ],
  },
  log: {
    slug: 'hours-log',
    label: 'Hours log',
    description: 'Every individual hour entry logged in the selected period.',
    rangeLabel: 'Hours logged between',
    load: async (token, range) => (await getVolunteerHoursReportApi(token, range))?.data?.report,
    rowKey: (r) => r.hour_record_id,
    count: (n) => pluralize(n, 'entry', 'entries'),
    empty: 'No hours were logged in the selected period.',
    columns: [
      { key: 'recorded_at', label: 'Logged on', date: true },
      { key: 'volunteer_name', label: 'Volunteer' },
      { key: 'volunteer_email', label: 'Email' },
      { key: 'opportunity_title', label: 'Opportunity' },
      { key: 'organization_name', label: 'Organization' },
      { key: 'status', label: 'Status', status: true },
      { key: 'hours', label: 'Hours', num: true, hours: true },
    ],
  },
}

function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function Reports() {
  const { token } = useAuth()
  const [type, setType] = useState('summary')
  const [range, setRange] = useState({ from_date: '', to_date: '' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setRows((await REPORTS[type].load(token, range)) || [])
    } catch (err) {
      setError(err.message || 'The report could not be generated.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token, type, range])

  useAutoLoad(load)

  // Clear the previous report's rows right away so they're never drawn with the new report's columns.
  const chooseReport = (key) => {
    if (key === type) return
    setRows([])
    setLoading(true)
    setType(key)
  }

  const report = REPORTS[type]
  const hourColumns = report.columns.filter((c) => c.hours)
  const totals = Object.fromEntries(hourColumns.map((c) => [c.key, rows.reduce((sum, r) => sum + Number(r[c.key] || 0), 0)]))
  const periodLabel = range.from_date || range.to_date
    ? `${range.from_date ? formatDate(range.from_date) : 'the start'} – ${range.to_date ? formatDate(range.to_date) : 'today'}`
    : 'All time'

  const handleExport = () => {
    const suffix = [range.from_date, range.to_date].filter(Boolean).join('_to_') || 'all-time'
    downloadCsv(`servehub-${report.slug}-${suffix}.csv`, toCsv(report.columns, rows))
  }

  const renderCell = (column, row) => {
    const value = row[column.key]
    if (column.status) return <StatusBadge status={value} />
    if (column.date) return formatDate(value)
    if (column.hours) return formatHours(value)
    if (column.percent) return `${value ?? 0}%`
    return value ?? '—'
  }

  return (
    <div className="page">
      <PageHeader title="Reports" description="Hours, event and participation reports for the organizations you manage, ready to download as CSV." />

      <div className="segmented" role="group" aria-label="Report">
        {Object.entries(REPORTS).map(([key, r]) => (
          <button key={key} type="button" aria-pressed={type === key} onClick={() => chooseReport(key)}>{r.label}</button>
        ))}
      </div>

      <section className="panel" aria-labelledby="report-title">
        <div className="panel-header report-header">
          <div>
            <h2 id="report-title">{report.label}</h2>
            <p className="muted report-desc">{report.description}</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={loading || rows.length === 0}>
            <Icon name="download" size={15} /> Export CSV
          </button>
        </div>
        <div className="panel-filters">
          <DateRangeForm
            label={report.rangeLabel}
            value={range}
            onApply={setRange}
            disabled={loading}
          />
        </div>

        {error && <div className="panel-body"><Alert onRetry={load}>{error}</Alert></div>}

        {loading ? (
          <LoadingState label="Generating report…" />
        ) : rows.length === 0 ? (
          !error && (
            <EmptyState icon="file-text" title="No data for this period">
              {report.empty}
            </EmptyState>
          )
        ) : (
          <>
            <p className="report-meta">
              {periodLabel} · {report.count(rows.length)}
            </p>
            <div className="table-wrap">
              <table className="table table-stack">
                <thead>
                  <tr>
                    {report.columns.map((c) => <th key={c.key} className={c.num ? 'cell-num' : undefined}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={report.rowKey(row)}>
                      {report.columns.map((c, i) => (
                        <td key={c.key} data-label={c.label} className={[c.num && 'cell-num', i === 0 && 'cell-lead'].filter(Boolean).join(' ') || undefined}>
                          {i === 0 ? <span className="cell-primary">{renderCell(c, row)}</span> : renderCell(c, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    {report.columns.map((c, i) => (
                      <td key={c.key} data-label={c.hours ? c.label : ''} className={c.num ? 'cell-num' : undefined}>
                        {i === 0 ? 'Total' : c.hours ? formatHours(totals[c.key]) : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default Reports
