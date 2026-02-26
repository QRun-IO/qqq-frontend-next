// Process lifecycle API functions

import type { QJobResponse, QRecord } from '@/types'
import apiClient from './client'

export interface ProcessInitRequest {
  values?: Record<string, unknown>
  recordsParam?: 'recordIds' | 'filterJSON' | 'filterId'
  recordIds?: string
  filterJSON?: string
  stepTimeoutMillis?: number
  file?: File
}

export interface ProcessStepRequest {
  values?: Record<string, unknown>
  stepTimeoutMillis?: number
  file?: File
}

export interface ProcessRecordsResponse {
  totalRecords: number
  records: QRecord[]
}

export async function processInit(
  processName: string,
  request: ProcessInitRequest = {}
): Promise<QJobResponse> {
  const formData = new FormData()

  if (request.values) {
    formData.append('values', JSON.stringify(request.values))
  }
  if (request.recordsParam) {
    formData.append('recordsParam', request.recordsParam)
  }
  if (request.recordIds) {
    formData.append('recordIds', request.recordIds)
  }
  if (request.filterJSON) {
    formData.append('filterJSON', request.filterJSON)
  }
  if (request.stepTimeoutMillis !== undefined) {
    formData.append('stepTimeoutMillis', String(request.stepTimeoutMillis))
  }
  if (request.file) {
    formData.append('file', request.file)
  }

  return apiClient.post<QJobResponse>(
    `/processes/${encodeURIComponent(processName)}/init`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export async function processStep(
  processName: string,
  processUUID: string,
  stepName: string,
  request: ProcessStepRequest = {}
): Promise<QJobResponse> {
  const formData = new FormData()

  if (request.values) {
    formData.append('values', JSON.stringify(request.values))
  }
  if (request.stepTimeoutMillis !== undefined) {
    formData.append('stepTimeoutMillis', String(request.stepTimeoutMillis))
  }
  if (request.file) {
    formData.append('file', request.file)
  }

  return apiClient.post<QJobResponse>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/step/${encodeURIComponent(stepName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export async function processStatus(
  processName: string,
  processUUID: string,
  jobUUID: string
): Promise<QJobResponse> {
  return apiClient.get<QJobResponse>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/status/${jobUUID}`
  )
}

export async function processRecords(
  processName: string,
  processUUID: string,
  skip = 0,
  limit = 50
): Promise<ProcessRecordsResponse> {
  return apiClient.get<ProcessRecordsResponse>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/records`,
    { params: { skip, limit } }
  )
}

export async function processCancel(
  processName: string,
  processUUID: string
): Promise<boolean> {
  return apiClient.get<boolean>(
    `/processes/${encodeURIComponent(processName)}/${processUUID}/cancel`
  )
}
