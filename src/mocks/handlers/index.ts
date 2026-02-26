// Combines all MSW handlers into a single export

import { authHandlers } from './auth'
import { metadataHandlers } from './metadata'
import { tableHandlers } from './tables'
import { possibleValuesHandlers } from './possible-values'
import { processHandlers } from './processes'
import { widgetHandlers } from './widgets'

export const handlers = [
  ...authHandlers,
  ...metadataHandlers,
  // Possible values must come before table handlers to avoid route conflicts
  ...possibleValuesHandlers,
  ...tableHandlers,
  ...processHandlers,
  ...widgetHandlers,
]
