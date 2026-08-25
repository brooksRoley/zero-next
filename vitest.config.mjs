import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Use the automatic JSX runtime (matching tsconfig's "react-jsx") so .jsx
  // source files that don't `import React` — like NavHeader — transform the
  // same way Next.js builds them. Without this, esbuild falls back to the
  // classic runtime for .jsx and those components throw "React is not defined".
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // API routes are in scope deliberately. They were absent from this list
      // until 2026-08-25, so `src/pages/api` never appeared in the coverage
      // report at all — not as 0%, just missing. That is how "the tests protect
      // the money-path routes" survived as an assertion while Stripe checkout
      // and webhook had no tests: nothing in the report could contradict it.
      // An untested route should show up as a zero, not as a blank space.
      include: ['src/lib/**', 'src/components/**', 'src/pages/api/**'],
    },
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },
})
