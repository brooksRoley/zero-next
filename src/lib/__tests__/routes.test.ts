import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  ROUTES,
  ROUTE_KEYS,
  INTERNAL_ROUTE_KEYS,
  route,
  type RouteKey,
} from 'src/lib/routes'

const PAGES_DIR = path.join(process.cwd(), 'src/pages')
const PAGE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']

/**
 * Resolve a Pages Router href to the file that serves it, mirroring Next's own
 * lookup: `/foo` is served by `foo.tsx` *or* `foo/index.tsx`. Returns the
 * repo-relative path, or null when nothing serves the route.
 */
function resolvePageFile(href: string): string | null {
  const relative = href === '/' ? 'index' : href.replace(/^\//, '')
  for (const ext of PAGE_EXTENSIONS) {
    for (const candidate of [`${relative}.${ext}`, path.join(relative, `index.${ext}`)]) {
      if (fs.existsSync(path.join(PAGES_DIR, candidate))) {
        return path.join('src/pages', candidate)
      }
    }
  }
  return null
}

describe('route registry', () => {
  it('serves every internal route from a real file under src/pages', () => {
    const dead = INTERNAL_ROUTE_KEYS.filter((key) => resolvePageFile(ROUTES[key].href) === null)
    // Named so a failure reports *which* route died, not just a count.
    expect(dead.map((key) => `${key} → ${ROUTES[key].href}`)).toEqual([])
  })

  it('marks external routes with an absolute URL and vice versa', () => {
    for (const key of ROUTE_KEYS) {
      const { href, external } = ROUTES[key]
      expect(external ? /^https?:\/\//.test(href) : href.startsWith('/')).toBe(true)
    }
  })

  it('has no duplicate hrefs — one destination, one key', () => {
    const seen = new Map<string, RouteKey>()
    const duplicates: string[] = []
    for (const key of ROUTE_KEYS) {
      const { href } = ROUTES[key]
      const previous = seen.get(href)
      if (previous) duplicates.push(`${href} (${previous} & ${key})`)
      else seen.set(href, key)
    }
    expect(duplicates).toEqual([])
  })

  it('gives every route a non-empty label', () => {
    const unlabeled = ROUTE_KEYS.filter((key) => ROUTES[key].label.trim() === '')
    expect(unlabeled).toEqual([])
  })

  it('throws on an unknown key so a JS-side typo fails loudly', () => {
    expect(() => route('nope' as RouteKey)).toThrow(/Unknown route key/)
  })

  it('freezes entries so one surface cannot rewrite another surface’s route', () => {
    expect(Object.isFrozen(ROUTES)).toBe(true)
    expect(Object.isFrozen(ROUTES.pente)).toBe(true)
  })
})

describe('route-list consumers read from the registry', () => {
  // The bug this registry exists to kill: a route hand-written into one of
  // these lists and forgotten in the others. If a raw internal path literal
  // reappears in a link position here, the lists have started drifting again.
  const CONSUMERS = [
    'src/components/NavHeader.jsx',
    'src/pages/index.tsx',
    'src/pages/theater.tsx',
  ]

  it.each(CONSUMERS)('%s hardcodes no internal link paths', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    // Matches `href="/foo"` and `href: '/foo'` — the two link-position forms
    // these files use. Anchors inside copy (`#section`) are not routes.
    const hardcoded = [...source.matchAll(/href\s*[:=]\s*["'](\/[^"'#][^"']*)["']/g)].map(
      (match) => match[1],
    )
    expect(hardcoded).toEqual([])
  })
})
