/** Possible Values API — Endpoints for fetching possible-value lists for table fields, process fields, and standalone PVSes. */

import type { QPossibleValue } from '@/types'
import apiClient from './client'

/**
 * Common request parameters accepted by all possible-values endpoints.
 *
 * At least one of `searchTerm`, `ids`, `labels`, or `values` is typically
 * supplied; all fields are optional so callers can pass only what is relevant.
 */
export interface PossibleValuesRequest {
  /** Free-text search string used to filter possible values by label. */
  searchTerm?: string
  /**
   * Comma-separated list of internal IDs to look up by identity.
   * Used to resolve stored IDs back to their display labels.
   */
  ids?: string
  /**
   * Comma-separated list of display labels to resolve to their corresponding values.
   */
  labels?: string
  /**
   * Comma-separated list of stored values to look up.
   * Semantically equivalent to `ids` for most PVS implementations.
   */
  values?: string
  /**
   * Optional hint string indicating the UI context in which possible values are
   * being requested (e.g. `"filter"` or `"form"`). The server may use this to
   * return a different, context-appropriate subset.
   */
  useCase?: string
}

/**
 * Fetches possible values for a specific field on a table via
 * `POST /table/{tableName}/possibleValues/{fieldName}`.
 *
 * Encodes the request as `multipart/form-data`. Only non-empty fields are
 * appended to the form to keep the request body minimal.
 *
 * @param tableName - Backend-registered name of the table that owns the field.
 * @param fieldName - Name of the field whose possible-value source to query.
 * @param request - Optional filter and look-up parameters.
 * @returns An array of matching possible-value objects.
 */
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

/**
 * Fetches possible values for a specific field on a process step via
 * `POST /processes/{processName}/possibleValues/{fieldName}`.
 *
 * Encodes the request as `multipart/form-data`. Only non-empty fields are
 * appended to the form to keep the request body minimal.
 *
 * @param processName - Backend-registered name of the process that owns the field.
 * @param fieldName - Name of the process field whose possible-value source to query.
 * @param request - Optional filter and look-up parameters.
 * @returns An array of matching possible-value objects.
 */
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

/**
 * Fetches possible values for a standalone possible-value source (PVS) via
 * `POST /possibleValues/{fieldName}`.
 *
 * Used for PVSes that are not tied to a specific table or process — for example,
 * enum-style lists shared across multiple fields or contexts.
 *
 * Encodes the request as `multipart/form-data`. Only non-empty fields are
 * appended to the form to keep the request body minimal.
 *
 * @param fieldName - Name of the standalone possible-value source to query.
 * @param request - Optional filter and look-up parameters.
 * @returns An array of matching possible-value objects.
 */
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
