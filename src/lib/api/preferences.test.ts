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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPreferences,
  getPreferenceSection,
  patchPreferenceSection,
  runPreferenceAction,
} from './preferences'
import apiClient from './client'
import { isUiApiFeatureSupported } from './ui-api-extensions'
import { preferencesFixture } from '@/mocks/fixtures/preferences'

vi.mock('./client', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('./ui-api-extensions', () => ({ isUiApiFeatureSupported: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isUiApiFeatureSupported).mockResolvedValue(true)
})

describe('preferences API', () => {
  it('skips the call on a server without the preferences feature', async () => {
    vi.mocked(isUiApiFeatureSupported).mockResolvedValue(false)
    expect(await getPreferences()).toEqual({ sections: [] })
    expect(isUiApiFeatureSupported).toHaveBeenCalledWith('preferences')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
  it('POSTs encoded action names and the exact row/input body', async () => {
    const result = { section: preferencesFixture.sections[0], secrets: [] }
    const body = { rowKey: 'row:1', values: { description: 'Script' } }
    vi.mocked(apiClient.post).mockResolvedValue(result)
    expect(await runPreferenceAction('a/b', 'rotate/now', body)).toBe(result)
    expect(apiClient.post).toHaveBeenCalledWith('/preferences/a%2Fb/actions/rotate%2Fnow', body)
    await runPreferenceAction('tokens', 'refresh', {})
    expect(apiClient.post).toHaveBeenLastCalledWith('/preferences/tokens/actions/refresh', {})
  })
  it('loads the section index through the shared client', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(preferencesFixture)
    expect(await getPreferences()).toBe(preferencesFixture)
    expect(apiClient.get).toHaveBeenCalledWith('/preferences')
  })
  it('encodes section names when loading', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(preferencesFixture.sections[0])
    expect(await getPreferenceSection('a/b')).toBe(preferencesFixture.sections[0])
    expect(apiClient.get).toHaveBeenCalledWith('/preferences/a%2Fb')
  })
  it('sends the exact partial PATCH body and returns the reloaded section', async () => {
    const patch = {
      values: { digestHour: 12 },
      lists: { categories: [{ key: 'SYSTEM', values: { inApp: false } }] },
    }
    vi.mocked(apiClient.patch).mockResolvedValue(preferencesFixture.sections[0])
    expect(await patchPreferenceSection('a/b', patch)).toBe(preferencesFixture.sections[0])
    expect(apiClient.patch).toHaveBeenCalledWith('/preferences/a%2Fb', patch)
  })
})
