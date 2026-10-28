import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { AVAILABILITY, EDUCATION, EXPERIENCE, INTERLUDES, LOCATION, SKILLS, SUMMARY } from 'src/lib/resume'

// Everything a visitor reads on /resume, as one string.
const ALL_TEXT = [
  SUMMARY, LOCATION, AVAILABILITY, ...INTERLUDES.map((g) => g.text),
  ...EXPERIENCE.flatMap((r) => [r.org, r.role, r.dates, ...r.bullets]),
  ...SKILLS.flatMap((g) => [g.label, ...g.items]),
  EDUCATION.school, EDUCATION.degree, EDUCATION.year,
].join('\n')

describe('resume data', () => {
  // The July 2025 PDF carried these for over a year. Each one is a product
  // name or phrase a technical reader recognizes on sight.
  it.each([
    ['Node.is', /Node\.is\b/],
    ['Veutify', /Veutify/i],
    ['Fastapi / FastApi', /Fastapi|FastApi/],
    ['Sagemaker', /Sagemaker/],
    ['hashicorp', /hashicorp/],
    ['Vue-Router', /Vue-Router/],
    ['Bachelors of', /Bachelors of/],
    ['Worked with integrating', /Worked with integrating/i],
  ])('does not contain the misspelling %s', (_name, pattern) => {
    expect(ALL_TEXT).not.toMatch(pattern)
  })

  it('claims no legal entity — none has been formed', () => {
    expect(ALL_TEXT).not.toMatch(/\bLLC\b|\bInc\b\.?|Zero Paradox/)
  })

  // main has no branch protection, so a red check does not block a merge.
  it('does not claim that CI blocks merges', () => {
    expect(ALL_TEXT).not.toMatch(/blocks? (the |a )?merge/i)
  })

  it('leads with current work, so the page never ends at a past role', () => {
    expect(EXPERIENCE[0].dates).toMatch(/Present$/)
  })

  it('gives every role a date and at least one bullet', () => {
    for (const r of EXPERIENCE) {
      expect(r.dates, r.org).not.toBe('')
      expect(r.bullets.length, r.org).toBeGreaterThan(0)
    }
  })

  it('places every interlude between two real entries', () => {
    for (const g of INTERLUDES) {
      expect(g.afterIndex, g.text).toBeGreaterThanOrEqual(0)
      expect(g.afterIndex, g.text).toBeLessThan(EXPERIENCE.length - 1)
    }
  })

  // Grove ended with a 2022 layoff; the resume said 2023 for over a year. The
  // family leave runs from that layoff to Zoox, so no year goes unexplained.
  it('dates Grove to 2022 and explains every year after it', () => {
    expect(EXPERIENCE.find((r) => r.org.startsWith('Grove'))?.dates).toBe('2019 – 2022')
    expect(INTERLUDES.map((g) => g.text.slice(0, 11))).toEqual(['2022 – 2024'])
    expect(EXPERIENCE.find((r) => r.org === 'Zoox')?.dates).toMatch(/^September 2024/)
    expect(EXPERIENCE[0].dates).toBe('2025 – Present')
  })

  // The page and PDF are public. Brooks chose one family line for 2022–2024
  // (2026-10-28); every other break shows dates only, and no illness, hospice,
  // estate, property or other health detail is published.
  it('keeps breaks to dates and one approved family line', () => {
    const APPROVED =
      '2022 – 2024 — Family leave: caring for my father at the end of his life, and a move from the Bay Area to Orange County.'
    for (const g of INTERLUDES) {
      if (g.text === APPROVED) continue
      expect(g.text, g.text).toMatch(/^\d{4}( – \d{4})? — Career break\.$/)
    }
    expect(ALL_TEXT.split(APPROVED).join('')).not.toMatch(
      /\b(family|father|mother|parent|estate|caregiv\w*|illness|ill|death|died|passed away|funeral|hospice|medical leave|health reasons?|propert(y|ies)|inherit\w*|trust)\b/i,
    )
  })

  // The repository and the PDF are public; the PDF carries an email and links only.
  it('puts no phone number in the PDF build script', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts', 'build-resume-pdf.ts'), 'utf8')
    expect(script).not.toMatch(/PHONE|\d{3}[-.\s'\], ]+\d{3}[-.\s'\], ]+\d{4}/)
  })

  // A recruiter gives the PDF a glance; ten years fit on one page (2026-10-28).
  it('keeps the PDF to one page', () => {
    const pdf = fs.readFileSync(path.join(process.cwd(), 'public', 'Brooks_Roley.pdf')).toString('latin1')
    expect(pdf.match(/\/Count (\d+)/)?.[1]).toBe('1')
  })

  it('states one location and no second metro', () => {
    expect(LOCATION).toBe('Orange County, CA')
    expect(ALL_TEXT).not.toMatch(/San Francisco/)
  })
})
