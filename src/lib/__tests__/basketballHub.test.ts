import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { HUB_SECTIONS, hubLink } from 'src/lib/basketballHub'
import { BASKETBALL_ROUTE_KEYS, ROUTES } from 'src/lib/routes'
import { buildSitemapXml } from 'src/lib/sitemap'

// The /basketball hub exists so the basketball work lives in one place and the
// nav carries one Basketball link. Routes marked `basketball: true` in the
// registry are the contract: each is on the hub, and none is in the nav directly.

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
const hubKeys = HUB_SECTIONS.flatMap((section) => section.items.map((item) => item.key))

describe('basketball hub', () => {
  it('marks the expected basketball routes in the registry', () => {
    expect([...BASKETBALL_ROUTE_KEYS].sort()).toEqual(
      [
        'basketballPlatform',
        'basketballTactics',
        'hardwood',
        'moments',
        'nba',
        'nbaAccuracy',
        'passAndCut',
        'readAndReact',
        'rigReport',
        'tradeMachine',
      ].sort(),
    )
  })

  it('links every basketball route from the hub', () => {
    const missing = BASKETBALL_ROUTE_KEYS.filter((key) => !hubKeys.includes(key))
    expect(missing).toEqual([])
  })

  it('lists only basketball routes, each once', () => {
    expect(hubKeys.filter((key) => !ROUTES[key].basketball)).toEqual([])
    expect(new Set(hubKeys).size).toBe(hubKeys.length)
  })

  it('groups the work as Play, Tools and Built', () => {
    expect(HUB_SECTIONS.map((section) => section.heading)).toEqual(['Play', 'Tools', 'Built'])
  })

  it('gives every item a title and a one-line description in plain words', () => {
    for (const item of HUB_SECTIONS.flatMap((section) => section.items)) {
      const { title, href } = hubLink(item)
      expect(title.trim(), item.key).not.toBe('')
      expect(href, item.key).toBe(ROUTES[item.key].href)
      expect(item.line.length, item.key).toBeGreaterThan(20)
      expect(item.line, item.key).not.toMatch(/—|\bLLC\b|Zero Paradox/)
    }
  })

  it('renders the hub from that list and shows keyboard focus on its links', () => {
    const page = read('src/pages/basketball.tsx')
    expect(page).toContain('HUB_SECTIONS')
    const links = page.match(/<Link\b[\s\S]*?>/g) ?? []
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toContain('focus-visible:ring-2')
  })

  it('is in the sitemap', () => {
    expect(buildSitemapXml()).toContain('/basketball</loc>')
  })
})

describe('nav has a single Basketball entry', () => {
  const nav = read('src/components/NavHeader.jsx')
  const navList = nav.slice(nav.indexOf('const NAV_LINKS'), nav.indexOf('];', nav.indexOf('const NAV_LINKS')))

  it('links the hub exactly once', () => {
    expect(navList.match(/route\('basketball'\)/g) ?? []).toHaveLength(1)
  })

  it('lists no basketball route directly', () => {
    const direct = BASKETBALL_ROUTE_KEYS.filter((key) => navList.includes(`route('${key}')`))
    expect(direct).toEqual([])
  })

  it('has no Projects menu left holding basketball work', () => {
    expect(navList).not.toMatch(/label: 'Projects'/)
  })
})
