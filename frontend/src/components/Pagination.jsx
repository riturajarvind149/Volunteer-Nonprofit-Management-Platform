import Icon from './Icon'

/**
 * Previous / next pager for server-paginated lists.
 * @param {{ pagination: {page: number, total_pages: number, total: number} | null, onPage: (page: number) => void, disabled?: boolean, noun?: string }} props
 */
function Pagination({ pagination, onPage, disabled = false, noun = 'results' }) {
  if (!pagination || pagination.total_pages <= 1) return null
  const { page, total_pages: totalPages, total } = pagination
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={disabled || page <= 1}>
        <Icon name="arrow-left" size={14} /> Previous
      </button>
      <span className="pagination-status" aria-live="polite">
        Page {page} of {totalPages} · {total} {noun}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={disabled || page >= totalPages}>
        Next <Icon name="arrow-right" size={14} />
      </button>
    </nav>
  )
}

export default Pagination
