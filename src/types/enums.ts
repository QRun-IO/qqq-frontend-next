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

/** Enums — QQQ backend string-union type aliases used across metadata, query, and process types */

// QQQ Enum Types - ported from qqq-frontend-core

/**
 * The set of primitive data types that a QQQ field can hold.
 *
 * The renderer selects the appropriate input component, formatter, and validator
 * based on this type:
 * - `STRING` — short single-line text
 * - `INTEGER` — 32-bit signed integer
 * - `LONG` — 64-bit signed integer
 * - `DECIMAL` — arbitrary-precision decimal number
 * - `BOOLEAN` — true/false toggle
 * - `DATE` — calendar date without time (`YYYY-MM-DD`)
 * - `TIME` — time of day without date (`HH:mm:ss`)
 * - `DATE_TIME` — combined date and time (ISO-8601)
 * - `TEXT` — multi-line plain text (textarea)
 * - `HTML` — rich HTML content rendered in a sandboxed element
 * - `PASSWORD` — masked text input (value never displayed in plain text)
 * - `BLOB` — binary large object (file upload / download)
 */
export type QFieldType =
  | 'STRING'
  | 'INTEGER'
  | 'LONG'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIME'
  | 'DATE_TIME'
  | 'TEXT'
  | 'HTML'
  | 'PASSWORD'
  | 'BLOB'

/**
 * Identifies the kind of entity represented by a node in the application navigation tree.
 *
 * Used by `QAppTreeNode` to determine which route prefix and page component to use:
 * - `TABLE` — navigates to the record query page
 * - `PROCESS` — navigates to the process execution page
 * - `REPORT` — navigates to the report run page
 * - `APP` — renders a nested app grouping (no direct page; expands in sidebar)
 */
export type QAppNodeType = 'TABLE' | 'PROCESS' | 'REPORT' | 'APP'

/**
 * Backend-declared capabilities that control which API operations are available for a table.
 *
 * The frontend gates UI elements (buttons, menu items) on the presence of the
 * corresponding capability in `QTableMetaData.capabilities`:
 * - `TABLE_QUERY` — listing / filtering records
 * - `TABLE_GET` — fetching a single record by primary key
 * - `TABLE_COUNT` — counting records matching a filter
 * - `TABLE_INSERT` — creating new records
 * - `TABLE_UPDATE` — editing existing records
 * - `TABLE_DELETE` — deleting records
 */
export type Capability =
  | 'TABLE_QUERY'
  | 'TABLE_GET'
  | 'TABLE_COUNT'
  | 'TABLE_INSERT'
  | 'TABLE_UPDATE'
  | 'TABLE_DELETE'

/**
 * Comparison operators available when constructing `QFilterCriteria`.
 *
 * Single-value operators (`EQUALS`, `NOT_EQUALS`, `LESS_THAN`, etc.) use the first
 * entry in `values`.  Multi-value operators (`IN`, `NOT_IN`, `BETWEEN`, `NOT_BETWEEN`)
 * consume two or more entries.  Null-check operators (`IS_BLANK`, `IS_NOT_BLANK`)
 * ignore `values` entirely.
 *
 * - `EQUALS` — exact match
 * - `NOT_EQUALS` — not an exact match (null-safe: NULL rows are excluded)
 * - `NOT_EQUALS_OR_IS_NULL` — not an exact match OR the field is null
 * - `IN` — value is in the provided list
 * - `NOT_IN` — value is not in the provided list
 * - `STARTS_WITH` — string begins with the given prefix
 * - `ENDS_WITH` — string ends with the given suffix
 * - `CONTAINS` — string contains the given substring
 * - `NOT_STARTS_WITH` — string does not begin with the given prefix
 * - `NOT_ENDS_WITH` — string does not end with the given suffix
 * - `NOT_CONTAINS` — string does not contain the given substring
 * - `LESS_THAN` — numeric/date value is strictly less than the given value
 * - `LESS_THAN_OR_EQUALS` — numeric/date value is less than or equal to the given value
 * - `GREATER_THAN` — numeric/date value is strictly greater than the given value
 * - `GREATER_THAN_OR_EQUALS` — numeric/date value is greater than or equal to the given value
 * - `IS_BLANK` — field value is null or empty string
 * - `IS_NOT_BLANK` — field value is non-null and non-empty
 * - `BETWEEN` — value falls within the inclusive range [values[0], values[1]]
 * - `NOT_BETWEEN` — value falls outside the inclusive range [values[0], values[1]]
 */
export type QCriteriaOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'NOT_EQUALS_OR_IS_NULL'
  | 'IN'
  | 'NOT_IN'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'CONTAINS'
  | 'NOT_STARTS_WITH'
  | 'NOT_ENDS_WITH'
  | 'NOT_CONTAINS'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUALS'
  | 'IS_BLANK'
  | 'IS_NOT_BLANK'
  | 'BETWEEN'
  | 'NOT_BETWEEN'

/**
 * The set of UI component types that can appear inside a `QFrontendStepMetaData`.
 *
 * Each value maps to a registered React renderer in the process wizard:
 * - `HELP_TEXT` — static informational text block
 * - `BULK_EDIT_FORM` — form for applying changes to multiple selected records
 * - `BULK_LOAD_FILE_MAPPING_FORM` — CSV/Excel column-to-field mapper
 * - `BULK_LOAD_VALUE_MAPPING_FORM` — value translation mapper (e.g. "Y" → true)
 * - `BULK_LOAD_PROFILE_FORM` — saved import profile selector/editor
 * - `VALIDATION_REVIEW_SCREEN` — preview of validation results before committing
 * - `EDIT_FORM` — standard record edit form
 * - `VIEW_FORM` — read-only record view form
 * - `DOWNLOAD_FORM` — download trigger with optional format/options selector
 * - `RECORD_LIST` — tabular list of records (input or output of the process)
 * - `PROCESS_SUMMARY_RESULTS` — summary counts and error list after completion
 * - `GOOGLE_DRIVE_SELECT_FOLDER` — Google Drive folder picker
 * - `WIDGET` — an embedded dashboard widget
 * - `HTML` — raw HTML block (must be sanitized before rendering)
 */
export type QComponentType =
  | 'HELP_TEXT'
  | 'BULK_EDIT_FORM'
  | 'BULK_LOAD_FILE_MAPPING_FORM'
  | 'BULK_LOAD_VALUE_MAPPING_FORM'
  | 'BULK_LOAD_PROFILE_FORM'
  | 'VALIDATION_REVIEW_SCREEN'
  | 'EDIT_FORM'
  | 'VIEW_FORM'
  | 'DOWNLOAD_FORM'
  | 'RECORD_LIST'
  | 'PROCESS_SUMMARY_RESULTS'
  | 'GOOGLE_DRIVE_SELECT_FOLDER'
  | 'WIDGET'
  | 'HTML'

/**
 * The complete set of adornment type identifiers supported by QQQ fields.
 *
 * An adornment modifies how a field value is rendered in grids and detail views.
 * This type alias mirrors the discriminant property of `FieldAdornment` in `metadata.ts`
 * and is provided here for use in switch statements and type-guard utilities:
 *
 * - `LINK` — renders the value as a hyperlink
 * - `CHIP` — renders the value inside a color-coded badge chip
 * - `SIZE` — renders a byte count as a human-readable file size
 * - `ERROR` — overlays the value with an error indicator
 * - `RENDER_HTML` — renders the raw value as HTML (must be sanitized)
 * - `REVEAL` — hides the value behind a "reveal" toggle (e.g. masked secrets)
 * - `CODE_EDITOR` — renders the value in a syntax-highlighted code editor
 * - `FILE_DOWNLOAD` — renders a download link for binary/blob field values
 * - `FILE_UPLOAD` — renders a file picker for uploading content to the field
 * - `TOOLTIP` — adds a hover tooltip with additional context
 */
export type AdornmentType =
  | 'LINK'
  | 'CHIP'
  | 'SIZE'
  | 'ERROR'
  | 'RENDER_HTML'
  | 'REVEAL'
  | 'CODE_EDITOR'
  | 'FILE_DOWNLOAD'
  | 'FILE_UPLOAD'
  | 'TOOLTIP'
