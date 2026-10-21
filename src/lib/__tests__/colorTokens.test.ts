import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// `text-candy-pink/60` was never a colour: the house palettes (tailwind.config.js)
// only have numbered shades, so Tailwind emitted nothing and the Pente bot's
// "calibrating" label and the board-skin picker's selected ring were invisible.
// A palette class must name a shade.
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sources(rel)
    return /\.(tsx?|jsx?)$/.test(e.name) ? [rel] : []
  })
}

describe('house palette classes name a real shade', () => {
  it('no forest/candy/void class without a numbered shade', () => {
    const bad: string[] = []
    const pattern = /\b(?:text|bg|border|ring|from|to|via|fill|stroke|shadow|outline|decoration|accent|caret|divide|placeholder)-(?:forest|candy|void)-(?!\d{2,3}\b)[a-z]+/g
    for (const file of sources('src')) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(pattern)) bad.push(`${file}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })
})
