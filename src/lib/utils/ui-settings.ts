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
 * @file ui-settings — reads instance UI settings from UI API 1.6.0 `uiSettings`, falling back,
 * setting by setting, to the deprecated `materialDashboard` supplemental metadata.
 */

import type { QInstance } from '@/types'

type WithSupplemental = Pick<QInstance, 'supplementalInstanceMetaData'> | undefined

/**
 * Narrows a settings value to a plain object.
 *
 * @param value - The raw value.
 * @returns The object, or undefined.
 */
function settingsObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/**
 * Whether the instance sends any UI settings (client-neutral or Material).
 *
 * @param metaData - Instance metadata, when loaded.
 * @returns True when `uiSettings` or `materialDashboard` is present.
 */
export function hasUiSettings(metaData: WithSupplemental): boolean {
  const supplemental = metaData?.supplementalInstanceMetaData
  return Boolean(settingsObject(supplemental?.uiSettings) ?? settingsObject(supplemental?.materialDashboard))
}

/**
 * Reads one instance UI setting: `uiSettings[key]` when it is set there, else the deprecated
 * `materialDashboard[key]`.
 *
 * @param metaData - Instance metadata, when loaded.
 * @param key - The setting's name.
 * @returns The value, or undefined when neither source sets it.
 */
export function uiSetting(metaData: WithSupplemental, key: string): unknown {
  const supplemental = metaData?.supplementalInstanceMetaData
  const settings = settingsObject(supplemental?.uiSettings)
  if (settings && settings[key] !== undefined) return settings[key]
  return settingsObject(supplemental?.materialDashboard)?.[key]
}

/**
 * The configured row limit of "Copy full query values", if any.
 *
 * @param metaData - Instance metadata, when loaded.
 * @returns The setting's raw value (callers validate it).
 */
export function copyFullQueryValuesLimitSetting(metaData: WithSupplemental): unknown {
  return uiSetting(metaData, 'queryScreenCopyFullQueryColumnValuesLimit')
}
