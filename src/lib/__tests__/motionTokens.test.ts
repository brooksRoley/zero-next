import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { DURATION, EASING } from 'src/lib/ui/tactile'

// The house motion vocabulary (docs/ART_DIRECTION.md, "Motion vocabulary").
// Before 2026-10-28 the site carried eight hand-written easing curves and
// covered reduced motion in 14 of 78 animated files. These keep one source.
const ROOT = path.join(process.cwd(), 'src')
const GLOBALS = path.join(ROOT, 'styles', 'globals.css')
const SKIP = new Set(['__tests__', '__apiTests__'])

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return []
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return sources(p)
    return /\.(css|tsx?|jsx?)$/.test(e.name) ? [p] : []
  })
}

const globals = fs.readFileSync(GLOBALS, 'utf8')

describe('motion vocabulary', () => {
  it('mirrors every EASING curve as a --ease-* variable in globals.css', () => {
    for (const [name, curve] of Object.entries(EASING)) {
      expect(globals).toContain(`--ease-${name}: ${curve};`)
    }
  })

  it('mirrors every DURATION as a --dur-* variable in globals.css', () => {
    for (const [name, ms] of Object.entries(DURATION)) {
      expect(globals).toContain(`--dur-${name}: ${ms}ms;`)
    }
  })

  it('writes no cubic-bezier outside the two token sources', () => {
    const allowed = new Set([GLOBALS, path.join(ROOT, 'lib', 'ui', 'tactile.js')])
    const offenders = sources(ROOT)
      .filter((f) => !allowed.has(f))
      .filter((f) => /cubic-bezier\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f))
    expect(offenders).toEqual([])
  })

  it('keeps the site-wide reduced-motion net', () => {
    const net = globals.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\*,[\s\S]*?\}\s*\}/)
    expect(net).not.toBeNull()
    expect(net![0]).toMatch(/animation-duration: 0\.01ms !important/)
    expect(net![0]).toMatch(/animation-iteration-count: 1 !important/)
    expect(net![0]).toMatch(/transition-duration: 0\.01ms !important/)
  })
})
