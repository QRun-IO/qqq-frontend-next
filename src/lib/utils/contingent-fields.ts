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

/** @file Pure metadata and value helpers for contingent possible-value fields. */

import type { QFieldMetaData, QQueryFilter } from '@/types'

/** The additive metadata needed to resolve dependencies, including legacy filters. */
export type ContingentField = Pick<QFieldMetaData, 'possibleValueSourceDependsOn' | 'possibleValueSourceDependencyBehavior' | 'possibleValueSourceFilter'>

/**
 * Read explicit dependencies, or discover input references in legacy criteria values.
 * @param field - Field metadata.
 * @returns Unique dependency names in declaration order; processValues references are ignored.
 */
export function getDependencies(field: ContingentField): string[] {
  if (field.possibleValueSourceDependsOn !== undefined) return [...new Set(field.possibleValueSourceDependsOn)]
  const names = new Set<string>()
  const scanValue = (value: unknown) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/\$\{input\.([^}]+)\}/g)) names.add(match[1])
    } else if (Array.isArray(value)) value.forEach(scanValue)
    else if (value && typeof value === 'object') Object.values(value).forEach(scanValue)
  }
  const scanFilter = (filter: Partial<QQueryFilter>) => {
    for (const criterion of filter.criteria ?? []) scanValue(criterion.values)
    for (const sub of filter.subFilters ?? []) scanFilter(sub)
  }
  if (field.possibleValueSourceFilter) scanFilter(field.possibleValueSourceFilter)
  return [...names]
}

/**
 * Resolve the missing-input policy, defaulting unknown future values safely.
 * @param field - Field metadata.
 * @returns The supported policy.
 */
export function dependencyBehavior(field: ContingentField): 'DISABLE_UNTIL_SET' | 'SHOW_ALL_UNTIL_SET' {
  return field.possibleValueSourceDependencyBehavior === 'SHOW_ALL_UNTIL_SET' ? 'SHOW_ALL_UNTIL_SET' : 'DISABLE_UNTIL_SET'
}

/**
 * Whether a dependency lacks a value; zero and false are valid values.
 * @param value - Current field value.
 * @returns Whether the value is missing.
 */
export function isMissingDependencyValue(value: unknown): boolean {
  return value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)
}

/**
 * Find missing dependencies with labels from the same form's metadata.
 * @param field - Dependent field.
 * @param values - Current form values (only enabled values for bulk edit).
 * @param fieldsByName - All fields on the form, including fields in other sections.
 * @returns Missing names and their user-facing labels.
 */
export function missingDependencies(field: ContingentField, values: Record<string, unknown>, fieldsByName: Record<string, QFieldMetaData> = {}): Array<{ name: string; label: string }> {
  return getDependencies(field).filter((name) => isMissingDependencyValue(values[name]))
    .map((name) => ({ name, label: fieldsByName[name]?.label ?? name }))
}

/**
 * Select only the inputs that can change a contingent field's choices.
 * @param field - Dependent field.
 * @param values - Current form values.
 * @returns The dependency subset, including undefined for unset inputs.
 */
export function dependencyValues(field: ContingentField, values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(getDependencies(field).map((name) => [name, values[name]]))
}

/**
 * Extract literal equality/IN inputs that constrain a query. OR groups and expressions
 * cannot supply a definite input and are ignored; conflicting AND criteria are intersected.
 * @param field - Dependent field.
 * @param filter - Current filter, including nested groups.
 * @returns Dependency inputs for a filter-context possible-values request.
 */
export function filterDependencyValues(field: ContingentField, filter: Partial<QQueryFilter> | undefined): Record<string, unknown> {
  const dependencies = new Set(getDependencies(field))
  const found = new Map<string, unknown[]>()
  const lists = new Set<string>()
  const scan = (group: Partial<QQueryFilter>) => {
    if (group.booleanOperator === 'OR') return
    for (const criterion of group.criteria ?? []) {
      if (!dependencies.has(criterion.fieldName) || criterion.fieldFunction) continue
      if (criterion.operator !== 'IN' && !(criterion.operator === 'EQUALS' && criterion.values?.length === 1)) continue
      const values = criterion.values ?? []
      if (!values.length || values.some((value) => isMissingDependencyValue(value) || typeof value === 'object')) continue
      if (criterion.operator === 'IN') lists.add(criterion.fieldName)
      const previous = found.get(criterion.fieldName)
      found.set(criterion.fieldName, previous ? previous.filter((value) => values.some((v) => String(v) === String(value))) : values)
    }
    for (const sub of group.subFilters ?? []) scan(sub)
  }
  if (filter) scan(filter)
  return Object.fromEntries([...found].map(([name, values]) => [name, !lists.has(name) && values.length === 1 ? values[0] : values]))
}
