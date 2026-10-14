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

/** @file Current-user preferences through the shared authenticated UI API client. */
import type {
  PreferencesResponse,
  PreferenceSection,
  PreferenceSectionPatch,
  PreferenceActionRequest,
  PreferenceActionResponse,
} from '@/types/preferences'
import apiClient from './client'
import { isUiApiFeatureSupported } from './ui-api-extensions'

/** Whether the server lists the core `preferences` feature (`GET /version`, shared discovery).
 * Older servers have no preferences operations, so the UI must not call them there.
 * @returns True when the server supports preferences.
 */
export function arePreferencesSupported(): Promise<boolean> {
  return isUiApiFeatureSupported('preferences')
}

/** Loads every visible preference section; none on a server without the preferences feature.
 * @returns Ordered sections with metadata and values.
 */
export async function getPreferences(): Promise<PreferencesResponse> {
  if (!(await arePreferencesSupported())) return { sections: [] }
  return apiClient.get<PreferencesResponse>('/preferences')
}

/** Loads one visible section.
 * @param name - Section name from metadata.
 * @returns The section with current values.
 */
export function getPreferenceSection(name: string): Promise<PreferenceSection> {
  return apiClient.get<PreferenceSection>(`/preferences/${encodeURIComponent(name)}`)
}

/** Saves a partial change to the signed-in user's section.
 * @param name - Section name from metadata.
 * @param patch - Only the changed fields and rows.
 * @returns The reloaded section.
 */
export function patchPreferenceSection(
  name: string,
  patch: PreferenceSectionPatch
): Promise<PreferenceSection> {
  return apiClient.patch<PreferenceSection>(`/preferences/${encodeURIComponent(name)}`, patch)
}

/** Runs a registered action without retaining its one-time result.
 * @param section - Visible section name.
 * @param action - Registered action name.
 * @param request - Optional row key and action input values.
 * @returns Reloaded section and ephemeral action result.
 */
export function runPreferenceAction(
  section: string,
  action: string,
  request: PreferenceActionRequest
): Promise<PreferenceActionResponse> {
  return apiClient.post<PreferenceActionResponse>(
    `/preferences/${encodeURIComponent(section)}/actions/${encodeURIComponent(action)}`,
    request
  )
}
