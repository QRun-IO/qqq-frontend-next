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

/** @file Version handler for tests that install optional extensions. */

import { http, HttpResponse } from 'msw'

/** Announces the supplied extension names (and the core preferences feature).
 * @param names - Installed extensions.
 * @returns An MSW version handler.
 */
export function uiApiVersionHandler(...names: string[]) {
  return http.get('/qqq/v1/version', () => HttpResponse.json({
    apiVersion: '1.1.0',
    features: ['preferences'],
    extensions: names.map((name) => ({ name, version: '1.0.0' })),
  }))
}
