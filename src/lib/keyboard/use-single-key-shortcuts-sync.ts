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
 * @file Loads and saves the user's single-key shortcut setting: the server's Keyboard preference
 * section when it is registered, otherwise the browser's stored choice. The section is found in
 * the preferences index (shared with the account menu), so a server without it, or without
 * preferences at all, gets no request that fails.
 */

'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { PreferenceSection, PreferencesResponse } from '@/types/preferences'
import { getPreferences, patchPreferenceSection } from '@/lib/api/preferences'
import { queryKeys } from '@/lib/query-client'
import {
  KEYBOARD_PREFERENCE_SECTION,
  SINGLE_KEY_SHORTCUTS_FIELD,
  readLocalSingleKeyShortcuts,
  setSingleKeyShortcutsEnabled,
  useSingleKeyShortcutsEnabled,
  writeLocalSingleKeyShortcuts,
} from './single-key-shortcuts'

/**
 * The Keyboard section in a preferences index, if the server registers it.
 *
 * @param index - The preferences index.
 * @returns The section, or undefined.
 */
function keyboardSection(index: PreferencesResponse | undefined): PreferenceSection | undefined {
  return index?.sections?.find((section) => section.name === KEYBOARD_PREFERENCE_SECTION)
}

/**
 * Keeps the effective single-key shortcut setting current for the signed-in user.
 *
 * @param enabled - Load only once the user is signed in.
 * @returns Whether the server registers the Keyboard section (`undefined` while unknown).
 */
export function useSingleKeyShortcutsSync(enabled: boolean): boolean | undefined {
  const index = useQuery({
    queryKey: queryKeys.preferencesIndex(),
    queryFn: getPreferences,
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const section = keyboardSection(index.data)
  const serverValue = section?.values?.[SINGLE_KEY_SHORTCUTS_FIELD]

  useEffect(() => {
    if (section) {
      setSingleKeyShortcutsEnabled(serverValue !== false)
    } else if (index.isSuccess || index.isError || !enabled) {
      setSingleKeyShortcutsEnabled(readLocalSingleKeyShortcuts())
    }
  }, [section, serverValue, index.isSuccess, index.isError, enabled])

  if (section) return true
  if (index.isSuccess || index.isError) return false
  return undefined
}

/**
 * The switch for the setting: saves to the server's Keyboard section when it is registered (it
 * follows the user), otherwise to this browser.
 *
 * @returns The current value, a setter, and whether a save is in flight.
 */
export function useSingleKeyShortcutsToggle(): { enabled: boolean; setEnabled: (value: boolean) => void; saving: boolean } {
  const client = useQueryClient()
  const enabled = useSingleKeyShortcutsEnabled()
  const serverHasSection = Boolean(keyboardSection(client.getQueryData<PreferencesResponse>(queryKeys.preferencesIndex())))
  const save = useMutation({
    mutationFn: (value: boolean) => patchPreferenceSection(KEYBOARD_PREFERENCE_SECTION, { values: { [SINGLE_KEY_SHORTCUTS_FIELD]: value } }),
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.preferenceSection(saved.name), saved)
      client.setQueryData<PreferencesResponse>(queryKeys.preferencesIndex(), (current) =>
        current ? { ...current, sections: current.sections.map((section) => (section.name === saved.name ? saved : section)) } : current)
    },
    onError: (_error, value) => setSingleKeyShortcutsEnabled(!value),
  })
  const setEnabled = (value: boolean) => {
    if (serverHasSection) {
      setSingleKeyShortcutsEnabled(value)
      save.mutate(value)
    } else {
      writeLocalSingleKeyShortcuts(value)
    }
  }
  return { enabled, setEnabled, saving: save.isPending }
}
