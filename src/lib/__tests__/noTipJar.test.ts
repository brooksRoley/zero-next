import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { UPDATES_CARD_ENABLED } from 'src/components/UpdatesCard'

// The tip jar was retired on 2026-10-23 (Brooks: "a little less beggy").
// These keep it from creeping back in through a page or an agent PR.
const ROOT = path.join(process.cwd(), 'src')
const SKIP = new Set(['__tests__', '__apiTests__'])

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return []
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : []
  })
}

const BEGGY = [
  /href=["'{]\/funding/,
  /route\('funding'\)/,
  /support (development|this work)/i,
  /tip the dev/i,
  /keep (it|them|the \w+) (free|lit|open)/i,
  /AI tokens/i,
  /buy (me )?a coffee/i,
]

describe('no tip jar', () => {
  it.each(sources(ROOT).map((p) => path.relative(process.cwd(), p)))('%s carries no ask for money', (file) => {
    const s = fs.readFileSync(file, 'utf8')
    for (const re of BEGGY) expect(s, `${file} matches ${re}`).not.toMatch(re)
  })

  it('/funding is not a page, it redirects home', () => {
    expect(fs.existsSync(path.join(ROOT, 'pages/funding.tsx'))).toBe(false)
    expect(fs.readFileSync('next.config.js', 'utf8')).toContain("source: '/funding', destination: '/'")
  })

  it('the updates card stays off until Brooks turns it on', () => {
    expect(UPDATES_CARD_ENABLED).toBe(false)
  })
})
