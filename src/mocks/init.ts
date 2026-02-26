// Mock API initialization
//
// Usage:
//   Start the app with mocks enabled:
//     NEXT_PUBLIC_MOCK_API=true pnpm dev
//   Or copy .env.mock to .env.local:
//     cp .env.mock .env.local && pnpm dev
//
// The MSW service worker intercepts all /qqq/v1/* requests and returns
// realistic fixture data. Mutations (POST/PUT/DELETE) are applied to an
// in-memory store and persist for the duration of the browser session.
// The store is reset on page reload.

export async function initMocks(): Promise<void> {
  // Skip SSR — MSW browser worker requires window/navigator
  if (typeof window === 'undefined') return

  if (process.env.NEXT_PUBLIC_MOCK_API !== 'true') return

  const { worker } = await import('./browser')

  await worker.start({
    onUnhandledRequest: 'warn',
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  })

  // Log to console so developers know mocks are active
  console.info(
    '%c[MSW] Mock API active — all /qqq/v1/* requests intercepted',
    'color: #6366f1; font-weight: bold'
  )
}
