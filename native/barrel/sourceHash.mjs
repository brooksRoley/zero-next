// BARREL — one hash over every source file that goes into public/barrel/.
// build.sh stamps it into src/lib/barrel/buildInfo.ts; a vitest test recomputes
// it, so a source change without a rebuild fails CI instead of shipping a stale
// module. Byte order of names, so every platform agrees.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export function barrelSourceHash(dir = HERE) {
  const src = join(dir, 'src')
  const files = readdirSync(src)
    .filter((f) => /\.(cpp|hpp|h)$/.test(f))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((f) => join('src', f))
  files.push('build.sh')
  const h = createHash('sha256')
  for (const f of files) {
    h.update(f + '\0')
    // Line endings normalised so a Windows checkout hashes the same.
    h.update(readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n'))
  }
  return h.digest('hex')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(barrelSourceHash() + '\n')
}
