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
 * @file Bulk load mapping model — the backend's bulk load contract (table
 * structure, v1 bulk load profile) and the editable mapping built from it,
 * following the Material dashboard's `BulkLoadModels`.
 */

import type { QFieldMetaData } from '@/types'

/** Table (and associated child tables) a bulk load can map, from the `tableStructure` process value. */
export interface BulkLoadTableStructure {
  isMain: boolean
  isMany: boolean
  tableName: string
  label: string
  associationPath: string | null
  fields: QFieldMetaData[]
  associations: BulkLoadTableStructure[] | null
  isBulkEdit: boolean
  possibleKeyFields: string[] | null
  keyFields?: string | null
}

/** One field in a v1 bulk load profile. */
export interface BulkLoadProfileField {
  fieldName: string
  columnIndex?: number | null
  headerName?: string | null
  defaultValue?: unknown
  doValueMapping?: boolean | null
  clearIfEmpty?: boolean | null
  valueMappings?: Record<string, unknown> | null
}

/** The v1 bulk load profile the backend reads and returns (`bulkLoadProfile`). */
export interface BulkLoadProfile {
  version: string
  fieldList: BulkLoadProfileField[]
  hasHeaderRow: boolean
  layout: string | null
  isBulkEdit: boolean
  keyFields: string | null
}

/** Whether a mapped field reads a file column or uses one value for every row. */
export type BulkLoadValueType = 'column' | 'defaultValue'

let fieldKeySequence = 0

/** A table field chosen for the mapping. */
export class BulkLoadField {
  field: QFieldMetaData
  tableStructure: BulkLoadTableStructure
  valueType: BulkLoadValueType
  columnIndex: number | null
  headerName: string | null
  defaultValue: unknown
  doValueMapping: boolean
  clearIfEmpty: boolean
  /** Repetition index path for WIDE layouts (one entry for a child table). */
  wideLayoutIndexPath: number[]
  error: string | null = null
  warning: string | null = null
  /** Stable React key. */
  readonly key: string

  /**
   * Create a mapped field.
   * @param field - Field metadata.
   * @param tableStructure - Table the field belongs to.
   * @param init - Initial mapping settings.
   * @param key - Key to keep (copies of the same field keep their React key).
   */
  constructor(field: QFieldMetaData, tableStructure: BulkLoadTableStructure, init: Partial<Pick<BulkLoadField, 'valueType' | 'columnIndex' | 'headerName' | 'defaultValue' | 'doValueMapping' | 'clearIfEmpty' | 'wideLayoutIndexPath' | 'warning' | 'error'>> = {}, key?: string) {
    this.field = field
    this.tableStructure = tableStructure
    this.valueType = init.valueType ?? 'column'
    this.columnIndex = init.columnIndex ?? null
    this.headerName = init.headerName ?? null
    this.defaultValue = init.defaultValue ?? null
    this.doValueMapping = init.doValueMapping ?? false
    this.clearIfEmpty = init.clearIfEmpty ?? false
    this.wideLayoutIndexPath = init.wideLayoutIndexPath ?? []
    this.warning = init.warning ?? null
    this.error = init.error ?? null
    if (key) {
      this.key = key
    } else {
      fieldKeySequence += 1
      this.key = `bulk-load-field-${fieldKeySequence}`
    }
  }

  /**
   * Copy a field as a new mapping entry (new key), e.g. another wide-layout repetition.
   * @param source - The field to copy.
   * @returns The copy.
   */
  static clone(source: BulkLoadField): BulkLoadField {
    return new BulkLoadField(source.field, source.tableStructure, { ...source, wideLayoutIndexPath: [...source.wideLayoutIndexPath] })
  }

  /**
   * Copy a field for an immutable update of the same entry (same key).
   * @param source - The field to copy.
   * @returns The copy.
   */
  static copy(source: BulkLoadField): BulkLoadField {
    return new BulkLoadField(source.field, source.tableStructure, { ...source, wideLayoutIndexPath: [...source.wideLayoutIndexPath] }, source.key)
  }

  /**
   * Name of the field, prefixed by the association path for child tables.
   * @returns `field` or `associationPath.field`.
   */
  getQualifiedName(): string {
    return this.tableStructure.isMain ? this.field.name : `${this.tableStructure.associationPath}.${this.field.name}`
  }

  /**
   * Qualified name including the wide-layout repetition.
   * @returns The qualified name with a `.n` wide-layout suffix.
   */
  getQualifiedNameWithWideSuffix(): string {
    const suffix = this.wideLayoutIndexPath.length > 0 ? `.${this.wideLayoutIndexPath.map((index) => index + 1).join('.')}` : ''
    return `${this.getQualifiedName()}${suffix}`
  }

  /**
   * Label for display.
   * @returns Label, prefixed by the child table label and suffixed by the wide index.
   */
  getQualifiedLabel(): string {
    const suffix = this.wideLayoutIndexPath.length > 0 ? ` (${this.wideLayoutIndexPath.map((index) => index + 1).join(', ')})` : ''
    return this.tableStructure.isMain ? `${this.field.label}${suffix}` : `${this.tableStructure.label}: ${this.field.label}${suffix}`
  }

  /**
   * Whether the field belongs to a to-many child table.
   * @returns `true` for fields of a to-many child table.
   */
  isMany(): boolean {
    return Boolean(this.tableStructure?.isMany)
  }
}

/** The editable mapping of file columns (or default values) to table fields. */
export class BulkLoadMapping {
  requiredFields: BulkLoadField[] = []
  additionalFields: BulkLoadField[] = []
  unusedFields: BulkLoadField[] = []
  valueMappings: Record<string, Record<string, unknown>> = {}
  isBulkEdit: boolean
  keyFields: string | null
  hasHeaderRow = true
  layout: string | null = null
  /** Whether the table has child tables (enables TALL and WIDE layouts). */
  readonly hasAssociations: boolean

  /**
   * Create the default mapping for a table: required (or key) fields mapped, the rest unused.
   * @param tableStructure - The table structure from the backend.
   */
  constructor(tableStructure: BulkLoadTableStructure) {
    this.isBulkEdit = Boolean(tableStructure.isBulkEdit)
    this.keyFields = tableStructure.keyFields ?? null
    this.hasAssociations = Boolean(tableStructure.associations?.length)
    this.processTableStructure(tableStructure)
    if (!this.hasAssociations) this.layout = 'FLAT'
  }

  /**
   * Sort a table's fields into required (or key) and unused.
   * @param tableStructure - Table (recursing into associations).
   */
  private processTableStructure(tableStructure: BulkLoadTableStructure): void {
    for (const field of tableStructure.fields ?? []) {
      const bulkLoadField = new BulkLoadField(field, tableStructure)
      const qualifiedName = bulkLoadField.getQualifiedName()
      const isKey = this.isBulkEdit && (this.keyFields ?? '').split('|').includes(qualifiedName)
      if (this.isBulkEdit ? isKey : tableStructure.isMain && field.isRequired) this.requiredFields.push(bulkLoadField)
      else this.unusedFields.push(bulkLoadField)
    }
    for (const association of tableStructure.associations ?? []) this.processTableStructure(association)
  }

  /**
   * Build a mapping from a v1 profile (the backend's suggestion or the current profile).
   * @param tableStructure - Table structure.
   * @param profile - The profile.
   * @returns The mapping.
   */
  static fromProfile(tableStructure: BulkLoadTableStructure, profile: BulkLoadProfile | null | undefined): BulkLoadMapping {
    const mapping = new BulkLoadMapping(tableStructure)
    if (!profile) return mapping
    if (profile.version !== 'v1') throw new Error(`Unexpected version for bulk load profile: ${profile.version}`)
    mapping.isBulkEdit = Boolean(profile.isBulkEdit)
    mapping.hasHeaderRow = profile.hasHeaderRow !== false
    mapping.layout = profile.layout ?? mapping.layout
    mapping.keyFields = profile.keyFields ?? mapping.keyFields

    for (const profileField of profile.fieldList ?? []) {
      let name = profileField.fieldName
      let wideIndex: number | null = null
      const wideMatch = /,(\d+)$/.exec(name)
      if (wideMatch) {
        wideIndex = Number(wideMatch[1])
        name = name.replace(/,\d+$/, '')
      }
      let field = mapping.requiredFields.find((candidate) => candidate.getQualifiedName() === name)
      if (!field) {
        const unused = mapping.unusedFields.find((candidate) => candidate.getQualifiedName() === name)
        if (!unused) continue
        field = mapping.addField(unused, wideIndex)
      }
      if (profileField.columnIndex !== null && profileField.columnIndex !== undefined || profileField.headerName) {
        field.valueType = 'column'
        field.columnIndex = profileField.columnIndex ?? null
        field.headerName = profileField.headerName ?? null
        field.doValueMapping = Boolean(profileField.doValueMapping)
        field.clearIfEmpty = Boolean(profileField.clearIfEmpty)
        if (profileField.valueMappings) mapping.valueMappings[profileField.fieldName] = { ...profileField.valueMappings }
      } else {
        field.valueType = 'defaultValue'
        field.defaultValue = profileField.defaultValue ?? null
      }
    }

    if (!mapping.keyFields && tableStructure.possibleKeyFields?.length) {
      const names = (profile.fieldList ?? []).map((field) => field.fieldName)
      mapping.keyFields = tableStructure.possibleKeyFields.find((keyField) => keyField.split('|').every((part) => names.includes(part))) ?? null
    }
    return mapping
  }

  /**
   * Convert to the v1 profile the backend expects, marking field errors.
   * @returns The profile and whether any field is incomplete.
   */
  toProfile(): { haveErrors: boolean; profile: BulkLoadProfile } {
    let haveErrors = false
    const profile: BulkLoadProfile = {
      version: 'v1', fieldList: [], hasHeaderRow: this.hasHeaderRow, layout: this.layout, isBulkEdit: this.isBulkEdit, keyFields: this.keyFields,
    }
    for (const field of [...this.requiredFields, ...this.additionalFields]) {
      let fieldName = field.getQualifiedName()
      if (field.wideLayoutIndexPath.length > 0) fieldName += `,${field.wideLayoutIndexPath.join('.')}`
      field.error = null
      if (field.valueType === 'column') {
        if (field.columnIndex === null || field.columnIndex === undefined) {
          haveErrors = true
          field.error = 'You must select a column.'
        } else {
          const profileField: BulkLoadProfileField = {
            fieldName, columnIndex: field.columnIndex, headerName: field.headerName, doValueMapping: field.doValueMapping, clearIfEmpty: field.clearIfEmpty,
          }
          if (this.valueMappings[fieldName]) profileField.valueMappings = this.valueMappings[fieldName]
          profile.fieldList.push(profileField)
        }
      } else if (field.defaultValue === null || field.defaultValue === undefined || field.defaultValue === '') {
        haveErrors = true
        field.error = 'A value is required.'
      } else {
        profile.fieldList.push({ fieldName, defaultValue: field.defaultValue })
      }
    }
    return { haveErrors, profile }
  }

  /**
   * Move a field into the additional (mapped) fields; to-many fields in a WIDE layout get a repetition index.
   * @param field - The field to add.
   * @param wideIndex - Explicit repetition index.
   * @returns The field that was added.
   */
  addField(field: BulkLoadField, wideIndex?: number | null): BulkLoadField {
    if (field.isMany() && this.layout === 'WIDE') {
      const index = wideIndex ?? (Math.max(-1, ...[...this.requiredFields, ...this.additionalFields]
        .filter((existing) => existing.getQualifiedName() === field.getQualifiedName())
        .map((existing) => existing.wideLayoutIndexPath[0] ?? -1)) + 1)
      const clone = BulkLoadField.clone(field)
      clone.wideLayoutIndexPath = [index]
      this.additionalFields.push(clone)
      return clone
    }
    this.additionalFields.push(field)
    this.unusedFields = this.unusedFields.filter((unused) => unused !== field)
    return field
  }

  /**
   * Remove an additional field (it becomes available again).
   * @param toRemove - The field to remove.
   */
  removeField(toRemove: BulkLoadField): void {
    this.additionalFields = this.additionalFields.filter((field) => field.getQualifiedNameWithWideSuffix() !== toRemove.getQualifiedNameWithWideSuffix())
    if (!toRemove.isMany() || this.layout !== 'WIDE') {
      if (!this.unusedFields.some((field) => field.getQualifiedName() === toRemove.getQualifiedName())) {
        const restored = BulkLoadField.clone(toRemove)
        restored.wideLayoutIndexPath = []
        this.unusedFields.push(restored)
      }
    }
  }

  /**
   * Change the file layout, dropping or adding wide repetition indexes for child fields.
   * @param layout - `FLAT`, `TALL` or `WIDE`.
   */
  switchLayout(layout: string): void {
    const seen = new Set<string>()
    this.additionalFields = this.additionalFields.flatMap((field) => {
      if (field.tableStructure.isMain) return [field]
      const name = field.getQualifiedName()
      if (layout === 'WIDE') {
        const clone = BulkLoadField.clone(field)
        clone.wideLayoutIndexPath = [0]
        return [clone]
      }
      if (seen.has(name)) return []
      seen.add(name)
      const clone = BulkLoadField.clone(field)
      clone.wideLayoutIndexPath = []
      return [clone]
    })
    this.layout = layout
  }

  /**
   * Fields mapped to a file column.
   * @param columnIndex - Column index.
   * @returns The fields reading that column.
   */
  fieldsForColumn(columnIndex: number): BulkLoadField[] {
    return [...this.requiredFields, ...this.additionalFields].filter((field) => field.valueType === 'column' && field.columnIndex === columnIndex)
  }

  /**
   * Copy the mapping and its fields (keys kept) so an update never mutates state.
   * @returns The copy.
   */
  clone(): BulkLoadMapping {
    const copy = Object.create(BulkLoadMapping.prototype) as BulkLoadMapping
    Object.assign(copy, this)
    copy.requiredFields = this.requiredFields.map(BulkLoadField.copy)
    copy.additionalFields = this.additionalFields.map(BulkLoadField.copy)
    copy.unusedFields = this.unusedFields.map(BulkLoadField.copy)
    copy.valueMappings = Object.fromEntries(Object.entries(this.valueMappings).map(([name, mappings]) => [name, { ...mappings }]))
    return copy
  }

  /**
   * Find a mapped or unused field by its key.
   * @param key - Field key.
   * @returns The field, if present.
   */
  findField(key: string): BulkLoadField | undefined {
    return [...this.requiredFields, ...this.additionalFields, ...this.unusedFields].find((field) => field.key === key)
  }
}

/** The uploaded file's shape, from `headerValues`, `headerLetters` and `bodyValuesPreview`. */
export class FileDescription {
  readonly headerValues: string[]
  readonly headerLetters: string[]
  readonly bodyValuesPreview: unknown[][]
  readonly duplicateHeaderIndexes: boolean[]

  /**
   * Describe an uploaded file from its preview values.
   * @param headerValues - First-row values.
   * @param headerLetters - Column letters.
   * @param bodyValuesPreview - Preview values per column.
   */
  constructor(headerValues: unknown, headerLetters: unknown, bodyValuesPreview: unknown) {
    this.headerValues = Array.isArray(headerValues) ? headerValues.map((value) => (value === null || value === undefined ? '' : String(value))) : []
    this.headerLetters = Array.isArray(headerLetters) ? headerLetters.map(String) : this.headerValues.map((_, index) => String.fromCharCode(65 + index))
    this.bodyValuesPreview = Array.isArray(bodyValuesPreview) ? bodyValuesPreview.map((column) => (Array.isArray(column) ? column : [])) : []
    const seen = new Set<string>()
    this.duplicateHeaderIndexes = this.headerValues.map((value) => {
      const duplicate = seen.has(value)
      seen.add(value)
      return duplicate
    })
  }

  /**
   * Column names for selection.
   * @param hasHeaderRow - Whether the first row holds headers.
   * @returns Header names, or `Column A`, `Column B`, ...
   */
  columnNames(hasHeaderRow: boolean): string[] {
    return hasHeaderRow ? this.headerValues : this.headerLetters.map((letter) => `Column ${letter}`)
  }

  /**
   * Preview values of one column (the header row counts as data without a header row).
   * @param columnIndex - Column index.
   * @param hasHeaderRow - Whether the first row holds headers.
   * @returns Preview text values.
   */
  previewValues(columnIndex: number | null, hasHeaderRow: boolean): string[] {
    if (columnIndex === null || columnIndex === undefined) return []
    const text = (value: unknown) => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'object' && 'string' in (value as Record<string, unknown>)) return String((value as Record<string, unknown>).string ?? '')
      return String(value)
    }
    const values = (this.bodyValuesPreview[columnIndex] ?? []).map(text)
    return hasHeaderRow ? values : [this.headerValues[columnIndex] ?? '', ...values]
  }
}

/**
 * Read the table structure process value.
 * @param value - The `tableStructure` value.
 * @returns The structure, or `null`.
 */
export function readTableStructure(value: unknown): BulkLoadTableStructure | null {
  return value && typeof value === 'object' && Array.isArray((value as BulkLoadTableStructure).fields) ? value as BulkLoadTableStructure : null
}

/**
 * The profile values every bulk load mapping screen re-submits.
 * @param mapping - Current mapping.
 * @param profile - Profile from {@link BulkLoadMapping.toProfile}.
 * @returns Form values.
 */
export function profileSubmitValues(mapping: BulkLoadMapping, profile: BulkLoadProfile): Record<string, unknown> {
  return {
    version: profile.version,
    fieldListJSON: JSON.stringify(profile.fieldList),
    layout: mapping.layout ?? '',
    hasHeaderRow: String(mapping.hasHeaderRow),
    isBulkEdit: String(mapping.isBulkEdit),
    ...(mapping.keyFields ? { keyFields: mapping.keyFields } : {}),
  }
}
