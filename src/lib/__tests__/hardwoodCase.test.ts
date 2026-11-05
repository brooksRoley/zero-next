import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { BUNDLE, LAYERS, SOURCE } from 'src/lib/hardwoodCase'

const DIR = path.join(process.cwd(), 'public/hardwood')

describe('Hardwood case study', () => {
  it('quotes sizes that match the bundle actually shipped', () => {
    for (const m of BUNDLE) {
      const bytes = fs.readFileSync(path.join(DIR, m.file))
      expect(bytes.length, `${m.file} raw`).toBe(m.raw)
      const gz = zlib.gzipSync(bytes, { level: 9 }).length
      // zlib and the gzip CLI differ by a header's worth of bytes.
      expect(Math.abs(gz - m.gzip) / m.gzip, `${m.file} gzip`).toBeLessThan(0.01)
    }
  })

  it('links every layer to public source', () => {
    for (const layer of LAYERS) expect(layer.source).toMatch(/^https:\/\/github\.com\/brooksRoley\//)
    expect(Object.values(SOURCE).every((u) => u.startsWith('https://github.com/brooksRoley/'))).toBe(true)
  })
})
