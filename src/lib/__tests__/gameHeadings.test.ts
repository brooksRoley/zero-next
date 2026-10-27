import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// The 2026-10-20 polish audit found three game pages with no <h1>: the Pente
// and Go play pages and Luminous Flow. Every game the Theater stages must name
// itself in a heading — for screen readers, search snippets, and the recruiter
// who lands on a bare board. Each entry says which file renders that page's
// <h1>; a staged game missing from this map fails the suite.
const HEADING_SOURCE: Record<string, { file: string; pattern: RegExp }> = {
  pente: { file: 'src/pages/posts/pente.js', pattern: /<PenteTopNav[^>]*\bheading\b/ },
  pentePuzzles: { file: 'src/pages/posts/pente-puzzles.js', pattern: /<h1/ },
  go: { file: 'src/pages/posts/go/index.js', pattern: /<h1/ },
  goPuzzles: { file: 'src/pages/posts/go/puzzles/index.js', pattern: /<h1/ },
  passAndCut: { file: 'src/pages/games/pass-and-cut.tsx', pattern: /<h1/ },
  readAndReact: { file: 'src/pages/games/read-and-react.tsx', pattern: /<h1/ },
  moments: { file: 'src/pages/games/moments.tsx', pattern: /<h1/ },
  hardwood: { file: 'src/pages/games/hardwood.tsx', pattern: /<h1/ },
  tend: { file: 'src/pages/games/tend.tsx', pattern: /<h1/ },
  nanuPikaTd: { file: 'src/components/nanu-pika-td.jsx', pattern: /<h1/ },
  luminousFlow: { file: 'src/pages/posts/luminous-flow.jsx', pattern: /<h1/ },
}

// Theater links that are not productions.
const NOT_GAMES: string[] = []

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('every staged game has a heading', () => {
  const staged = [...new Set(
    [...read('src/pages/theater.tsx').matchAll(/route\('([a-zA-Z]+)'\)\.href/g)].map((m) => m[1]),
  )].filter((key) => !NOT_GAMES.includes(key))

  it('the Theater stages at least the known games', () => {
    expect(staged.length).toBeGreaterThanOrEqual(Object.keys(HEADING_SOURCE).length)
  })

  it.each(staged)('%s declares where its <h1> lives', (key) => {
    expect(HEADING_SOURCE[key], `add ${key} to HEADING_SOURCE`).toBeDefined()
  })

  it.each(Object.entries(HEADING_SOURCE))('%s renders an <h1>', (_key, { file, pattern }) => {
    expect(read(file)).toMatch(pattern)
  })

  it('the shared Pente nav renders its label as an <h1> only when asked', () => {
    const nav = read('src/components/pente/PenteTopNav.jsx')
    expect(nav).toMatch(/const Label = heading \? 'h1' : 'span'/)
  })
})
