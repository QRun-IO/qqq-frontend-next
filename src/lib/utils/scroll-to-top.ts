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
 * @file scroll-to-top — returns the page to its top, as the Material dashboard does on every
 * route change and when a query's page or page size changes.
 */

/** Id of the dashboard's scrolling main content region. */
export const MAIN_CONTENT_ID = 'main-content'

/**
 * Scrolls the dashboard's main content region (which scrolls on its own inside the shell)
 * and the document back to the top.
 */
export function scrollPageToTop(): void {
  if (typeof document === 'undefined') return
  const main = document.getElementById(MAIN_CONTENT_ID)
  if (main) main.scrollTop = 0
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0
}
