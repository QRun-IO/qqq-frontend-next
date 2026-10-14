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

import { expect, it } from 'vitest'
import { preferencesFixture } from '@/mocks/fixtures/preferences'
import { preferenceDefaults, preferencePatch, preferenceSlots } from './preference-values'

it('never submits hidden or locked fields and safely identifies punctuation-bearing row keys', () => {
  const section = structuredClone(preferencesFixture.sections[0])
  section.fields[2].isHidden = true
  const slots = preferenceSlots(section)
  const values = preferenceDefaults(slots)
  values.scalar2 = 'UTC'
  values.list0row1field0 = false
  values.list1row0field0 = false
  expect(preferencePatch(slots, values)).toEqual({
    lists: { subscriptions: [{ key: 'order:42', values: { enabled: false } }] },
  })
})

it('retains unchanged timestamp precision and sends UTC instants and explicit null when edited', () => {
  const section = structuredClone(preferencesFixture.sections[0])
  section.values.pausedUntil = '2026-11-01T07:30:00.123Z'
  const slots = preferenceSlots(section)
  const values = preferenceDefaults(slots)
  expect(preferencePatch(slots, values)).toEqual({})
  values.scalar0 = '2026-12-01T10:00:00'
  expect(preferencePatch(slots, values).values?.pausedUntil).toMatch(/Z$/)
  values.scalar0 = ''
  expect(preferencePatch(slots, values)).toEqual({ values: { pausedUntil: null } })
})

it('does not send changes after reverting a numeric enum selection to its original ID', () => {
  const slots = preferenceSlots(preferencesFixture.sections[0])
  const values = preferenceDefaults(slots)
  values.scalar1 = '9'
  expect(preferencePatch(slots, values)).toEqual({})
})
