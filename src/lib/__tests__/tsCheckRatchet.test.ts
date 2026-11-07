import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// JS/JSX files that still fail `tsc --checkJs`. This list may only shrink:
// fix a file, add `// @ts-check` to it, and delete it from here.
const UNCHECKED = new Set([
  'src/components/NavHeader.jsx',
  'src/components/Reveal.jsx',
  'src/lib/go/gameLogic.js',
  'src/lib/go/puzzles.js',
  'src/lib/go/sgf.js',
  'src/lib/pente/boardThemes.js',
  'src/lib/pente/constants.js',
  'src/lib/pente/dailyChallenge.js',
  'src/lib/pente/elo.js',
  'src/lib/pente/puzzleCalibration.js',
  'src/lib/pente/puzzles.js',
  'src/lib/ui/audioContext.js',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') walk(p, out)
    } else if (/\.jsx?$/.test(entry.name)) out.push(p)
  }
  return out
}

describe('ts-check ratchet', () => {
  const files = walk('src').map((f) => f.split(path.sep).join('/'))

  it('every JS/JSX file opts into type checking unless it is on the shrinking list', () => {
    const missing = files.filter(
      (f) => !UNCHECKED.has(f) && !fs.readFileSync(f, 'utf8').startsWith('// @ts-check'),
    )
    expect(missing).toEqual([])
  })

  it('the unchecked list has no stale entries', () => {
    const stale = [...UNCHECKED].filter(
      (f) => !files.includes(f) || fs.readFileSync(f, 'utf8').startsWith('// @ts-check'),
    )
    expect(stale).toEqual([])
  })
})
