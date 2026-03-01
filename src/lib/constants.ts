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
 * @file constants — shared application-wide constants for pagination, debounce, and other tuning knobs.
 */

/**
 * The set of allowed page-size values for the Record Query pagination control.
 *
 * Rendered as selectable options in the rows-per-page dropdown. The `as const`
 * assertion ensures the tuple is used as a literal type throughout the codebase.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

/**
 * Debounce delay (in milliseconds) for the quick-search input on the Record Query page.
 *
 * Waits this long after the last keystroke before firing a new query, balancing
 * responsiveness against unnecessary network requests.
 */
export const SEARCH_DEBOUNCE_MS = 400

/**
 * Debounce delay (in milliseconds) for async combobox option fetching.
 *
 * Applied by {@link useAsyncCombobox}'s `debouncedFetch` to throttle possible-value
 * API calls while the user is typing in a filter combobox input.
 */
export const COMBOBOX_DEBOUNCE_MS = 300
