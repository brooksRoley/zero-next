import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { AVAILABILITY } from 'src/lib/resume'
import { INTERNAL_ROUTE_KEYS, ROUTES, SITE_ORIGIN } from 'src/lib/routes'
import { buildSitemapXml } from 'src/lib/sitemap'

// Checks 3–6 of the Hiring Readiness list in CLAUDE.md, as tests. Every
// application email links this site; these are the things an audit found
// working against it (placeholders, an entity claim, a consulting-first hero,
// missing crawl files) and nothing was guarding.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(rel)
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [rel] : []
  })
}

// The paths src/proxy.ts puts behind the login. `/x/:path*` gates everything under /x.
const GATED = [...read('src/proxy.ts').matchAll(/'(\/[^']*)'/g)]
  .map((match) => match[1])
  .filter((entry) => !entry.includes('login'))

function isGated(routePath: string): boolean {
  return GATED.some((entry) =>
    entry.endsWith('/:path*') ? routePath.startsWith(entry.replace(':path*', '')) : routePath === entry,
  )
}

/** `src/pages/admin/leads.tsx` → `/admin/leads`. */
function routeOf(pageFile: string): string {
  const relative = pageFile.replace(/^src\/pages/, '').replace(/\.(tsx?|jsx?)$/, '')
  return relative.replace(/\/index$/, '') || '/'
}

// Everything a visitor can be served: components, API responses, and every
// page that is not behind the proxy.
const PUBLIC_SOURCES = [
  ...sourceFiles('src/components'),
  ...sourceFiles('src/pages').filter((file) => !isGated(routeOf(file))),
]

function filesMatching(pattern: RegExp): string[] {
  return PUBLIC_SOURCES.filter((file) => pattern.test(read(file)))
}

describe('hiring readiness — check 3: no placeholders on public pages', () => {
  it.each([
    ['Coming soon', /coming soon/i],
    ['Configure in .env.local', /Configure in \.env/i],
    ['(unavailable)', /\(unavailable\)/i],
  ])('no public source says "%s"', (_name, pattern) => {
    expect(filesMatching(pattern)).toEqual([])
  })

  it.each(['/zero-paradox', '/education-tracker', '/digital-products'])(
    'keeps the unfinished page %s behind the proxy',
    (routePath) => {
      expect(isGated(routePath)).toBe(true)
    },
  )

  it('links to no gated page from the route registry', () => {
    const gatedLinks = INTERNAL_ROUTE_KEYS.filter((key) => isGated(ROUTES[key].href))
    expect(gatedLinks).toEqual([])
  })

  it('hardcodes no link to a gated page in public source', () => {
    const offenders = PUBLIC_SOURCES.filter((file) =>
      [...read(file).matchAll(/href\s*[:=]\s*["'](\/[^"'#?]*)/g)].some((match) => isGated(match[1])),
    )
    expect(offenders).toEqual([])
  })
})

describe('hiring readiness — check 4: no entity claim', () => {
  it('names no LLC or other entity in public source — none has been formed', () => {
    expect(filesMatching(/\bLLC\b|Zero Paradox/)).toEqual([])
  })
})

describe('hiring readiness — check 5: the hero leads with the job search', () => {
  it('states availability for full-time roles in the hero, from the resume data', () => {
    expect(AVAILABILITY).toMatch(/full-time/)
    expect(read('src/components/PhysicsHero.tsx')).toContain('{AVAILABILITY}')
  })

  it('mentions consulting only after full-time roles on the landing page', () => {
    const home = read('src/pages/index.tsx')
    const fullTime = home.indexOf('full-time')
    const consulting = home.search(/available for consulting/i)
    expect(fullTime).toBeGreaterThan(-1)
    expect(consulting).toBeGreaterThan(fullTime)
  })
})

describe('hiring readiness — check 6: crawl files and absolute share tags', () => {
  it('ships a robots.txt that points at the sitemap', () => {
    expect(read('public/robots.txt')).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)
  })

  it('serves a sitemap page', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/pages/sitemap.xml.ts'))).toBe(true)
  })

  it('lists the resume and no gated page in the sitemap', () => {
    const xml = buildSitemapXml()
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/resume</loc>`)
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/</loc>`)
    for (const entry of GATED) {
      expect(xml, entry).not.toContain(`${SITE_ORIGIN}${entry.replace('/:path*', '')}<`)
    }
  })

  it('emits a canonical tag site-wide', () => {
    expect(read('src/pages/_app.tsx')).toMatch(/rel="canonical"/)
  })

  it.each(['src/pages/_app.tsx', 'src/pages/_document.tsx'])(
    '%s gives every share image an absolute URL',
    (file) => {
      const relativeImages = [...read(file).matchAll(/(?:og|twitter):image"\s+content="(\/[^"]*)"/g)]
      expect(relativeImages.map((match) => match[1])).toEqual([])
    },
  )
})
