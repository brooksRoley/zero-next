import { describe, it, expect } from 'vitest'
import {
  FOREST, MAP_TEMPLATES, ROAD, advance, createGame, generateMap, placeTower, sRng, startWave, stepGame, validatePath,
  type GameState,
} from '../engine'
import { headroom } from '../bot'
import {
  LEVELS, currentLevelIndex, emptyProgress, isUnlocked, loadProgress, parseProgress, recordVictory, saveProgress,
  starsFor, totalStars, PROGRESS_KEY,
} from '../campaign'

describe('maps', () => {
  // Spiral, Diamond and U-Turn used to cross or double back on themselves, and
  // the path builder skipped revisited cells, so ants jumped two tiles.
  it.each(LEVELS.map((l, i) => [i + 1, l] as const))('level %i has a playable road both ways up', (_n, level) => {
    for (const tall of [false, true]) {
      const map = generateMap(level.template, level.cols, level.rows, tall)
      expect(validatePath(map.path, map.cols, map.rows), `${level.id} tall=${tall}`).toBeNull()
      for (const p of map.path) expect(map.grid[p.row][p.col]).toBe(ROAD)
    }
  })

  it.each(MAP_TEMPLATES.map((t) => t.id))('%s is valid at every campaign size', (id) => {
    for (const [cols, rows] of [[12, 8], [14, 8], [16, 8], [18, 9], [20, 8]]) {
      const map = generateMap(id, cols, rows)
      expect(validatePath(map.path, map.cols, map.rows), `${id} ${cols}x${rows}`).toBeNull()
    }
  })

  it('the tall board is the landscape board transposed', () => {
    const land = generateMap('zigzag', 14, 8)
    const tall = generateMap('zigzag', 14, 8, true)
    expect([tall.cols, tall.rows]).toEqual([8, 14])
    expect(tall.path).toEqual(land.path.map(({ row, col }) => ({ row: col, col: row })))
    for (let r = 0; r < land.rows; r++) for (let c = 0; c < land.cols; c++) expect(tall.grid[c][r]).toBe(land.grid[r][c])
  })

  it('rejects a road that jumps, revisits, or touches itself', () => {
    expect(validatePath([{ row: 0, col: 0 }, { row: 0, col: 2 }], 5, 5)).toMatch(/jump/)
    expect(validatePath([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 0 }], 5, 5)).toMatch(/revisits/)
    const hairpin = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }, { row: 1, col: 1 }]
    expect(validatePath(hairpin, 5, 5)).toMatch(/touches/)
  })
})

describe('the rules do not depend on which way up the board is', () => {
  function play(tall: boolean): GameState {
    const level = LEVELS[2]
    const land = generateMap(level.template, level.cols, level.rows)
    const g = createGame(generateMap(level.template, level.cols, level.rows, tall), level, sRng(7))
    // The same towers on the same tiles, transposed for the tall board: the
    // first open forest tiles beside the road, an Apprentice, an Apprentice, a Pyromancer.
    const spots = land.path.flatMap(({ row, col }) => [[row + 1, col], [row - 1, col]])
      .filter(([r, c]) => land.grid[r]?.[c] === FOREST)
      .filter(([r, c], i, all) => all.findIndex(([r2, c2]) => r2 === r && c2 === c) === i)
    for (const [i, tier] of [0, 0, 1].entries()) {
      const [row, col] = spots[i * 4]
      expect(placeTower(g, tall ? col : row, tall ? row : col, tier)).not.toBeNull()
    }
    for (let wave = 0; wave < 3 && g.phase === 'prep'; wave++) {
      startWave(g)
      let event = null
      while (!event) event = stepGame(g, 16)
    }
    return g
  }

  it('the same defence on the transposed map plays out identically', () => {
    const land = play(false)
    const tall = play(true)
    expect({ lives: tall.lives, gold: tall.gold, score: tall.score, wave: tall.wave })
      .toEqual({ lives: land.lives, gold: land.gold, score: land.score, wave: land.wave })
  })
})

describe('difficulty rises level by level', () => {
  // Headroom: how much tougher the ants could be before a fixed greedy bot loses.
  // Measured, so a tweak to a level, a map or the ant scaling that breaks the
  // ladder fails here instead of in a player's hands.
  const measured = LEVELS.map((level) => headroom(level))

  it('every level leaves the bot less headroom than the one before', () => {
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i], `level ${i + 1} vs ${i}: ${measured.join(', ')}`).toBeLessThan(measured[i - 1])
    }
  })

  it('opens gently and ends past what the greedy bot can win', () => {
    expect(measured[0]).toBeGreaterThanOrEqual(2)
    expect(measured[measured.length - 1]).toBeLessThan(1)
  })
}, 120_000)

describe('frame rate does not change the outcome', () => {
  // The canvas advances by whatever a frame took, times the speed setting.
  // Unsliced, a 3× frame on a slow device (300 ms) lost games that 16 ms won.
  it.each([16, 100, 150, 300])('a %i ms frame plays out like 16 ms steps', (frameMs) => {
    const run = (step: (g: GameState) => void) => {
      const level = LEVELS[0]
      const g = createGame(generateMap(level.template, level.cols, level.rows), level, sRng(3))
      for (const [r, c] of [[5, 3], [5, 4], [2, 8], [3, 8], [5, 5]]) placeTower(g, r, c, 0)
      while (g.phase !== 'victory' && g.phase !== 'gameover') {
        startWave(g)
        while ((g.phase as string) === 'wave') step(g)
      }
      return { phase: g.phase, lives: g.lives, score: g.score }
    }
    expect(run((g) => advance(g, frameMs))).toEqual(run((g) => stepGame(g, 16)))
  })
})

describe('level 1 forgives a first-time player', () => {
  // A new player places a few towers and keeps pressing Start Wave without
  // spending again. A scripted run of exactly that lost level 1 at wave 5 in
  // headless Chrome, so the opener is now short and soft enough to survive it.
  it.each([1, 2, 3])('five Apprentices and no further spending clear it (seed %i)', (seed) => {
    const level = LEVELS[0]
    const map = generateMap(level.template, level.cols, level.rows)
    const g = createGame(map, level, sRng(seed))
    const spots: [number, number, number][] = []
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (map.grid[r][c] === FOREST) spots.push([r, c, map.path.filter((p) => Math.hypot(p.row - r, p.col - c) <= 2).length])
      }
    }
    spots.sort((a, b) => b[2] - a[2])
    for (const [r, c] of spots.slice(0, 5)) expect(placeTower(g, r, c, 0)).not.toBeNull()
    let event = null
    while (event !== 'victory' && event !== 'gameover') {
      startWave(g)
      event = null
      while (!event) event = stepGame(g, 16)
    }
    expect(event).toBe('victory')
  })
})

describe('progress', () => {
  it('starts at level 1 with only level 1 open', () => {
    const p = emptyProgress()
    expect(currentLevelIndex(p)).toBe(0)
    expect(isUnlocked(p, 0)).toBe(true)
    expect(isUnlocked(p, 1)).toBe(false)
  })

  it('a win unlocks the next level and moves "continue" on', () => {
    const p = recordVictory(emptyProgress(), LEVELS[0].id, 15, 15, 900)
    expect(isUnlocked(p, 1)).toBe(true)
    expect(isUnlocked(p, 2)).toBe(false)
    expect(currentLevelIndex(p)).toBe(1)
  })

  it('stars: 80% of lives for three, 40% for two, any win for one', () => {
    expect(starsFor(12, 15)).toBe(3)
    expect(starsFor(11, 15)).toBe(2)
    expect(starsFor(6, 15)).toBe(2)
    expect(starsFor(5, 15)).toBe(1)
  })

  it('a replay keeps the best stars and score', () => {
    let p = recordVictory(emptyProgress(), LEVELS[0].id, 15, 15, 900)
    p = recordVictory(p, LEVELS[0].id, 3, 15, 1200)
    expect(p.cleared[LEVELS[0].id]).toEqual({ stars: 3, bestScore: 1200 })
    expect(totalStars(p)).toBe(3)
  })

  it('reports every level cleared once the last one is won', () => {
    let p = emptyProgress()
    for (const l of LEVELS) p = recordVictory(p, l.id, 1, l.lives, 1)
    expect(currentLevelIndex(p)).toBe(LEVELS.length)
  })

  it('round-trips through storage and survives a corrupted save', () => {
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
    const p = recordVictory(emptyProgress(), LEVELS[0].id, 10, 15, 500)
    saveProgress(storage, p)
    expect(loadProgress(storage)).toEqual(p)

    map.set(PROGRESS_KEY, '{not json')
    expect(loadProgress(storage)).toEqual(emptyProgress())
    expect(loadProgress(null)).toEqual(emptyProgress())
  })

  it('drops unknown levels and malformed records from a save', () => {
    const parsed = parseProgress({
      version: 1,
      cleared: { [LEVELS[0].id]: { stars: 2, bestScore: 10 }, 'no-such-level': { stars: 3, bestScore: 1 }, [LEVELS[1].id]: { stars: 9 } },
    })
    expect(parsed.cleared).toEqual({ [LEVELS[0].id]: { stars: 2, bestScore: 10 } })
  })
})
