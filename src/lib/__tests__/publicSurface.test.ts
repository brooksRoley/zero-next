import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { AVAILABILITY, HERO_SUMMARY, SITE_DESCRIPTION } from 'src/lib/resume'

// What a recruiter or a scanner sees first: the hero, the search snippet, the
// tab title, the GitHub README, and any API URL left lying around.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file: string) => fs.existsSync(path.join(ROOT, file))

function pageFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return ['api', 'admin', '__tests__'].includes(entry.name) ? [] : pageFiles(rel)
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [rel] : []
  })
}

// Unfinished or private pages that src/proxy.ts keeps behind the login.
const PRIVATE = ['login', 'tracker', 'zero-paradox', 'education-tracker', 'digital-products']

describe('hero and meta copy come from one place', () => {
  it('the hero and its loading fallback both render HERO_SUMMARY and AVAILABILITY', () => {
    for (const file of ['src/components/PhysicsHero.tsx', 'src/pages/index.tsx']) {
      const src = read(file)
      expect(src, file).toContain('{HERO_SUMMARY}')
      expect(src, file).toContain('{AVAILABILITY}')
    }
  })

  it('the home page states availability only through AVAILABILITY, not a second hand-written copy', () => {
    expect(read('src/pages/index.tsx')).not.toMatch(/Open to full-time/i)
  })

  it('the site-wide description and og:description use SITE_DESCRIPTION', () => {
    const app = read('src/pages/_app.tsx')
    expect(app).toMatch(/name="description" content=\{SITE_DESCRIPTION\}/)
    expect(app).toMatch(/property="og:description" content=\{SITE_DESCRIPTION\}/)
  })

  it('the description is short enough for a search snippet and says the job search', () => {
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(SITE_DESCRIPTION).toMatch(/full-time/)
    expect(HERO_SUMMARY.length).toBeGreaterThan(0)
    expect(AVAILABILITY).toMatch(/full-time/)
  })
})

describe('every public page title names Brooks Roley', () => {
  const files = pageFiles('src/pages').filter(
    (file) => !PRIVATE.some((name) => path.basename(file).startsWith(name)) && !/\/_(app|document)\./.test(file),
  )

  it.each(files)('%s', (file) => {
    // Only <title> inside <Head>; an SVG <title> is a tooltip, not the tab title.
    const heads = [...read(file).matchAll(/<Head>([\s\S]*?)<\/Head>/g)].map((m) => m[1])
    const titles = heads.flatMap((head) => [...head.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => m[1]))
    for (const title of titles) expect(title, file).toContain('Brooks Roley')
  })
})

describe('no leftover public API endpoints', () => {
  it.each(['src/pages/api/search.js', 'src/pages/api/hello.ts'])('%s is gone', (file) => {
    expect(exists(file)).toBe(false)
  })

  it('db-health returns the server time and version only to an admin-key caller', () => {
    const src = read('src/pages/api/db-health.ts')
    expect(src).toContain('isValidAdminKey(req)')
    // The public branch answers with status alone.
    expect(src).toMatch(/if \(!detailed\) return res\.status\(200\)\.json\(\{ status: "connected" \}\)/)
    expect(src).toMatch(/if \(!detailed\) return res\.status\(503\)\.json\(\{ status: "error" \}\)/)
  })
})

describe('the GitHub README', () => {
  const readme = read('README.md')

  it('names no LLC or entity, since none has been formed', () => {
    expect(readme).not.toMatch(/\bLLC\b|Zero Paradox/)
  })

  it('does not advertise pages that are behind the login', () => {
    for (const name of ['zero-paradox', 'education-tracker', 'digital-products']) {
      expect(readme, name).not.toContain(`/${name}`)
    }
  })

  it('links to the live site', () => {
    expect(readme).toContain('https://www.brooksroley.com')
  })
})
