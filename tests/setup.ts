// Vitest test setup

import '@testing-library/jest-dom'
import { configureAxe, toHaveNoViolations } from 'jest-axe'
import { vi, beforeAll, afterEach, afterAll, expect } from 'vitest'
import { resetPreferencesMock } from '@/mocks/handlers/preferences'
import { resetUiApiExtensions } from '@/lib/api/ui-api-extensions'
import { server } from '@/mocks/node'

// jsdom has no layout observer; Radix tooltip positioning requires the browser API.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

// Extend Vitest's expect with jest-axe accessibility matchers
expect.extend(toHaveNoViolations)

// Configure axe globally — color-contrast is tested manually to avoid false positives
// in jsdom which cannot accurately compute CSS-derived contrast ratios
configureAxe({ rules: { 'color-contrast': { enabled: false } } })

// Start MSW node server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset any request handlers added during a test
afterEach(() => {
  server.resetHandlers()
  resetUiApiExtensions()
  resetPreferencesMock()
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
