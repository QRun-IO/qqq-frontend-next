// MSW mock layer — conditional export for browser vs. node environments
//
// In browser: import from ./browser (service worker)
// In tests:   import from ./node (setupServer)
// Initialization: import { initMocks } from './init'

export { initMocks } from './init'

// Re-export handlers for test utilities that need direct access
export { handlers } from './handlers'
