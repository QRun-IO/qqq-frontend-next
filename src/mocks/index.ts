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

// MSW mock layer — conditional export for browser vs. node environments
//
// In browser: import from ./browser (service worker)
// In tests:   import from ./node (setupServer)
// Initialization: import { initMocks } from './init'

export { initMocks } from './init'

// Re-export handlers for test utilities that need direct access
export { handlers } from './handlers'
