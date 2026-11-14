import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationOpportunitiesSummaryApi, getOrganizationHoursApi, getParticipationReportApi } from '../../services/api'
import Icon from '../../components/Icon'
import DateRangeForm from '../../components/DateRangeForm'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge } from '../../components/ui'
import { formatDate, formatHours, toInputDate, pluralize } from '../../utils/format'
import { toCsv } from '../../utils/csv'
import './Reports.css'

const REPORTS = {
  summary: {
    label: 'Hours by opportunity',
    description: 'Totals for each opportunity, counting hours logged in the selected period.',
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
  participation: {
    label: 'Volunteer participation',
    description: 'One row per volunteer: sign-ups, attendance and hours for events in the selected period.',
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
    label: 'Hours log',
    description: 'Every individual hour entry logged in the selected period.',
    columns: [
      { key: 'created_at', label: 'Logged on', date: true },
      { key: 'volunteer_name', label: 'Volunteer' },
      { key: 'volunteer_email', label: 'Email' },
      { key: 'opportunity_title', label: 'Opportunity' },
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

function inRange(value, { from_date, to_date }) {
  const day = toInputDate(value)
  return (!from_date || day >= from_date) && (!to_date || day <= to_date)
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
      if (type === 'summary') {
        const res = await getOrganizationOpportunitiesSummaryApi(token, range)
        setRows(res?.data?.opportunities || [])
      } else if (type === 'participation') {
        const res = await getParticipationReportApi(token, range)
        setRows(res?.data?.report || [])
      } else {
        const res = await getOrganizationHoursApi(token)
        setRows((res?.data?.volunteer_hours || []).filter((r) => inRange(r.created_at, range)))
      }
    } catch (err) {
      setError(err.message || 'The report could not be generated.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token, type, range])

  useEffect(() => { load() }, [load])

  const report = REPORTS[type]
  const hourColumns = report.columns.filter((c) => c.hours)
  const totals = Object.fromEntries(hourColumns.map((c) => [c.key, rows.reduce((sum, r) => sum + Number(r[c.key] || 0), 0)]))
  const periodLabel = range.from_date || range.to_date
    ? `${range.from_date ? formatDate(range.from_date) : 'the start'} – ${range.to_date ? formatDate(range.to_date) : 'today'}`
    : 'All time'

  const handleExport = () => {
    const suffix = [range.from_date, range.to_date].filter(Boolean).join('_to_') || 'all-time'
    const slug = { summary: 'hours-by-opportunity', participation: 'volunteer-participation', log: 'hours-log' }[type]
    downloadCsv(`servehub-${slug}-${suffix}.csv`, toCsv(report.columns, rows))
  }

  const renderCell = (column, row) => {
    const value = row[column.key]
    if (column.status) return <StatusBadge status={value} />
    if (column.date) return formatDate(value)
    if (column.hours) return formatHours(value)
    return value ?? '—'
  }

  return (
    <div className="page">
      <PageHeader title="Reports" description="Hours and participation reports for the organizations you manage, ready to download as CSV." />

      <div className="segmented" role="group" aria-label="Report">
        {Object.entries(REPORTS).map(([key, r]) => (
          <button key={key} type="button" aria-pressed={type === key} onClick={() => setType(key)}>{r.label}</button>
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
            label={type === 'participation' ? 'Events between' : 'Hours logged between'}
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
              {type === 'summary'
                ? 'You haven’t created any opportunities yet.'
                : type === 'participation'
                  ? 'No volunteers signed up for your events in the selected period.'
                  : 'No hours were logged in the selected period.'}
            </EmptyState>
          )
        ) : (
          <>
            <p className="report-meta">
              {periodLabel} · {type === 'summary'
                ? pluralize(rows.length, 'opportunity', 'opportunities')
                : type === 'participation'
                  ? pluralize(rows.length, 'volunteer')
                  : pluralize(rows.length, 'entry', 'entries')}
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
                    <tr key={row.id || row.opportunity_id}>
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
