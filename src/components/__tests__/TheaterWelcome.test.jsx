// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

vi.mock('next/head', () => ({ __esModule: true, default: () => null }))
const track = vi.fn()
vi.mock('src/lib/analytics', () => ({ track: (...args) => track(...args) }))

import Theater from 'src/pages/theater'
import { JOURNAL_KEY, emptyJournal, loadJournal, recordGameEvent } from 'src/lib/playJournal'
import { emptyProgress, recordVictory, LEVELS } from 'src/lib/games/nanupika/campaign'

// A plain in-memory Storage: this jsdom build does not provide a usable localStorage.
function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  }
}

describe('the Theater greets returning players', () => {
  let storage
  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    track.mockClear()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('a first visit sees the Theater unchanged and leaves no journal behind', () => {
    render(<Theater />)
    expect(screen.queryByRole('region', { name: 'Welcome back' })).toBeNull()
    expect(screen.queryByText(/Back to your seat/)).toBeNull()
    expect(storage.getItem(JOURNAL_KEY)).toBeNull()
    expect(storage.getItem('zero_narrator_v1')).toBeNull()
    expect(track).not.toHaveBeenCalledWith('theater_welcome', expect.anything())
  })

  it('a returning player gets a welcome, their next level, and progress on the card', async () => {
    const then = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const journal = recordGameEvent(emptyJournal(then), 'game_end', 'nanu-pika-td', { result: 'win' }, then)
    storage.setItem(JOURNAL_KEY, JSON.stringify(journal))
    storage.setItem('nanupika_campaign_v1', JSON.stringify(recordVictory(emptyProgress(), LEVELS[0].id, 15, 15, 900)))

    render(<Theater />)
    const panel = await screen.findByRole('region', { name: 'Welcome back' })
    expect(within(panel).getByText('Welcome back — it’s been 3 days.')).toBeTruthy()
    expect(within(panel).getByText(`${LEVELS[1].name} is waiting — Level 2 of ${LEVELS.length}.`)).toBeTruthy()
    expect(screen.getByText(`Level 2 of ${LEVELS.length} · 3★`)).toBeTruthy()
    // The house narrator speaks once, and remembers what it said.
    expect(within(panel).getByText(/From the house:/)).toBeTruthy()
    expect(JSON.parse(storage.getItem('zero_narrator_v1'))).toHaveLength(1)
    expect(track).toHaveBeenCalledWith('theater_welcome', expect.objectContaining({ metadata: expect.objectContaining({ days_away: 3 }) }))

    // The visit moves the journal's clock, so the next welcome counts from today.
    expect(new Date(loadJournal(storage).lastActive).toDateString()).toBe(new Date().toDateString())
  })
})
