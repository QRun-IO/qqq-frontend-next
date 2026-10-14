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

/** @file Role precedence and tooltip summaries. */
import { describe, expect, it } from 'vitest'

import {
  APP_SCREEN_HELP_ROLES,
  TABLE_ACTION_MENU_HELP_ROLES,
  helpSummary,
  selectSlotHelp,
  selectSlotHelpContent,
} from './help-utils'

describe('help selection', () => {
  it('selects the most specific slot role, then ALL_SCREENS, excluding other screens', () => {
    const general = { content: 'General', roles: ['ALL_SCREENS'] }
    const app = { content: 'Application', roles: ['APP_SCREEN'] }
    const menu = { content: 'Action', roles: ['TABLE_ACTION_MENU'] }
    const slots = { help: [general, app, menu] }
    expect(selectSlotHelp(slots, 'help', APP_SCREEN_HELP_ROLES)).toBe(app)
    expect(selectSlotHelp(slots, 'help', TABLE_ACTION_MENU_HELP_ROLES)).toBe(menu)
    expect(selectSlotHelp({ help: [general] }, 'help', TABLE_ACTION_MENU_HELP_ROLES)).toBe(general)
    expect(selectSlotHelp({ help: [app] }, 'help', TABLE_ACTION_MENU_HELP_ROLES)).toBeUndefined()
    expect(selectSlotHelp(slots, 'missing', APP_SCREEN_HELP_ROLES)).toBeUndefined()
  })
  it('keeps summary-only entries and the existing author key suffix', () => {
    expect(selectSlotHelp({ help: [{ summary: 'Short' }] }, 'help', APP_SCREEN_HELP_ROLES)).toEqual(
      { summary: 'Short' }
    )
    expect(
      selectSlotHelpContent(undefined, APP_SCREEN_HELP_ROLES, 'app:owned;slot:help', true)?.content
    ).toBe('[app:owned;slot:help]')
  })
  it('uses explicit summaries or derives a plain first sentence from long content', () => {
    expect(helpSummary({ summary: ' Short. ', content: 'Longer.' })).toBe('Short.')
    expect(helpSummary({ content: 'First sentence. Second sentence.' })).toBe('First sentence.')
    expect(
      helpSummary({ content: 'Use a **short** [title](/guide). More detail.', format: 'MARKDOWN' })
    ).toBe('Use a short title.')
    expect(
      helpSummary({
        contentAsHtml:
          '<p>Use <strong>names</strong> &amp; labels.</p><script>alert(1)</script><p>More.</p>',
      })
    ).toBe('Use names & labels.')
  })
})
