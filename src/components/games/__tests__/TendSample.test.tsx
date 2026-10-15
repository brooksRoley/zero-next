// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { STORAGE_KEY } from 'src/lib/games/tend/storage'
import { TIERS } from 'src/lib/games/tend/watershed'

const router = { isReady: true, query: {} as Record<string, string> }
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('src/lib/analytics', () => ({ trackGame: vi.fn() }))

const { default: TendPage } = await import('src/pages/games/tend')
const { default: WatershedPage } = await import('src/pages/games/tend/watershed')

/** Node ships its own localStorage that shadows jsdom's, so each test gets a fresh in-memory one. */
function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  }
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
  router.query = {}
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Tend sample mode (?sample=1)', () => {
  it('shows a read-only garden and never writes to browser storage', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    router.query = { sample: '1' }
    render(<TendPage />)

    expect(screen.getByRole('status').textContent).toMatch(/sample garden on day 40/)
    expect(screen.getByText('Forty days in')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Check in/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Start over/ })).toBeNull()
    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([])
  })

  it('leaves a real garden untouched', () => {
    window.localStorage.setItem(STORAGE_KEY, 'existing')
    router.query = { sample: '1' }
    render(<TendPage />)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('existing')
  })

  it('offers the sample to a first-time visitor, who still gets their own garden saved', () => {
    render(<TendPage />)
    expect(screen.getByRole('link', { name: /Peek at a sample garden on day 40/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Check in/ })).toBeTruthy()
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('carries sample mode across the shared nav', () => {
    router.query = { sample: '1' }
    render(<TendPage />)
    const nav = screen.getByRole('navigation', { name: 'Tend' })
    const watershed = Array.from(nav.querySelectorAll('a')).find((a) => a.textContent === 'Watershed')
    expect(watershed?.getAttribute('href')).toBe('/games/tend/watershed?sample=1')
  })
})

describe('the Watershed is readable without a garden', () => {
  it('opens the deepest tier for a visitor with nothing collected', () => {
    render(<WatershedPage />)
    const deep = TIERS.at(-1)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${deep.name}`) }))
    expect(screen.getByText(/Not in your collection yet/)).toBeTruthy()
    expect(screen.getByText(deep.lesson.title)).toBeTruthy()
    expect(screen.getAllByText(deep.residents[0].name, { exact: false }).length).toBeGreaterThan(0)
  })

  it('shows every tier collected in sample mode', () => {
    router.query = { sample: '1' }
    render(<WatershedPage />)
    expect(screen.queryByText(/Not in your collection yet/)).toBeNull()
    expect(screen.queryAllByRole('button', { name: /not collected yet/ })).toEqual([])
  })
})

describe('the Journal', () => {
  it('opens every chapter for a visitor, marking what the sample has collected', async () => {
    const { default: JournalPage } = await import('src/pages/games/tend/journal')
    router.query = { sample: '1' }
    render(<JournalPage />)
    expect(screen.getByText('Sweet almond')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Adapted/ }))
    expect(screen.getByText('Sea otter fur')).toBeTruthy()
    expect(screen.getAllByText(/· Collected/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: /Ripples/ }))
    expect(screen.getByText('Urchin barren: a stable state')).toBeTruthy()
  })
})

describe('analytics stay meaningful', () => {
  it('counts a Journal chapter once, when the reader opens it', async () => {
    const { trackGame } = await import('src/lib/analytics')
    const { default: JournalPage } = await import('src/pages/games/tend/journal')
    vi.mocked(trackGame).mockClear()
    render(<JournalPage />)
    expect(trackGame).not.toHaveBeenCalled()
    const tab = screen.getByRole('tab', { name: /Adapted/ })
    fireEvent.click(tab)
    fireEvent.click(tab)
    expect(trackGame).toHaveBeenCalledTimes(1)
  })
})
