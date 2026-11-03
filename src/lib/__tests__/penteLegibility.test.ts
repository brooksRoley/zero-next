import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Pente on a phone (2026-11-02): the goal line lives in the nav and is hidden
// below md, the header's action row ran 200px past a 390px screen (New and
// Rules unreachable), and small labels used ink-500/600, which measure 3.05:1
// and 1.55:1 on ink-950. WCAG AA needs 4.5:1 for small text; ink-400 is 5.13:1.
const ROOT = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const PENTE_FILES = [
  'src/pages/posts/pente.js',
  ...fs.readdirSync(path.join(ROOT, 'src/components/pente'))
    .filter((f) => /\.(jsx?|tsx?)$/.test(f))
    .map((f) => `src/components/pente/${f}`),
]

describe('pente legibility', () => {
  it('tells a first-time player what to do on every screen size', () => {
    const page = read('src/pages/posts/pente.js')
    expect(page).toContain('data-testid="pente-first-move"')
    const hint = page.slice(page.indexOf('data-testid="pente-first-move"') - 200, page.indexOf('data-testid="pente-first-move"'))
    expect(hint).not.toMatch(/hidden (sm|md|lg):block/)
  })

  it('lets the header row wrap so the action buttons stay on a phone screen', () => {
    expect(read('src/pages/posts/pente.js')).toContain('flex flex-wrap items-center gap-2 px-3 pt-2.5 pb-1.5')
  })

  it.each(PENTE_FILES)('uses no text colour below AA contrast in %s', (file) => {
    // Disabled and placeholder states are exempt from WCAG contrast.
    const plain = read(file).match(/(?<![:\w-])text-ink-(500|600)(?![/\d])/g) ?? []
    expect(plain).toEqual([])
  })
})

describe('pente turn line', () => {
  // "Black's turn #6 d1 40n" read as debug output to a first-time player.
  it('shows engine search stats only while the Tutor is on', () => {
    expect(read('src/components/pente/TurnStatusBar.jsx')).toMatch(/showEngineStats && lastBotStats/)
    expect(read('src/pages/posts/pente.js')).toContain('showEngineStats={tutorEnabled}')
  })
})

describe('pente puzzles page', () => {
  // Same family as the play page (2026-11-03): the quiet backdrop and pill tabs.
  it('uses the zen backdrop, not the old SolarField', () => {
    const page = read('src/pages/posts/pente-puzzles.js')
    expect(page).toContain('<StillField')
    expect(page).not.toContain('SolarField')
    expect(page).toContain('terrain-page-bg')
  })
})
