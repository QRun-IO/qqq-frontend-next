// QQQ Process Job Types - ported from qqq-frontend-core

import type { QFrontendStepMetaData, QFieldMetaData } from './metadata'

export interface QJobStarted {
  processUUID: string
  jobUUID: string
}

export interface QJobRunning {
  processUUID: string
  message: string
  current?: number
  total?: number
}

export interface QJobComplete {
  processUUID: string
  values: Record<string, unknown>
  nextStep?: string
  backStep?: string
  processMetaDataAdjustment?: ProcessMetaDataAdjustment
}

export interface QJobError {
  processUUID: string
  error: string
  userFacingError?: string
}

export interface ProcessMetaDataAdjustment {
  addedSteps?: QFrontendStepMetaData[]
  removedSteps?: string[]
  modifiedFields?: Record<string, Partial<QFieldMetaData>>
}

export type QJobResponse = QJobStarted | QJobRunning | QJobComplete | QJobError
