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
 * @file UI API call registry — the calls the app makes that the vendored UI API document
 * (`qqq-v1.json`, QRun-IO/qqq `openapi/v1/openapi.yaml`) does not describe yet, and the call
 * sites whose path is not a literal. `ui-api-contract.test.ts` fails on any call that is neither
 * in the document nor listed here, and on any entry here that is no longer used, so this list
 * can only shrink (QRun-IO/qqq docs/UI-API-AUDIT.md, phase 4).
 *
 * Paths are relative to the UI API base (`/qqq/v1`), with every path parameter written `{}`.
 */

/** A call the document does not describe yet. */
export interface OffSpecCall {
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Normalised path template. */
  path: string
  /** Who serves it today. */
  owner: string
}

/** Off-spec calls, by owner. Remove entries as their owners move onto spec classes. */
export const OFF_SPEC_CALLS: OffSpecCall[] = []

/**
 * The most off-spec calls allowed (QRun-IO/qqq-frontend-next#107). Lower it whenever an owner moves
 * calls onto spec'd operations; never raise it. A feature that needs new backend calls lands in this
 * order: the qbit or module ships its UI API extension, its document is vendored into
 * `extensions/`, then the UI calls it - so new calls never need this list.
 */
export const OFF_SPEC_CEILING = 0

/**
 * Call sites whose path is computed rather than written as a literal: `file#expression` (the
 * first argument as written) to the calls it can make.
 */
export const DYNAMIC_CALL_SITES: Record<string, string[]> = {
  'lib/api/possible-values.ts#url': ['POST /table/{}/possibleValues/{}', 'POST /processes/{}/possibleValues/{}', 'POST /possibleValues/{}'],
  'lib/api/developer.ts#developerPath(tableName, primaryKey)': ['GET /table/{}/{}/developer'],
  'lib/api/esb.ts#path': ['GET /esb/table/{}', 'GET /esb/process/{}', 'GET /esb/overview', 'GET /esb/messages/{}', 'GET /esb/deadLetters/{}'],
  'lib/api/assistant.ts#path': [],
}

/** Path helper functions used inside call templates (`${helper(...)}/rest`), to their paths. */
export const PATH_HELPERS: Record<string, string> = {
  apiVersionPrefix: '/{}/{}',
  developerPath: '/table/{}/{}/developer',
  recordPath: '/qbit/collaboration/records/{}/{}',
}
