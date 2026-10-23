// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import UpdatesCard from 'src/components/UpdatesCard'

vi.mock('src/lib/analytics', () => ({ track: vi.fn(), getAnonId: () => 'a', getSessionId: () => 's' }))

afterEach(cleanup)

describe('UpdatesCard', () => {
  it('renders nothing while switched off, even after a finished game', () => {
    const { container, rerender } = render(<UpdatesCard trigger={0} page="/posts/pente" />)
    rerender(<UpdatesCard trigger={1} page="/posts/pente" />)
    expect(container.innerHTML).toBe('')
  })
})
