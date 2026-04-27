// src/hooks/__tests__/useMatchmaking.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('src/lib/supabase', () => {
  const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
  const mockOn = vi.fn().mockReturnValue({ subscribe: mockSubscribe })
  return {
    supabase: {
      channel: vi.fn().mockReturnValue({ on: mockOn }),
      removeChannel: vi.fn(),
      from: vi.fn(),
      rpc: vi.fn(),
    },
  }
})

import useMatchmaking from '../useMatchmaking'
import { supabase } from 'src/lib/supabase'

describe('useMatchmaking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: from() returns chainable mock for select/insert/update
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'queue-row-1' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })
  })

  it('starts in idle status', () => {
    const { result } = renderHook(() =>
      useMatchmaking('player-1', 'Alice', 800)
    )
    expect(result.current.queueStatus).toBe('idle')
    expect(result.current.opponent).toBeNull()
    expect(result.current.matchedGameId).toBeNull()
  })

  it('exposes enterQueue and leaveQueue functions', () => {
    const { result } = renderHook(() =>
      useMatchmaking('player-1', 'Alice', 800)
    )
    expect(typeof result.current.enterQueue).toBe('function')
    expect(typeof result.current.leaveQueue).toBe('function')
    expect(typeof result.current.acceptMatch).toBe('function')
    expect(typeof result.current.declineMatch).toBe('function')
  })
})
