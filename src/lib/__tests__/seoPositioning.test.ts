import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { AVAILABILITY, HEADLINE, KNOWS_ABOUT, LOCATION, SITE_DESCRIPTION } from 'src/lib/resume'
import { route } from 'src/lib/routes'
import { PERSON_JSON_LD } from 'src/pages/index'

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')

// Positioning for senior roles (2026-11-19): one headline, the same location
// everywhere, and Person structured data that says only what the page says.
describe('senior positioning and structured data', () => {
  it('headline, description and location agree on level and place', () => {
    expect(HEADLINE).toMatch(/^Senior Software Engineer · /)
    expect(HEADLINE).toContain(LOCATION)
    expect(SITE_DESCRIPTION).toContain(LOCATION)
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(AVAILABILITY).toMatch(/^Open to senior .*roles/)
  })

  it('Person JSON-LD links the public profiles and the location, and nothing private', () => {
    const ld = JSON.parse(JSON.stringify(PERSON_JSON_LD))
    expect(ld['@type']).toBe('Person')
    expect(ld.jobTitle).toBe('Senior Software Engineer')
    expect(ld.sameAs).toEqual([route('github').href, route('linkedin').href])
    expect(ld.address).toMatchObject({ addressLocality: 'Orange County', addressRegion: 'CA', addressCountry: 'US' })
    expect(ld.knowsAbout).toEqual(KNOWS_ABOUT)
    expect(JSON.stringify(ld)).not.toMatch(/@gmail|telephone|streetAddress|birthDate|worksFor/)
  })

  it('every page-level description stays under 160 characters', () => {
    for (const f of ['src/pages/resume.js']) {
      for (const m of read(f).matchAll(/name="description" content="([^"]+)"/g)) {
        expect(m[1].length, f).toBeLessThanOrEqual(160)
      }
    }
  })

  it('selected-work links point at anchors that exist', () => {
    expect(read('src/pages/resume.js')).toContain('id="resume-experience"')
    const hw = read('src/pages/games/hardwood.tsx')
    expect(hw).toContain('id="hw-architecture"')
    expect(hw).toContain('id="hw-measured"')
  })
})
