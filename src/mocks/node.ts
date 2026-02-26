// MSW node server setup — used in tests and SSR environments

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
