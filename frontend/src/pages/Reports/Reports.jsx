import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getOrganizationOpportunitiesSummaryApi, getOrganizationHoursApi } from '../../services/api'
import Icon from '../../components/Icon'
import DateRangeForm from '../../components/DateRangeForm'
import { PageHeader, LoadingState, EmptyState, Alert, StatusBadge } from '../../components/ui'
import { formatDate, formatHours, toInputDate, pluralize } from '../../utils/format'
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

function toCsv(columns, rows) {
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [columns.map((c) => escape(c.label)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escape(c.date ? toInputDate(row[c.key]) : row[c.key])).join(','))
  }
  return lines.join('\n')
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
    downloadCsv(`servehub-${type === 'summary' ? 'hours-by-opportunity' : 'hours-log'}-${suffix}.csv`, toCsv(report.columns, rows))
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
      <PageHeader title="Reports" description="Volunteer hour reports for the organizations you manage, ready to download as CSV." />

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
          <DateRangeForm label="Hours logged between" value={range} onApply={setRange} disabled={loading} />
        </div>

        {error && <div className="panel-body"><Alert onRetry={load}>{error}</Alert></div>}

        {loading ? (
          <LoadingState label="Generating report…" />
        ) : rows.length === 0 ? (
          !error && (
            <EmptyState icon="file-text" title="No data for this period">
              {type === 'summary' ? 'You haven’t created any opportunities yet.' : 'No hours were logged in the selected period.'}
            </EmptyState>
          )
        ) : (
          <>
            <p className="report-meta">{periodLabel} · {pluralize(rows.length, type === 'summary' ? 'opportunity' : 'entry', type === 'summary' ? 'opportunities' : 'entries')}</p>
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
