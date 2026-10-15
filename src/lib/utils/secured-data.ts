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

/** @file Field access rules shared by renderers, filters and write payloads. */
import type { QFieldMetaData, QQueryFilter } from '@/types'

type AccessField = Pick<QFieldMetaData, 'accessTier' | 'allowedFilterOperators' | 'isSortable'>

/**
 * Whether the server restricts this field.
 * @param field - Server field access metadata.
 * @returns Whether the field is restricted.
 */
export function isRestricted(field: AccessField | undefined): boolean {
  return field?.accessTier === 'MASKED' || field?.accessTier === 'REVEALABLE'
}

/**
 * Operators a restricted field permits; undefined means unrestricted.
 * @param field - Server field access metadata.
 * @returns Allowed operators, or undefined for an unrestricted field.
 */
export function allowedOperators(field: AccessField): readonly string[] | undefined {
  if (field.accessTier === 'MASKED') return []
  if (field.accessTier === 'REVEALABLE')
    return (field.allowedFilterOperators ?? ['EQUALS', 'IN']).filter(
      (op) => op === 'EQUALS' || op === 'IN'
    )
  return field.allowedFilterOperators
}

/**
 * Whether a field may be sorted or grouped.
 * @param field - Server field access metadata.
 * @returns Whether sorting is permitted.
 */
export function canSortField(field: AccessField | undefined): boolean {
  return !isRestricted(field) && field?.isSortable !== false
}

/**
 * Remove restricted fields even if a form adjuster or unchanged defaults supplied them.
 * @param values - Proposed record values.
 * @param fields - Current field metadata.
 * @returns Values with restricted fields removed.
 */
export function writableValues(
  values: Record<string, unknown>,
  fields: Record<string, AccessField>
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([name]) => !isRestricted(fields[name])))
}

/**
 * Drop explicitly disallowed criteria recursively; missing metadata preserves legacy behavior.
 * @param filter - Restored or proposed filter.
 * @param fieldFor - Resolves base and joined field metadata.
 * @returns Filter containing only permitted criteria and sorts.
 */
export function sanitizeAccessFilter(
  filter: QQueryFilter,
  fieldFor: (name: string) => QFieldMetaData | undefined
): QQueryFilter {
  const criteria = filter.criteria.filter((criterion) => {
    const field = fieldFor(criterion.fieldName)
    const allowed = field ? allowedOperators(field) : undefined
    if (
      allowed &&
      (!allowed.includes(criterion.operator) || criterion.fieldFunction || criterion.otherFieldName)
    )
      return false
    if (
      field?.accessTier === 'REVEALABLE' &&
      (criterion.values.length > (criterion.operator === 'IN' ? 25 : 1) ||
        criterion.values.some((value) => typeof value === 'object' && value !== null))
    )
      return false
    return !criterion.otherFieldName || canSortField(fieldFor(criterion.otherFieldName))
  })
  return {
    ...filter,
    criteria,
    ...(filter.orderBys
      ? { orderBys: filter.orderBys.filter((sort) => canSortField(fieldFor(sort.fieldName))) }
      : {}),
    ...(filter.subFilters
      ? {
          subFilters: filter.subFilters
            .map((sub) => sanitizeAccessFilter(sub, fieldFor))
            .filter(
              (sub, index) =>
                sub.criteria.length ||
                sub.subFilters?.length ||
                (!filter.subFilters![index].criteria.length &&
                  !filter.subFilters![index].subFilters?.length)
            ),
        }
      : {}),
  }
}

/**
 * Seconds remaining, computed from an absolute server expiry.
 * @param expiresAt - Server expiry as an ISO instant.
 * @param now - Current epoch milliseconds.
 * @returns Nonnegative seconds remaining.
 */
export function remainingSeconds(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) || 0
}

/**
 * Accessible minute/second countdown text.
 * @param seconds - Seconds remaining.
 * @returns Minute and second text.
 */
export function countdownText(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Identity of one record field's session-only mask snapshot.
 * @param target - Table, record and field identity.
 * @returns A collision-free key, normalizing string and numeric record ids.
 */
export function securedValueKey(target: {
  tableName: string
  primaryKey: string | number
  fieldName: string
}): string {
  return JSON.stringify([target.tableName, String(target.primaryKey), target.fieldName])
}
