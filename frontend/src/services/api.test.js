import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMeApi, loginApi, setSessionExpiredHandler, onServerSlowChange, ApiError } from './api'

const mockFetch = (status, body) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  )

afterEach(() => {
  vi.restoreAllMocks()
  setSessionExpiredHandler(null)
})

describe('API client', () => {
  it('throws ApiError with status and backend code', async () => {
    mockFetch(403, { status: 'error', message: 'Please verify your email', code: 'EMAIL_NOT_VERIFIED' })
    const error = await loginApi({ email: 'a@b.co', password: 'x' }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.code).toBe('EMAIL_NOT_VERIFIED')
    expect(error.message).toBe('Please verify your email')
  })

  it('calls the session-expired handler when an authenticated request gets 401', async () => {
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    mockFetch(401, { status: 'error', message: 'Session has been revoked', code: 'SESSION_REVOKED' })

    await expect(getMeApi('old-token')).rejects.toThrow('Session has been revoked')
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_REVOKED' }))
  })

  it('does not treat a failed sign-in (no token sent) as an expired session', async () => {
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    mockFetch(401, { status: 'error', message: 'Invalid email or password' })

    await expect(loginApi({ email: 'a@b.co', password: 'x' })).rejects.toThrow('Invalid email or password')
    expect(handler).not.toHaveBeenCalled()
  })

  it('turns network failures into a readable error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await getMeApi('t').catch((e) => e)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Can’t reach the server/)
  })

  it('reports a slow server after 5 seconds and clears it when the response arrives', async () => {
    vi.useFakeTimers()
    try {
      let respond
      vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((resolve) => { respond = resolve }))
      const changes = []
      const unsubscribe = onServerSlowChange((slow) => changes.push(slow))

      const request = getMeApi('token')
      await vi.advanceTimersByTimeAsync(4900)
      expect(changes).toEqual([])
      await vi.advanceTimersByTimeAsync(200)
      expect(changes).toEqual([true])

      respond(new Response(JSON.stringify({ data: {} }), { status: 200 }))
      await request
      expect(changes).toEqual([true, false])
      unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not report fast responses as slow', async () => {
    vi.useFakeTimers()
    try {
      mockFetch(200, { data: {} })
      const changes = []
      const unsubscribe = onServerSlowChange((slow) => changes.push(slow))
      await getMeApi('token')
      await vi.advanceTimersByTimeAsync(10_000)
      expect(changes).toEqual([])
      unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })
})
