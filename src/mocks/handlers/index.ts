/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file Combines all MSW handler arrays into a single export for use by browser and node setups.
 */

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
