// Possible Values API functions

import type { QPossibleValue } from '@/types'
import apiClient from './client'

export interface PossibleValuesRequest {
  searchTerm?: string
  ids?: string
  labels?: string
  values?: string
  useCase?: string
}

export async function fetchTablePossibleValues(
  tableName: string,
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  const formData = new FormData()
  if (request.searchTerm) formData.append('searchTerm', request.searchTerm)
  if (request.ids) formData.append('ids', request.ids)
  if (request.labels) formData.append('labels', request.labels)
  if (request.values) formData.append('values', request.values)
  if (request.useCase) formData.append('useCase', request.useCase)

  return apiClient.post<QPossibleValue[]>(
    `/table/${encodeURIComponent(tableName)}/possibleValues/${encodeURIComponent(fieldName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export async function fetchProcessPossibleValues(
  processName: string,
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  const formData = new FormData()
  if (request.searchTerm) formData.append('searchTerm', request.searchTerm)
  if (request.ids) formData.append('ids', request.ids)
  if (request.labels) formData.append('labels', request.labels)
  if (request.values) formData.append('values', request.values)
  if (request.useCase) formData.append('useCase', request.useCase)

  return apiClient.post<QPossibleValue[]>(
    `/processes/${encodeURIComponent(processName)}/possibleValues/${encodeURIComponent(fieldName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export async function fetchPossibleValues(
  fieldName: string,
  request: PossibleValuesRequest = {}
): Promise<QPossibleValue[]> {
  const formData = new FormData()
  if (request.searchTerm) formData.append('searchTerm', request.searchTerm)
  if (request.ids) formData.append('ids', request.ids)
  if (request.labels) formData.append('labels', request.labels)
  if (request.values) formData.append('values', request.values)
  if (request.useCase) formData.append('useCase', request.useCase)

  return apiClient.post<QPossibleValue[]>(
    `/possibleValues/${encodeURIComponent(fieldName)}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}
