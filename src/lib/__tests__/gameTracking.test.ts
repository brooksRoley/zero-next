import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { GAME_EVENTS, createGameTracker } from 'src/lib/analytics'

function setup() {
  const emit = vi.fn()
  let clock = 1_000
  const tracker = createGameTracker('go', emit, () => clock)
  return { emit, tracker, advance: (ms: number) => { clock += ms } }
}

describe('createGameTracker', () => {
  it('does not count a board nobody played on', () => {
    const { emit, tracker } = setup()
    tracker.update({ moveCount: 0, finished: false })
    expect(emit).not.toHaveBeenCalled()
  })

  it('fires game_start once, on the first move', () => {
    const { emit, tracker } = setup()
    tracker.update({ moveCount: 1, finished: false }, { start: () => ({ size: 9 }) })
    tracker.update({ moveCount: 2, finished: false })
    tracker.update({ moveCount: 3, finished: false })
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('game_start', 'go', { size: 9 })
  })

  it('fires game_end once, with the move count and duration', () => {
    const { emit, tracker, advance } = setup()
    tracker.update({ moveCount: 1, finished: false })
    advance(42_000)
    tracker.update({ moveCount: 30, finished: true }, { end: () => ({ result: 'win' }) })
    tracker.update({ moveCount: 30, finished: true }, { end: () => ({ result: 'win' }) })
    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenLastCalledWith('game_end', 'go', { result: 'win', moves: 30, duration_ms: 42_000 })
  })

  it('ignores a finish with no moves played', () => {
    const { emit, tracker } = setup()
    tracker.update({ moveCount: 0, finished: true })
    expect(emit).not.toHaveBeenCalled()
  })

  it('re-arms on a fresh board so the next game is counted too', () => {
    const { emit, tracker } = setup()
    tracker.update({ moveCount: 1, finished: false })
    tracker.update({ moveCount: 9, finished: true })
    tracker.update({ moveCount: 0, finished: false })
    tracker.update({ moveCount: 1, finished: false })
    tracker.update({ moveCount: 5, finished: true })
    expect(emit.mock.calls.map((call) => call[0])).toEqual(['game_start', 'game_end', 'game_start', 'game_end'])
  })
})

// The Go pages had zero analytics calls for a month while briefs re-flagged it.
// Every game surface must fire at least one event from the shared vocabulary.
// Hardwood is not in this list because its game code is not in this repo: it
// is a vendored BballTactics build in public/hardwood/, checked separately below.
describe('every game surface is instrumented', () => {
  const SURFACES = [
    'src/pages/posts/go/index.js',
    'src/pages/posts/go/learn/[stage].js',
    'src/pages/posts/go/puzzles/[id].js',
    'src/pages/posts/pente.js',
    'src/pages/posts/pente-puzzles.js',
    'src/pages/games/pass-and-cut.tsx',
    'src/pages/games/read-and-react.tsx',
    'src/pages/games/moments.tsx',
    'src/pages/games/tend.tsx',
    'src/pages/games/tend/watershed.tsx',
    'src/pages/games/tend/journal.tsx',
    // The page is a thin shell; the game state, and so the tracking, lives here.
    'src/components/nanu-pika-td.jsx',
  ]

  it.each(SURFACES)('%s uses trackGame or useGameTracking', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    expect(source).toMatch(/trackGame\(|useGameTracking\(/)
  })

  // Hardwood is a built bundle (BballTactics client/game/telemetry.js) served
  // same-origin at /hardwood/. Its game_start / game_end must reach /api/events
  // under the slug 'hardwood' and the same visitor ids as analytics.ts, or a
  // rebuild from an older source would silently stop counting runs.
  it('the vendored Hardwood bundle fires game_start and game_end', () => {
    const dir = path.join(process.cwd(), 'public/hardwood')
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
    const entry = html.match(/src="\/hardwood\/(assets\/index-[^"]+\.js)"/)
    expect(entry).not.toBeNull()
    const bundle = fs.readFileSync(path.join(dir, entry![1]), 'utf8')
    for (const needle of ['game_start', 'game_end', '/api/events', '"hardwood"', 'br_session_id', 'br_anon_id']) {
      expect(bundle).toContain(needle)
    }
  })

  it('keeps the vocabulary small and stable', () => {
    expect([...GAME_EVENTS]).toEqual([
      'game_start', 'game_end', 'puzzle_start', 'puzzle_solved', 'puzzle_failed', 'tutorial_stage_complete',
    ])
  })
})
