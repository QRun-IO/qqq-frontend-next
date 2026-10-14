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

/** @file Per-page-load cache of whether the server supports preferences; free of imports so test setup can reset it. */

/** The cached answer, or null when not yet asked. */
export const preferencesSupportCache: { supported: Promise<boolean> | null } = { supported: null }

/** Forgets the cached feature check (tests, and after signing in to another server). */
export function resetPreferencesSupport(): void {
  preferencesSupportCache.supported = null
}
