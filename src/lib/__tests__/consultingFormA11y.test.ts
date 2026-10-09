import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'src/pages/consulting.tsx'), 'utf8')

describe('consulting form accessibility', () => {
  const fields = ['name', 'email', 'project_type', 'budget_range', 'company', 'timeline', 'message']

  it.each(fields)('label for %s is bound to its control', field => {
    expect(src).toContain(`htmlFor="consulting-${field}"`)
    expect(src).toContain(`id="consulting-${field}"`)
  })

  it('announces submit errors with role=alert', () => {
    expect(src).toMatch(/role="alert"[^>]*>\s*\{error\}/)
  })
})
