import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/components/**'],
    },
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },
})
