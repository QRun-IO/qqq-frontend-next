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
 * section when it is registered, otherwise the browser's stored choice.
 */

'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getPreferenceSection, patchPreferenceSection } from '@/lib/api/preferences'
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
 * Keeps the effective single-key shortcut setting current for the signed-in user.
 *
 * @param enabled - Load only once the user is signed in.
 * @returns Whether the server registers the Keyboard section (`undefined` while unknown).
 */
export function useSingleKeyShortcutsSync(enabled: boolean): boolean | undefined {
  const section = useQuery({
    queryKey: queryKeys.preferenceSection(KEYBOARD_PREFERENCE_SECTION),
    queryFn: () => getPreferenceSection(KEYBOARD_PREFERENCE_SECTION),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const serverValue = section.data?.values?.[SINGLE_KEY_SHORTCUTS_FIELD]

  useEffect(() => {
    if (section.isSuccess) {
      setSingleKeyShortcutsEnabled(serverValue !== false)
    } else if (section.isError || !enabled) {
      setSingleKeyShortcutsEnabled(readLocalSingleKeyShortcuts())
    }
  }, [section.isSuccess, section.isError, serverValue, enabled])

  if (section.isSuccess) return true
  if (section.isError) return false
  return undefined
}

/**
 * The switch for the setting: saves to the server's Keyboard section when it is registered (it
 * follows the user), otherwise to this browser.
 *
 * @returns The current value and a setter.
 */
export function useSingleKeyShortcutsToggle(): { enabled: boolean; setEnabled: (value: boolean) => void; saving: boolean } {
  const client = useQueryClient()
  const enabled = useSingleKeyShortcutsEnabled()
  const serverHasSection = client.getQueryState(queryKeys.preferenceSection(KEYBOARD_PREFERENCE_SECTION))?.status === 'success'
  const save = useMutation({
    mutationFn: (value: boolean) => patchPreferenceSection(KEYBOARD_PREFERENCE_SECTION, { values: { [SINGLE_KEY_SHORTCUTS_FIELD]: value } }),
    onSuccess: (saved) => client.setQueryData(queryKeys.preferenceSection(saved.name), saved),
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
