import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CapacityMeter, StatusBadge } from './ui'

describe('CapacityMeter', () => {
  it('describes how many spots are filled', () => {
    render(<CapacityMeter taken={4} capacity={10} />)
    const meter = screen.getByRole('img', { name: '4 of 10 spots filled' })
    expect(meter).not.toHaveClass('meter-full')
    expect(meter.querySelector('span')).toHaveStyle({ width: '40%' })
  })

  it('marks the meter full at exact capacity', () => {
    render(<CapacityMeter taken={10} capacity={10} />)
    expect(screen.getByRole('img', { name: '10 of 10 spots filled' })).toHaveClass('meter-full')
  })

  it('never draws past 100% even if over capacity', () => {
    render(<CapacityMeter taken={12} capacity={10} />)
    expect(screen.getByRole('img').querySelector('span')).toHaveStyle({ width: '100%' })
  })

  it('renders nothing when capacity is missing', () => {
    const { container } = render(<CapacityMeter taken={2} capacity={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('StatusBadge', () => {
  it('shows a readable label with the right tone', () => {
    render(<StatusBadge status="PUBLISHED" />)
    expect(screen.getByText('Published')).toHaveClass('badge', 'badge-success')
  })

  it('renders nothing without a status', () => {
    const { container } = render(<StatusBadge />)
    expect(container).toBeEmptyDOMElement()
  })
})
