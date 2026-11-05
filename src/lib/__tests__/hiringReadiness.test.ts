import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { AI_NOTE, AVAILABILITY } from 'src/lib/resume'
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

  it.each(['/zero-paradox', '/education-tracker', '/digital-products', '/stat-galaxy'])(
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
  const home = read('src/pages/index.tsx')
  // The home page's one row of links, in order (2026-11-03 quiet home).
  const linkKeys = [...home.matchAll(/\{ key: '(\w+)'/g)].map((m) => m[1])

  it('states availability for full-time roles on the home page, from the resume data', () => {
    expect(AVAILABILITY).toMatch(/full-time/)
    expect(home).toContain('{AVAILABILITY}')
  })

  it('mentions consulting only after full-time roles on the landing page', () => {
    // The link row renders after the availability line.
    expect(home.indexOf('{AVAILABILITY}')).toBeGreaterThan(-1)
    expect(home.indexOf('LINKS.map')).toBeGreaterThan(home.indexOf('{AVAILABILITY}'))
    expect(linkKeys).toContain('consulting')
  })

  // Brooks (2026-11-05), replacing the 2026-11-02 order: the professional
  // links lead (resume, then work), and the games sit behind one Theater link
  // instead of single-game links. The work page is still never in the top nav.
  it('links the resume, then work, then one games link', () => {
    expect(linkKeys.slice(0, 3)).toEqual(['resume', 'consulting', 'theater'])
    expect(linkKeys).not.toContain('hardwood')
    expect(linkKeys).not.toContain('basketball')
    expect(read('src/components/NavHeader.jsx')).not.toContain("route('consulting')")
  })

  // Review: say the AI work up front so it reads as intentional.
  it('says on the home page what the AI work was for, from the resume data', () => {
    expect(AI_NOTE).toMatch(/learning to build with AI coding agents/)
    expect(AI_NOTE).not.toMatch(/blocks? (the |a )?merge/i)
    expect(home).toContain('{AI_NOTE}')
  })

  // Decided 2026-10-30: satire and art pieces stay at their URLs but off the
  // home page, where they read as noise or as risk. The games index (Theater)
  // was on this list until Brooks chose one "games" link on 2026-11-05.
  it('keeps satire and art pieces off the home page', () => {
    for (const key of ['rigReport', 'modelArena', 'luminousFlow']) {
      expect(linkKeys, key).not.toContain(key)
      expect(home, key).not.toContain(`route('${key}')`)
    }
  })

  it('puts email one click from the home page', () => {
    expect(home).toContain('mailto:')
  })

  it('uses no emoji on the home page', () => {
    // Both the HTML-entity form (&#x1F3C0;) and literal pictographs.
    expect(home).not.toMatch(/&#x(1F[0-9A-F]{3}|2[67][0-9A-F]{2});/i)
    expect(home).not.toMatch(/\p{Extended_Pictographic}/u)
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
