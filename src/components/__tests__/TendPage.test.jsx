// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

vi.mock('next/head', () => ({ __esModule: true, default: () => null }))
vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {} }) }))
const trackGame = vi.fn()
vi.mock('src/lib/analytics', () => ({ trackGame: (...args) => trackGame(...args) }))

const sounds = vi.hoisted(() => ({
  place: vi.fn(),
  rotate: vi.fn(),
  refuse: vi.fn(),
  compost: vi.fn(),
  checkIn: vi.fn(),
  bloom: vi.fn(),
  pet: vi.fn(),
}))
vi.mock('src/lib/games/tend/sounds', () => ({ tendSounds: sounds }))

import TendPage from 'src/pages/games/tend'
import { STORAGE_KEY } from 'src/lib/games/tend/storage'

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

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true })
  trackGame.mockClear()
  Object.values(sounds).forEach((fn) => fn.mockClear())
})
afterEach(cleanup)

function soil(container) {
  // The first gardenSize² rects in the board are the soil cells, row by row.
  return container.querySelectorAll('svg.block > rect')
}

describe('Tend page', () => {
  it('checks in, earns seeds, and plants one with a click', async () => {
    const { container } = render(<TendPage />)
    await screen.findByText('Today')

    fireEvent.click(screen.getByRole('button', { name: /Joy: did something purely for fun/ }))
    fireEvent.click(screen.getByRole('button', { name: /Body: trained/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Check in: 2 seeds' }))

    expect(trackGame).toHaveBeenCalledWith('game_start', 'tend', { habits: 2 })
    const tray = screen.getByRole('heading', { name: 'Seeds to plant' }).parentElement
    expect(within(tray).getByRole('button', { name: 'Coast live oak' })).toBeTruthy()

    // The oak is selected first (lane order); plant it at the top-left cell.
    const cells = soil(container)
    fireEvent.pointerEnter(cells[0])
    fireEvent.click(cells[0])

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(saved.beds).toHaveLength(1)
    expect(saved.beds[0].kind).toBe('oak')
    expect(saved.seeds.map((s) => s.kind)).toEqual(['sunflower'])
  })

  it('answers every action: a note on check-in, a thump on planting, and a reason when a spot does not fit', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    const { container } = render(<TendPage />)
    await screen.findByText('Today')

    fireEvent.click(screen.getByRole('button', { name: /Body: trained/ }))
    fireEvent.click(screen.getByRole('button', { name: /Joy: did something purely for fun/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Check in: 2 seeds' }))
    expect(sounds.checkIn).toHaveBeenCalledWith(2)

    const cells = soil(container)
    fireEvent.pointerEnter(cells[0])
    fireEvent.click(cells[0])
    expect(sounds.place).toHaveBeenCalledWith('oak')
    expect(vibrate).toHaveBeenCalled()

    // The poppy is next; the top-left cell is under the oak now.
    fireEvent.pointerEnter(cells[0])
    fireEvent.click(cells[0])
    expect(sounds.refuse).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/doesn't fit, overlaps the coast live oak/)).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).beds).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Compost' }))
    expect(sounds.compost).toHaveBeenCalledTimes(1)
  })

  it('an empty check-in is allowed and leaves nothing to plant', async () => {
    render(<TendPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Check in: nothing today' }))
    expect(screen.getByRole('heading', { name: 'All planted' })).toBeTruthy()
  })

  it('starts fresh from a corrupted save instead of crashing', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{"version":1,"beds":"oops"}')
    render(<TendPage />)
    expect(await screen.findByText('Today')).toBeTruthy()
  })
})
