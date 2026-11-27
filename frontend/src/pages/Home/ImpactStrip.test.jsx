import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ImpactStrip from './ImpactStrip'
import { getImpactApi } from '../../services/api'

vi.mock('../../services/api')

describe('Home impact numbers', () => {
  it('shows the platform totals', async () => {
    getImpactApi.mockResolvedValue({
      data: { impact: { verified_hours: 1234.5, volunteers: 12, organizations: 4, events_completed: 8, open_opportunities: 11 } },
    })
    render(<ImpactStrip />)
    expect(await screen.findByText('1,235')).toBeInTheDocument()
    expect(screen.getByText('Verified NGOs').nextSibling).toHaveTextContent('4')
    expect(screen.getByText(/11 opportunities are open/)).toBeInTheDocument()
  })

  it('stays hidden when there is nothing to show or the server is unreachable', async () => {
    getImpactApi.mockResolvedValue({ data: { impact: { verified_hours: 0, volunteers: 0, organizations: 0, events_completed: 0 } } })
    const { container } = render(<ImpactStrip />)
    await Promise.resolve()
    expect(container).toBeEmptyDOMElement()

    getImpactApi.mockRejectedValue(new Error('offline'))
    const second = render(<ImpactStrip />)
    await Promise.resolve()
    expect(second.container).toBeEmptyDOMElement()
  })
})
