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

/** @file Bounded, exact named association drafts for a single recursive insert. */

import type { QRecord, QRecordInput, QTableMetaData } from '@/types'
import { adornmentString } from './adornment-utils'
import { defaultValuesForCopy, zodSchemaFromTableMetadata, validateCopyPasswords } from './zod-from-metadata'

export const MAX_COPY_DEPTH = 64
export const MAX_COPY_DESCENDANTS = 1000

/** One editable draft per named path; aliases intentionally do not share identity. */
export interface CopyNode {
  path: string
  table: QTableMetaData
  values: Record<string, unknown>
  fields: string[]
  companions: Record<string, unknown>
  groups: Record<string, CopyNode[]>
}

/**
 * Bound actual source data before requesting its deduplicated full table metadata.
 * @param source - Expanded API record.
 * @returns Exact table names, including the root.
 */
export function copyTableNames(source: QRecord): string[] {
  const names = new Set<string>()
  let count = -1
  /**
   * Inspect every actual descendant before metadata fan-out.
   * @param record - Current source node.
   * @param depth - Current association depth.
   */
  function visit(record: QRecord, depth: number) {
    if (depth > MAX_COPY_DEPTH) throw new Error(`Full copy exceeds ${MAX_COPY_DEPTH} association levels.`)
    if (++count > MAX_COPY_DESCENDANTS) throw new Error(`Full copy exceeds ${MAX_COPY_DESCENDANTS} associated records.`)
    if (!record || typeof record.tableName !== 'string' || !record.values || Array.isArray(record.values)) throw new Error('Full copy source is invalid.')
    if (record.errors?.length) throw new Error('Full copy source contains record errors.')
    names.add(record.tableName)
    for (const records of Object.values(record.associatedRecords ?? {})) {
      if (!Array.isArray(records)) throw new Error('Full copy association source is invalid.')
      for (const child of records) visit(child, depth + 1)
    }
  }
  visit(source, 0)
  return [...names]
}

/**
 * Prepare fresh editable values and exact groups without mutating source or metadata.
 * @param table - Full root metadata.
 * @param source - Complete expanded source.
 * @param tables - Full metadata for every nonempty source table.
 * @returns A draft tree; missing data is a blocking error, never an omitted branch.
 */
export function prepareCopyTree(table: QTableMetaData, source: QRecord, tables: Record<string, QTableMetaData>): CopyNode {
  copyTableNames(source)
  /**
   * Resolve one source node against its exact full table metadata.
   * @param active - Personalized table.
   * @param record - Source values and named groups.
   * @param path - Unambiguous name/index sequence.
   * @param assigned - Fields assigned from the new parent by the backend.
   * @returns Independent form defaults and groups.
   */
  function visit(active: QTableMetaData, record: QRecord, path: (string | number)[], assigned: string[]): CopyNode {
    if (!active.fields || !active.sections || record.tableName !== active.name) throw new Error('Full copy metadata is unavailable.')
    if (!active.readPermission || !active.insertPermission) throw new Error(`Cannot read and create ${active.label} records for full copy.`)
    const fields = Object.values(active.fields).filter(field => field.isEditable && !field.isHidden && !assigned.includes(field.name)).map(field => field.name)
    for (const name of fields) {
      if (name !== active.primaryKeyField && !Object.prototype.hasOwnProperty.call(record.values, name)) throw new Error(`Full copy source value for ${active.fields[name].label} is unavailable.`)
    }
    const defaults = defaultValuesForCopy(active, record.values)
    const values = Object.fromEntries(fields.map(name => [name, Array.isArray(defaults[name]) ? [...defaults[name] as unknown[]] : defaults[name]]))
    const companions: Record<string, unknown> = {}
    for (const name of fields) {
      if (active.fields[name].type !== 'BLOB') continue
      const companion = adornmentString(active.fields[name], 'FILE_DOWNLOAD', 'fileNameField')
      if (companion && !assigned.includes(companion) && companion !== active.primaryKeyField) {
        if (!active.fields[companion] || active.fields[companion].isHidden || !Object.prototype.hasOwnProperty.call(record.values, companion)) throw new Error('Full copy file metadata is unavailable.')
        if (!fields.includes(companion)) companions[companion] = record.values[companion]
      }
    }
    const groups: Record<string, CopyNode[]> = Object.create(null)
    const associations = active.associations ?? []
    const declared = new Set(associations.map(association => association.name))
    if (declared.size !== associations.length) throw new Error('Full copy association metadata is ambiguous.')
    for (const name of Object.keys(record.associatedRecords ?? {})) {
      if (!declared.has(name)) throw new Error(`Full copy source contains unknown association ${name}.`)
    }
    for (const association of associations) {
      const records = record.associatedRecords?.[association.name]
      if (!Array.isArray(records)) throw new Error(`Full copy source for ${association.name} is unavailable.`)
      if (!records.length) { groups[association.name] = []; continue }
      const childTable = tables[association.associatedTableName]
      if (!childTable) throw new Error(`Full copy metadata for ${association.associatedTableName} is unavailable.`)
      const join = association.join
      const forward = join.leftTable === active.name && join.rightTable === childTable.name
      const reverse = !forward && join.rightTable === active.name && join.leftTable === childTable.name
      if ((!forward && !reverse) || !join.joinOns?.length) throw new Error(`Full copy join for ${association.name} is unavailable.`)
      const childFields = join.joinOns.map(pair => {
        const parentField = forward ? pair.leftField : pair.rightField
        const childField = forward ? pair.rightField : pair.leftField
        if (!active.fields[parentField] || !childTable.fields[childField]) throw new Error(`Full copy join fields for ${association.name} are unavailable.`)
        if (parentField !== active.primaryKeyField && !assigned.includes(parentField) && (!fields.includes(parentField) || record.values[parentField] == null)) throw new Error(`Full copy relationship value ${parentField} cannot be recreated.`)
        return childField
      })
      groups[association.name] = records.map((child, index) => visit(childTable, child, [...path, association.name, index], childFields))
    }
    return { path: JSON.stringify(path), table: active, values, fields, companions, groups }
  }
  return visit(table, source, [], [])
}

/**
 * Validate current descendant edits and build only the exact recursive input tree.
 * @param root - Prepared source tree.
 * @param edits - Values keyed by unambiguous named path.
 * @param rootValues - Current validated root values, when saving.
 * @returns Named child inputs; source primary keys and assigned links remain absent.
 */
export function copyTreePayload(root: CopyNode, edits: Record<string, Record<string, unknown>>, rootValues?: Record<string, unknown>): Record<string, QRecordInput[]> {
  const pendingKey = Symbol('key assigned by insert')
  /**
   * Validate drafts and prospective join values without serializing old links.
   * @param node - Prepared parent.
   * @param parentValues - New values, including internally propagated assignments.
   * @returns Exact descendant inputs.
   */
  function groups(node: CopyNode, parentValues: Record<string, unknown>): Record<string, QRecordInput[]> {
    return Object.fromEntries(Object.entries(node.groups).map(([name, children]) => [name, children.map(child => {
      const parsed = zodSchemaFromTableMetadata(child.table, child.fields, true).safeParse(edits[child.path] ?? child.values)
      if (!parsed.success) throw new Error(`${child.table.label}: ${parsed.error.issues[0].message}`)
      validateCopyPasswords(child.table, parsed.data, child.fields)
      const values = { ...child.companions, ...parsed.data }
      const key = child.table.primaryKeyField
      if (values[key] === '' || values[key] == null) delete values[key]
      const association = node.table.associations!.find(item => item.name === name)!
      const forward = association.join.leftTable === node.table.name && association.join.rightTable === child.table.name
      const prospective = { ...values }
      for (const pair of association.join.joinOns) {
        const parentField = forward ? pair.leftField : pair.rightField
        const childField = forward ? pair.rightField : pair.leftField
        const value = parentValues[parentField]
        if (parentField === node.table.primaryKeyField && (value === '' || value == null)) prospective[childField] = pendingKey
        else if (value == null || value === '') throw new Error(`Full copy relationship value ${node.table.fields[parentField].label} is required.`)
        else prospective[childField] = value
      }
      const nested = groups(child, prospective)
      return { values, ...(Object.keys(nested).length ? { associatedRecords: nested } : {}) }
    })]))
  }
  return groups(root, rootValues ?? root.values)
}
