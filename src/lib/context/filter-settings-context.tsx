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
 * @file filter-settings-context — instance settings that shape the query screen's filter
 * inputs (weekday criteria, the "Bulk Add Filter Values" help slots), provided once by the
 * query screen and read by every filter row and quick filter.
 */

'use client'

import { createContext, useContext } from 'react'

import type { QHelpContent, QInstance } from '@/types'
import { DEFAULT_WEEKDAY_CRITERIA_SETTINGS, weekdayCriteriaSettings, type WeekdayCriteriaSettings } from '@/lib/utils/filter-utils'

/** Settings for filter inputs. */
export interface FilterSettings {
  /** Weekday criteria settings (Material `weekdayCriteriaSettings`). */
  weekday: WeekdayCriteriaSettings
  /** Instance-level help content by slot (`bulkAddFilterValues`, `bulkAddFilterValuesPossibleValueSource`). */
  helpContents?: Record<string, QHelpContent[]>
}

const FilterSettingsContext = createContext<FilterSettings>({ weekday: DEFAULT_WEEKDAY_CRITERIA_SETTINGS })

/** Provides filter settings to the filter inputs below it. */
export const FilterSettingsProvider = FilterSettingsContext.Provider

/**
 * Reads the filter settings (Material defaults when none are provided).
 *
 * @returns The settings.
 */
export function useFilterSettings(): FilterSettings {
  return useContext(FilterSettingsContext)
}

/**
 * Builds the filter settings from instance metadata.
 *
 * @param metaData - Instance metadata, when loaded.
 * @returns The settings.
 */
export function filterSettingsFrom(metaData: Pick<QInstance, 'supplementalInstanceMetaData' | 'helpContents'> | undefined): FilterSettings {
  return { weekday: weekdayCriteriaSettings(metaData), helpContents: metaData?.helpContents }
}
