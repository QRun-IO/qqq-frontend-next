import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/**/*.test.tsx'],
      // `pnpm test:coverage` (CI) fails below these. They sit just under the measured
      // coverage of src/lib (Vitest 4.1.11: 82.8% statements, 75.65% branches, 89.87%
      // functions, 84.42% lines); raise them as coverage grows, never lower them.
      thresholds: {
        statements: 82,
        branches: 75,
        functions: 89,
        lines: 84,
        'src/lib/api/**': { statements: 90, branches: 81, functions: 93, lines: 92 },
        'src/lib/utils/**': { statements: 93, branches: 84, functions: 96, lines: 96 },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
