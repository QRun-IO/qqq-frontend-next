// Vitest test setup

import '@testing-library/jest-dom'
import { configureAxe, toHaveNoViolations } from 'jest-axe'
import { vi, beforeAll, afterEach, afterAll, expect } from 'vitest'
import { resetPreferencesMock } from '@/mocks/handlers/preferences'
import { resetUiApiExtensions } from '@/lib/api/ui-api-extensions'
import { server } from '@/mocks/node'

// Extend Vitest's expect with jest-axe accessibility matchers
expect.extend(toHaveNoViolations)

// Configure axe globally — color-contrast is tested manually to avoid false positives
// in jsdom which cannot accurately compute CSS-derived contrast ratios
configureAxe({ rules: { 'color-contrast': { enabled: false } } })

// Start MSW node server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset any request handlers added during a test. Each test is a fresh page load, so the
// realtime tab singleton is dropped too: kept, it would resume the next test's stream with
// the previous test's Last-Event-ID, and the mock's replay-miss `resync` would invalidate
// (and refetch) every active query of the next test at a load-dependent moment. It is
// imported here, not at the top: a static import would load the realtime API module (and
// the real API client it binds) before a test file's vi.mock('@/lib/api/client') applies.
afterEach(async () => {
  server.resetHandlers()
  resetUiApiExtensions()
  resetPreferencesMock()
  const { resetRealtimeClient } = await import('@/lib/realtime/client')
  resetRealtimeClient()
})

// Clean up after all tests are done
afterAll(() => server.close())

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
