// Auth metadata fixture — FULLY_ANONYMOUS so the app auto-sessions

import type { QAuthenticationMetaData } from '@/types'

export const authMetadata: QAuthenticationMetaData = {
  name: 'mockAuth',
  type: 'FULLY_ANONYMOUS',
  values: {},
}
