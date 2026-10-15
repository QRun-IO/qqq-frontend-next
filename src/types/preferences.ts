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

/** @file The signed-in user's metadata-driven preference sections (UI API v1). */
import type { QFieldMetaData, QIcon } from './metadata'
import type { QPossibleValue } from './records'

/** All visible sections, in backend order. */
export interface PreferencesResponse {
  sections: PreferenceSection[]
}

/** A provider's section, including current values and inline enum sources. */
export interface PreferenceSection {
  name: string
  label: string
  icon?: QIcon | null
  description?: string | null
  order?: number
  appName?: string | null
  showInUserMenu?: boolean
  actions?: PreferenceAction[]
  fields: QFieldMetaData[]
  values: Record<string, unknown>
  lists: PreferenceList[]
  possibleValues: Record<string, QPossibleValue[]>
}

/** Fixed rows supplied by a section provider. */
export interface PreferenceList {
  name: string
  label: string
  description?: string | null
  rowLabel: string
  fields: QFieldMetaData[]
  rows: PreferenceRow[]
}

/** One independently editable row; editability may differ from other rows. */
export interface PreferenceRow {
  key: string
  label: string
  description?: string | null
  values: Record<string, unknown>
  readOnlyFields?: string[]
  readOnlyReason?: string | null
  actionNames?: string[] | null
}

/** A provider action, rendered at its declared scope. */
export interface PreferenceAction {
  name: string
  label: string
  icon?: QIcon | null
  description?: string | null
  scope: 'SECTION' | 'LIST' | 'ROW'
  listName?: string | null
  confirmationText?: string | null
  isDestructive?: boolean
  inputFields?: QFieldMetaData[]
  order?: number
}

/** Identity and list selection always come from the server metadata/session. */
export interface PreferenceActionRequest {
  rowKey?: string
  values?: Record<string, unknown>
}

/** Ephemeral display data: never persist or put in a query/mutation cache. */
export interface PreferenceSecret {
  label: string
  value: string
  masked?: string
  usageText?: string
}

/** Only section is safe to retain in the preferences cache. */
export interface PreferenceActionResponse {
  section: PreferenceSection
  message?: string
  secrets?: PreferenceSecret[]
  focusRowKey?: string
}

/** Only changed scalar values and changed fields of explicitly named rows. */
export interface PreferenceSectionPatch {
  values?: Record<string, unknown>
  lists?: Record<string, Array<{ key: string; values: Record<string, unknown> }>>
}
