import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// The Go board draws its horizontal grid lines with .board-cell::before, a
// selector it shares with Pente's GameBoard.css, which gives it `width: 3px`
// for the intersection dot. Go set left/right but not width, so the width won
// and every horizontal line rendered as a 3px dash: on the puzzle pages the
// board read as scattered tick marks and visitors left without placing a stone.
describe('Go board grid lines', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/GoBoard.css'), 'utf8')

  function rule(selectorEnd: string): string {
    const start = css.indexOf(`.go-board .board-cell:not(.black):not(.white):not(.red):not(.blue)${selectorEnd} {`)
    expect(start).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('}', start))
  }

  it('horizontal line overrides the inherited dot width', () => {
    const h = rule('::before')
    expect(h).toMatch(/left:\s*0;/)
    expect(h).toMatch(/right:\s*0;/)
    expect(h).toMatch(/width:\s*auto;/)
  })

  it('vertical line overrides the inherited preview inset', () => {
    const v = rule('::after')
    expect(v).toMatch(/top:\s*0;/)
    expect(v).toMatch(/bottom:\s*0;/)
    expect(v).toMatch(/width:\s*1px;/)
  })
})
