import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// 2026-11-03: the resume page sat on a fan wallpaper of a game franchise
// (covertitle.jpg) with a "?" block easter egg and a mushroom. The site now uses
// only Brooks's own imagery: his logos, his mascot, his photos.
const ROOT = process.cwd()

function files(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(rel)
    return /\.(jsx?|tsx?|css)$/.test(e.name) ? [rel] : []
  })
}

const UI = [...files('src/pages'), ...files('src/components'), ...files('src/styles')]

describe('site art is our own', () => {
  it('no longer ships the borrowed wallpaper', () => {
    expect(fs.existsSync(path.join(ROOT, 'public/covertitle.jpg'))).toBe(false)
    expect(UI.filter((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('covertitle'))).toEqual([])
  })

  it('has no franchise easter egg left in the UI', () => {
    const hits = UI.filter((f) => /MarioButton|mario-jump|🍄/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    expect(hits).toEqual([])
  })

  it('gives the resume page an absolute share image (the site default)', () => {
    expect(fs.readFileSync(path.join(ROOT, 'src/pages/resume.js'), 'utf8')).not.toMatch(/og:image" content="\//)
  })
})
