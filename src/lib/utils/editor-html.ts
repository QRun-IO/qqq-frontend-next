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
 * @file Normalization of HTML produced by a contentEditable editor.
 */

const INLINE_TAG = '(?:a|b|strong|i|em|u|span)'

/**
 * A single non-breaking space that an engine inserted only to keep a typed space visible while
 * editing: between two words, or between a word and an inline formatting tag. Firefox stores
 * "Plain&nbsp;<b>Strong</b>" where Chromium stores "Plain <b>Strong</b>". Runs of spaces and
 * spaces at the start or end of the text or next to a block boundary keep their &nbsp;.
 */
const EDITING_NBSP = new RegExp(
  `(?<=[^\\s\\u00a0>;]|</${INLINE_TAG}>)(?:&nbsp;|\\u00a0)(?=[^\\s\\u00a0<&]|</?${INLINE_TAG}\\b)`,
  'g'
)

/**
 * Normalizes editor HTML so the stored value does not depend on the browser engine.
 *
 * @param html - The editor's innerHTML.
 * @returns The HTML with editing-only non-breaking spaces replaced by plain spaces.
 */
export function normalizeEditorHtml(html: string): string {
  return html.replace(EDITING_NBSP, ' ')
}
