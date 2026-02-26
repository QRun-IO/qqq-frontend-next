// QQQ Record Types - ported from qqq-frontend-core

export interface QRecord {
  tableName: string
  recordLabel: string
  values: Record<string, unknown>
  displayValues: Record<string, string>
  associatedRecords?: Record<string, QRecord[]>
  errors?: string[]
  warnings?: string[]
}

export interface QPossibleValue {
  id: number | string
  label: string
}

/** A single field change within an audit entry */
export interface QAuditFieldChange {
  fieldName: string
  oldValue: unknown
  newValue: unknown
}

/** An audit log entry for a record */
export interface QAuditRecord {
  id: number
  auditTableName: string
  recordId: string | number
  timestamp: string
  user: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  message?: string
  fieldChanges: QAuditFieldChange[]
}
