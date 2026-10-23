import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'src/pages/consulting.tsx'), 'utf8')

// The page is the work by domain now (2026-10-23): no form, no prices, no
// urgency. These keep it that way and keep its links keyboard-visible.
describe('work page', () => {
  it('collects nothing and sells nothing', () => {
    for (const banned of ['<form', '<input', 'fetch(', '$', 'Most popular', 'Book a free call', 'from $']) {
      expect(src.replace(/\$\{/g, ''), banned).not.toContain(banned)
    }
  })

  it('names every domain Brooks asked it to show', () => {
    for (const domain of ['Robotics', 'Sustainability', 'Healthcare', 'Finance', 'Ecology', 'Computer science and game design']) {
      expect(src).toContain(domain)
    }
  })

  it('links show a keyboard focus ring', () => {
    expect(src).toContain('focus-visible:ring-2')
  })
})
