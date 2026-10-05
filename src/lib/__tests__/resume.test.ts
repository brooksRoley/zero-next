import { describe, it, expect } from 'vitest'
import { AVAILABILITY, EDUCATION, EXPERIENCE, INTERLUDE, LOCATION, SKILLS, SUMMARY } from 'src/lib/resume'

// Everything a visitor reads on /resume, as one string.
const ALL_TEXT = [
  SUMMARY, LOCATION, AVAILABILITY, INTERLUDE.text,
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

  it('leads with current work, so the page never ends at a past role', () => {
    expect(EXPERIENCE[0].dates).toMatch(/Present$/)
  })

  it('gives every role a date and at least one bullet', () => {
    for (const r of EXPERIENCE) {
      expect(r.dates, r.org).not.toBe('')
      expect(r.bullets.length, r.org).toBeGreaterThan(0)
    }
  })

  it('places the interlude between two real entries', () => {
    expect(INTERLUDE.afterIndex).toBeGreaterThanOrEqual(0)
    expect(INTERLUDE.afterIndex).toBeLessThan(EXPERIENCE.length - 1)
  })

  it('states one location and no second metro', () => {
    expect(LOCATION).toBe('Orange County, CA')
    expect(ALL_TEXT).not.toMatch(/San Francisco/)
  })
})
