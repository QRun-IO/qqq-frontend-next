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

/** @file Pre-hydration appearance initialization for the root layout. */

/** Script run before page content to prevent a flash of the wrong appearance. */
export const themeScript = `(() => {
  if (typeof window === 'undefined') return;
  let stored = null;
  try { stored = window.localStorage.getItem('qqq-dark-mode'); } catch {}
  const dark = stored === null
    ? typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    : stored === 'true';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();`
