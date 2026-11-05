import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { WORK_DESCRIPTION, WORK_INTRO, WORK_THESIS } from 'src/lib/narrative'
import { ROUTE_KEYS } from 'src/lib/routes'
import { AI_NOTE, EXPERIENCE, HERO_SUMMARY, SITE_DESCRIPTION, SUMMARY } from 'src/lib/resume'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')

// What a recruiter can read about the career: the Work page, the home hero and the resume.
const PUBLIC_TEXT = [
  WORK_THESIS, WORK_INTRO, WORK_DESCRIPTION,
  SUMMARY, HERO_SUMMARY, AI_NOTE, SITE_DESCRIPTION,
  ...EXPERIENCE.flatMap((r) => r.bullets),
  read('src/pages/consulting.tsx'),
  read('src/pages/index.tsx'),
].join('\n')

describe('career narrative', () => {
  // A 2026-11-05 brief asked the site to tell a computer vision and robotics
  // story. The Zoox work was SRE tooling at a robotics company; no role on the
  // resume did perception or robotics engineering. These claims stay out until one does.
  it.each([
    ['computer vision', /computer[- ]vision/i],
    ['perception', /\bperception\b/i],
    ['robotics engineering', /robotics (engineer|software|systems)/i],
    ['physical world', /physical world/i],
    ['multi-agent orchestration', /multi-agent orchestration/i],
    ['autonomous software', /autonomous (software|agents?|systems?)/i],
  ])('does not claim %s', (_name, pattern) => {
    expect(PUBLIC_TEXT).not.toMatch(pattern)
  })

  it('names the review step, so agent work never reads as unsupervised', () => {
    expect(WORK_INTRO).toMatch(/I review every change before I merge it/)
  })

  it('does not claim that CI blocks merges', () => {
    expect(WORK_INTRO).not.toMatch(/blocks? (the |a )?merge/i)
  })

  it('names only employers the resume names', () => {
    const orgs = EXPERIENCE.map((r) => r.org.split(' ')[0])
    for (const named of WORK_INTRO.match(/\bat ([A-Z]\w+)/g) ?? []) {
      expect(orgs).toContain(named.slice(3))
    }
  })

  it('renders the intro on the Work page', () => {
    const page = read('src/pages/consulting.tsx')
    expect(page).toContain('{WORK_THESIS}')
    expect(page).toContain('{WORK_INTRO}')
    expect(page).toContain('content={WORK_DESCRIPTION}')
  })

  it('keeps the meta description under 160 characters', () => {
    expect(WORK_DESCRIPTION.length).toBeLessThanOrEqual(160)
  })

  // The Work page groups the games by idea (2026-11-05). Every link must be a
  // registered, public route: nothing gated by src/proxy.ts, no hard-coded path.
  it('links every grouped build through a public registered route', () => {
    const page = read('src/pages/consulting.tsx')
    const groups = page.slice(page.indexOf('const BUILD_GROUPS'), page.indexOf('export default function Work'))
    const keys = [...groups.matchAll(/route\('(\w+)'\)/g)].map((m) => m[1])
    expect(keys.length).toBeGreaterThanOrEqual(6)
    expect(groups).not.toMatch(/href: '\//)
    const proxy = read('src/proxy.ts')
    for (const key of keys) {
      expect(ROUTE_KEYS, key).toContain(key)
    }
    for (const gated of ['/stat-galaxy', '/zero-paradox', '/education-tracker', '/digital-products']) {
      expect(proxy).toContain(gated)
      expect(groups).not.toContain(gated)
    }
  })
})
