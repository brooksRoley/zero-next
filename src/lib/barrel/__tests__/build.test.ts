// The committed WebAssembly must be built from the committed C++. A source
// change without `native/barrel/build.sh` fails here instead of shipping a
// game that no longer matches its code.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BARREL_BUILD } from 'src/lib/barrel/buildInfo'
import { barrelSourceHash } from '../../../../native/barrel/sourceHash.mjs'

describe('BARREL build', () => {
  it('public/barrel matches native/barrel/src', () => {
    expect(BARREL_BUILD.sourceHash).toBe(barrelSourceHash(path.join(process.cwd(), 'native/barrel')))
  })

  it('ships the module and stays small', () => {
    const wasm = fs.statSync(path.join(process.cwd(), 'public/barrel/barrel.wasm')).size
    expect(wasm).toBeGreaterThan(50_000)
    expect(wasm).toBeLessThan(400_000)
  })
})
