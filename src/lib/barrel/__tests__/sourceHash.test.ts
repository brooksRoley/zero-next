// The BARREL freshness hash must notice every source file that goes into the
// WebAssembly, and must not depend on line endings. build.test.ts proves the
// stamped hash is current; this proves the hash itself is trustworthy.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { barrelSourceHash } from '../../../../native/barrel/sourceHash.mjs'

const REAL = path.join(process.cwd(), 'native/barrel')
// Extensions the hash accepts. A source file with any other extension under
// src/ would be silently unhashed, so the last test fails until this list and
// the filter in sourceHash.mjs are changed together.
const HASHED = new Set(['.cpp', '.hpp', '.h'])

let tmp: string
const copy = (name: string) => {
  const dest = path.join(tmp, name)
  fs.mkdirSync(path.join(dest, 'src'), { recursive: true })
  fs.copyFileSync(path.join(REAL, 'build.sh'), path.join(dest, 'build.sh'))
  for (const f of fs.readdirSync(path.join(REAL, 'src'))) {
    fs.copyFileSync(path.join(REAL, 'src', f), path.join(dest, 'src', f))
  }
  return dest
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'barrel-hash-'))
})
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('barrelSourceHash', () => {
  it('matches the real folder when copied unchanged', () => {
    expect(barrelSourceHash(copy('same'))).toBe(barrelSourceHash(REAL))
  })

  it('changes when any one source file changes', () => {
    const base = barrelSourceHash(REAL)
    const files = [...fs.readdirSync(path.join(REAL, 'src')).filter((f) => HASHED.has(path.extname(f))), '../build.sh']
    expect(files.length).toBeGreaterThanOrEqual(14)
    for (const f of files) {
      const dir = copy('edit-' + f.replace(/\W/g, '_'))
      const target = path.join(dir, 'src', f)
      fs.appendFileSync(target, '\n// edit\n')
      expect(barrelSourceHash(dir), `editing ${f} must change the hash`).not.toBe(base)
    }
  })

  it('ignores CRLF vs LF', () => {
    const dir = copy('crlf')
    for (const f of fs.readdirSync(path.join(dir, 'src'))) {
      const p = path.join(dir, 'src', f)
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'))
    }
    expect(barrelSourceHash(dir)).toBe(barrelSourceHash(REAL))
  })

  it('hashes file names, so a rename is noticed', () => {
    const dir = copy('rename')
    fs.renameSync(path.join(dir, 'src/font.hpp'), path.join(dir, 'src/font2.hpp'))
    expect(barrelSourceHash(dir)).not.toBe(barrelSourceHash(REAL))
  })

  it('every file under native/barrel/src has an extension the hash covers', () => {
    const unhashed = fs.readdirSync(path.join(REAL, 'src')).filter((f) => !HASHED.has(path.extname(f)))
    expect(unhashed, 'add the extension to sourceHash.mjs and to HASHED, then rebuild').toEqual([])
  })
})
