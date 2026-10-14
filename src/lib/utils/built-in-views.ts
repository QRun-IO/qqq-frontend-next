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

/** @file Built-in views preserve opaque backend expressions through existing URL filters. */
import type { QQueryFilter } from '@/types'
/** Uses the query screen's filter URL contract.
 * @param table - Metadata name.
 * @param filter - Server view, including CurrentUser expressions.
 * @returns Internal table URL.
 */
export function builtInViewHref(table: string, filter: Partial<QQueryFilter>) {
  return `/app/${encodeURIComponent(table)}?filter=${encodeURIComponent(JSON.stringify(filter))}`
}
