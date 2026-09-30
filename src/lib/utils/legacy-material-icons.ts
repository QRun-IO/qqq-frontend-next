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
 * @file Resolves valid legacy Material names using the pinned, locally served icon font.
 */
import codepoints from './material-icon-codepoints.json'

const CODEPOINTS: Readonly<Record<string, string>> = codepoints

/**
 * Finds a legacy font glyph for an icon name, including existing style suffix aliases.
 * Exact names take precedence because names such as `filter_9_plus` are actual glyphs.
 * @param name - Backend-provided Material Icons name.
 * @returns The Unicode glyph, or undefined for an unknown name.
 */
export function legacyMaterialIconCodepoint(name: string | undefined | null): string | undefined {
  if (!name) return undefined
  const normalized = name.trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(CODEPOINTS, normalized)) return CODEPOINTS[normalized]
  const base = normalized.replace(/_(outline|outlined|rounded|sharp|two_tone|icon)$/, '')
  return Object.prototype.hasOwnProperty.call(CODEPOINTS, base) ? CODEPOINTS[base] : undefined
}
