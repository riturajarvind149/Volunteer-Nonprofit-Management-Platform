import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import ServerWakeNotice from './ServerWakeNotice'
import { onServerSlowChange } from '../services/api'

vi.mock('../services/api', () => {
  const listeners = new Set()
  return {
    onServerSlowChange: vi.fn((listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    __emit: (value) => listeners.forEach((l) => l(value)),
  }
})

describe('ServerWakeNotice', () => {
  it('appears while the server is slow and disappears when it answers', async () => {
    const api = await import('../services/api')
    render(<ServerWakeNotice />)
    expect(onServerSlowChange).toHaveBeenCalled()
    expect(screen.queryByText(/Starting up the server/)).not.toBeInTheDocument()

    act(() => api.__emit(true))
    expect(screen.getByRole('status')).toHaveTextContent('Starting up the server')

    act(() => api.__emit(false))
    expect(screen.queryByText(/Starting up the server/)).not.toBeInTheDocument()
  })
})
