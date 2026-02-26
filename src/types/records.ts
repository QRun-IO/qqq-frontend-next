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
