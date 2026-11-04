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

/** @file Validates backend recovery navigation and pins it to the current record. */
import type { CollaborationRecord } from '@/types/collaboration'
import type { QFilterCriteria } from '@/types'
import { builtInViewHref } from './built-in-views'

/** Tests a JSON object without interpreting any executable or URL content.
 * @param value - Untrusted metadata value.
 * @returns Whether it is an object with named fields.
 */
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Validates the small literal/current-user criterion contract used by recovery views.
 * @param value - Untrusted metadata criterion.
 * @returns Whether it matches the supported declarative filter shape.
 */
function criterion(value: unknown): value is QFilterCriteria {
  if (!object(value) || typeof value.fieldName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.fieldName) ||
    !['EQUALS', 'IN'].includes(String(value.operator)) || !Array.isArray(value.values) || value.values.length < 1 || value.values.length > 20 ||
    value.otherFieldName != null || value.fieldFunction != null) return false
  return value.values.every((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' ||
    (object(item) && item.type === 'CurrentUser' && Object.keys(item).length === 1 &&
      value.fieldName === 'createdByUserId' && value.operator === 'EQUALS' && (value.values as unknown[]).length === 1))
}

/** Builds a native table link, keeping server criteria and canonical source pins.
 * @param metadata - Optional extensible attachment recovery metadata.
 * @param record - Current record identity; never interpreted as filter JSON.
 * @returns Label and internal href, or null when metadata is absent/malformed.
 */
export function attachmentRecoveryView(metadata: unknown, record: CollaborationRecord): { label: string; href: string } | null {
  if (!object(metadata) || typeof metadata.tableName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(metadata.tableName) ||
    typeof metadata.label !== 'string' || !metadata.label.trim() || metadata.label.length > 200 || !object(metadata.filter)) return null
  const filter = metadata.filter
  if (filter.booleanOperator !== 'AND' || !Array.isArray(filter.criteria) || filter.criteria.length < 1 || filter.criteria.length > 20 ||
    !filter.criteria.every(criterion) || (filter.subFilters != null && (!Array.isArray(filter.subFilters) || filter.subFilters.length > 0)) ||
    filter.subFilterSetOperator != null) return null
  return {
    label: metadata.label,
    href: builtInViewHref(metadata.tableName, {
      booleanOperator: 'AND',
      criteria: [
        ...filter.criteria,
        { fieldName: 'tableName', operator: 'EQUALS', values: [record.table] },
        { fieldName: 'recordId', operator: 'EQUALS', values: [record.pk] },
      ],
    }),
  }
}
