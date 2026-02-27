/** Records — QQQ record and possible-value shapes returned by the data API */

// QQQ Record Types - ported from qqq-frontend-core

/**
 * A single backend record returned by the QQQ tables API.
 *
 * `values` holds raw typed values (numbers, booleans, Date strings, etc.) while
 * `displayValues` holds the formatted strings ready for UI rendering.  When
 * `associatedRecords` is present the record also carries related records fetched
 * via exposed joins or child-table queries.
 */
export interface QRecord {
  /** Name of the table this record belongs to. */
  tableName: string
  /** Human-readable label computed by the backend (e.g. a concatenation of key fields). */
  recordLabel: string
  /** Raw field values keyed by field name. */
  values: Record<string, unknown>
  /** Pre-formatted display strings keyed by field name, ready to render without transformation. */
  displayValues: Record<string, string>
  /** Optional map of relationship name → associated records for joined or child data. */
  associatedRecords?: Record<string, QRecord[]>
  /** Validation or server-side errors associated with this record (used in bulk operations). */
  errors?: string[]
  /** Non-fatal warnings associated with this record (e.g. duplicate detection). */
  warnings?: string[]
}

/**
 * A single option returned by a possible-value source, used to populate
 * autocomplete and select fields.
 *
 * `id` is the value stored in the record; `label` is the text shown to the user.
 */
export interface QPossibleValue {
  /** The storable identifier for this option (submitted as the field value). */
  id: number | string
  /** Human-readable text displayed to the user in autocomplete and select controls. */
  label: string
}

/** A single field change within an audit entry */
export interface QAuditFieldChange {
  /** The name of the field that was modified. */
  fieldName: string
  /** The field's value before the change was applied. */
  oldValue: unknown
  /** The field's value after the change was applied. */
  newValue: unknown
}

/** An audit log entry for a record */
export interface QAuditRecord {
  /** Unique surrogate ID for this audit log row. */
  id: number
  /** Name of the audit table that stores entries for the audited table. */
  auditTableName: string
  /** Primary key of the record that was modified. */
  recordId: string | number
  /** ISO-8601 timestamp of when the action occurred. */
  timestamp: string
  /** Username or identifier of the user who performed the action. */
  user: string
  /** The type of data mutation that was performed. */
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  /** Optional human-readable summary of the action (e.g. "Updated status"). */
  message?: string
  /** List of individual field-level changes recorded for this audit entry. */
  fieldChanges: QAuditFieldChange[]
}
