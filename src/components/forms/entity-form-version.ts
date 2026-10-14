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
 * @file entity-form-version — which record version an edit sends (collaboration conflict checks).
 */

import type { QRecord, QTableMetaData } from '@/types'
import { recordVersion } from '@/lib/utils/record-version'

/**
 * The record version an edit sends, only for tables with collaboration realtime (presence or
 * follow). Other tables keep the established save payload and no version check.
 *
 * @param table - Table metadata.
 * @param record - Loaded record.
 * @returns The version, or undefined.
 */
export function recordVersionForEdit(table: QTableMetaData, record?: QRecord): string | undefined {
  const features = table.recordFeatures?.features ?? []
  return features.includes('PRESENCE') || features.includes('FOLLOW') ? recordVersion(table, record) : undefined
}
