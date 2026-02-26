// MSW browser worker setup — used in development (browser) environment

import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
