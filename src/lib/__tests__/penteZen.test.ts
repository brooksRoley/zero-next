import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { BOARD_THEMES, DEFAULT_BOARD_PREFS, sanitizeBoardPrefs } from 'src/lib/pente/boardThemes'

// Pente's quiet restyle (2026-11-03): the play page takes the home page's
// terrain, a calm default board, and a backdrop that stays still when asked.
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

describe('pente zen', () => {
  it('defaults to the Mist board, matte stones and calm motion', () => {
    expect(DEFAULT_BOARD_PREFS).toEqual({ theme: 'mist', stones: 'matte', effects: 'calm' })
    expect(BOARD_THEMES[0].key).toBe('mist')
    expect(sanitizeBoardPrefs({ theme: 'walnut' }).theme).toBe('walnut')
    expect(read('src/styles/PenteThemes.css')).toContain(".game-board[data-theme='mist'] {")
  })

  it('plays on the home terrain with the still backdrop, not SolarField', () => {
    const page = read('src/pages/posts/pente.js')
    expect(page).toContain('terrain-page-bg')
    expect(page).toContain('<StillField')
    expect(page).not.toContain('SolarField')
  })

  it('labels header controls with words, not emoji', () => {
    const page = read('src/pages/posts/pente.js')
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(page).toContain('>\n              Style\n')
    expect(page).toContain('>\n              Rules\n')
  })

  it('keeps the backdrop still for reduced motion and idle when hidden', () => {
    const field = read('src/components/pente/StillField.jsx')
    expect(field).toContain('prefersReducedMotion()')
    expect(field).toContain("'(prefers-reduced-motion: reduce)'")
    expect(field).toContain('visibilitychange')
    expect(field.match(/<canvas/g)).toHaveLength(1)
  })
})
