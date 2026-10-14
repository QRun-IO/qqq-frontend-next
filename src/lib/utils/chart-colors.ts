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

/** @file Default widget palette, shared with data-analysis charts. */
export const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

/** Uses pale diverging palette tints with black text, maintaining AA contrast in both themes.
 * @param r - Pearson correlation or unavailable.
 * @returns Explicit background and foreground colours.
 */
export function correlationColor(r: number | null | undefined) {
  const base = r != null && r < 0 ? DEFAULT_COLORS[3] : DEFAULT_COLORS[0]
  const weight = r == null ? 0 : Math.min(1, Math.abs(r)) * 0.45
  const rgb = [1, 3, 5].map((i) =>
    Math.round(255 * (1 - weight) + parseInt(base.slice(i, i + 2), 16) * weight)
  )
  return { backgroundColor: `rgb(${rgb.join(', ')})`, color: '#000000' }
}
