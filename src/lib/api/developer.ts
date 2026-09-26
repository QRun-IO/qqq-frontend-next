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
 * @file Developer API — application API discovery for the table developer view, and the
 * record developer routes and script processes behind associated scripts.
 *
 * The API catalog (`/apis.json`, `{api.path}versions.json`) is served by the API middleware
 * beside `/qqq/v1`. The record developer routes are the v1
 * `/table/{table}/{pk}/developer...` routes (QRun-IO/qqq#714). Script revisions are stored and
 * tested through the `storeScriptRevision` and `testScript` processes, as the Material dashboard does.
 */

import { isAxiosError } from 'axios'

import type { QFieldMetaData, QQueryFilter, QRecord } from '@/types'
import apiClient from './client'
import { processInit, processStatus, type ProcessResponse } from './processes'
import { queryRecords } from './tables'

/** Scripts model tables (the backend's script contract). */
const SCRIPT_REVISION_TABLE = 'scriptRevision'
const SCRIPT_REVISION_FILE_TABLE = 'scriptRevisionFile'
const SCRIPT_TYPE_FILE_SCHEMA_TABLE = 'scriptTypeFileSchema'

/** How long script processes may run before the backend continues them as async jobs. */
const SCRIPT_PROCESS_TIMEOUT_MILLIS = 60_000

/** Delay between status polls when a script process went async. */
const STATUS_POLL_MILLIS = 1_000

/** One application API that exposes a table, from `GET /apis.json?tableName=`. */
export interface ApiInstance {
  /** API name (the selection key). */
  name: string
  /** Root-relative base path of the API, e.g. `/api/`. */
  path: string
  /** Label shown to the user. */
  label: string
}

/** Versions an API supports, from `GET {api.path}versions.json`. */
export interface ApiVersions {
  /** Every version the API serves. */
  supportedVersions: string[]
  /** The version the API calls current, when it declares one. */
  currentVersion?: string
}

/** A table's associated-script declaration. */
export interface AssociatedScriptDefinition {
  /** Record field that holds the script id. */
  fieldName: string
  /** Script type the field's scripts belong to. */
  scriptTypeId?: string | number
}

/** Developer data for one associated script of a record. */
export interface AssociatedScriptData {
  /** The table's declaration of this associated script. */
  associatedScript: AssociatedScriptDefinition
  /** The script type record (fileMode, helpText, sampleCode, ...). */
  scriptType?: QRecord
  /** The script referenced by the record, when it has one. */
  script?: QRecord
  /** The script's revisions (id descending). */
  scriptRevisions?: QRecord[]
  /** Input fields of the script type's tester. */
  testInputFields?: QFieldMetaData[]
  /** Output fields of the script type's tester. */
  testOutputFields?: QFieldMetaData[]
}

/** Response of the v1 `GET /table/{table}/{pk}/developer`. */
export interface RecordDeveloperData {
  /** The record, as the backend read it. */
  record: QRecord
  /** One entry per associated script declared on the table. */
  associatedScripts: AssociatedScriptData[]
}

/** Result of creating or replacing a record's associated script. */
export interface StoreAssociatedScriptResult {
  /** Id of the script the record now references. */
  scriptId?: number
  /** Name of that script. */
  scriptName?: string
  /** Id of the stored revision. */
  scriptRevisionId?: number
  /** Sequence number of the stored revision. */
  scriptRevisionSequenceNo?: number
}

/** Request for {@link storeScriptRevision}. */
export interface StoreScriptRevisionRequest {
  /** Script to add a revision to. */
  scriptId: string | number
  /** Commit message of the new revision. */
  commitMessage: string
  /** File contents by file name. */
  files: Record<string, string>
}

/** Result of {@link storeScriptRevision}. */
export interface StoreScriptRevisionResult {
  /** Script the revision belongs to. */
  scriptId?: number
  /** Name of the script. */
  scriptName?: string
  /** Id of the new (now current) revision. */
  scriptRevisionId?: number
  /** Sequence number of the new revision. */
  scriptRevisionSequenceNo?: number
}

/** Request for {@link testScript}. */
export interface TestScriptRequest {
  /** Script under test. */
  scriptId: string | number
  /** File contents by file name. */
  files: Record<string, string>
  /** Values of the tester's input fields, by field name. */
  inputValues: Record<string, unknown>
}

/** A log line written while a script ran. */
export interface ScriptLogLine {
  /** When the line was written (ISO instant). */
  timestamp?: unknown
  /** The logged text. */
  text: string
}

/** Result of {@link testScript}. */
export interface TestScriptResult {
  /** Output values by output field name, exactly as the tester returned them. */
  outputObject: Record<string, unknown>
  /** Lines the script logged. */
  logLines: ScriptLogLine[]
  /** Exception message chain (`message\ncaused by: ...`) when the script failed. */
  exceptionMessage?: string
}

/**
 * Base URL of the API middleware (`/apis.json`, `/{api}/versions.json`, specs), which QQQ serves
 * beside `/qqq/v1` under the same host and deployment prefix. It is not the UI's data API: every
 * record, script and log request goes to the v1 routes.
 * @returns The configured base URL without the V1 route suffix.
 */
function apiMiddlewareBaseURL(): string | undefined {
  return apiClient.getInstance().defaults.baseURL?.replace(/\/qqq\/v1\/?$/, '')
}

/**
 * Whether a value is a plain object.
 * @param value - Candidate.
 * @returns True for non-null, non-array objects.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Whether a value has the wire shape of a record.
 * @param value - Candidate.
 * @returns True when it has a `values` object.
 */
function isRecord(value: unknown): value is QRecord {
  return isObject(value) && isObject(value.values)
}

/**
 * Keep only record-shaped entries of a wire list.
 * @param value - Candidate list.
 * @returns The records, or an empty list.
 */
function recordList(value: unknown): QRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/**
 * Read an optional number from a wire value.
 * @param value - Candidate.
 * @returns The number, or `undefined`.
 */
function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Read an optional string from a wire value.
 * @param value - Candidate.
 * @returns The string, or `undefined`.
 */
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Build a single-criterion EQUALS filter.
 * @param fieldName - Field to compare.
 * @param value - Required value.
 * @param orderBy - Field to sort by.
 * @param isAscending - Sort direction.
 * @param limit - Maximum rows.
 * @returns The filter.
 */
function equalsFilter(fieldName: string, value: string | number, orderBy: string, isAscending: boolean, limit: number): Partial<QQueryFilter> {
  return {
    criteria: [{ fieldName, operator: 'EQUALS', values: [value] }],
    orderBys: [{ fieldName: orderBy, isAscending }],
    booleanOperator: 'AND',
    skip: 0,
    limit,
  }
}

/**
 * Path of a record's v1 developer route, relative to the API base URL.
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier.
 * @returns The route path.
 */
function developerPath(tableName: string, primaryKey: string | number): string {
  return `/table/${encodeURIComponent(tableName)}/${encodeURIComponent(String(primaryKey))}/developer`
}

/**
 * Lists the application APIs that expose a table (`GET /apis.json?tableName=`).
 *
 * Instances without the API middleware have no `/apis.json`; a 404, a non-JSON
 * response, or a body without `apis` all mean the table is in no API.
 *
 * @param tableName - Exact backend table identifier.
 * @returns The APIs, in backend order.
 */
export async function getTableApis(tableName: string): Promise<ApiInstance[]> {
  let body: unknown
  try {
    body = await apiClient.get<unknown>('/apis.json', { baseURL: apiMiddlewareBaseURL(), params: { tableName } })
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return []
    throw error
  }
  if (!isObject(body) || !Array.isArray(body.apis)) return []
  return body.apis.flatMap((api: unknown): ApiInstance[] => {
    if (!isObject(api) || typeof api.name !== 'string' || typeof api.path !== 'string') return []
    return [{ name: api.name, path: api.path, label: typeof api.label === 'string' && api.label ? api.label : api.name }]
  })
}

/**
 * Reads the versions an API supports (`GET {apiPath}versions.json`).
 *
 * @param apiPath - The API's root-relative base path (ends with `/`).
 * @returns The supported and current versions.
 */
export async function getApiVersions(apiPath: string): Promise<ApiVersions> {
  const body = await apiClient.get<unknown>(`${apiPath}versions.json`, { baseURL: apiMiddlewareBaseURL() })
  if (!isObject(body) || !Array.isArray(body.supportedVersions)) throw new Error('Invalid API versions response')
  return {
    supportedVersions: body.supportedVersions.filter((version): version is string => typeof version === 'string'),
    currentVersion: optionalString(body.currentVersion),
  }
}

/**
 * URL of the OpenAPI spec of one table in one API version.
 *
 * @param api - The API.
 * @param version - The API version.
 * @param tableName - Exact backend table identifier.
 * @returns The spec URL (absolute when a backend host is configured).
 */
export function apiTableSpecUrl(api: ApiInstance, version: string, tableName: string): string {
  return `${apiMiddlewareBaseURL() ?? ''}${api.path}${version}/${tableName}/openapi.json`
}

/**
 * Loads a record's developer data (v1 `GET /table/{table}/{pk}/developer`).
 *
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier.
 * @returns The record and its associated scripts.
 */
export async function getRecordDeveloperData(tableName: string, primaryKey: string | number): Promise<RecordDeveloperData> {
  const body = await apiClient.get<unknown>(developerPath(tableName, primaryKey))
  if (!isObject(body) || !isRecord(body.record)) throw new Error('Invalid record developer response')
  const associatedScripts = Array.isArray(body.associatedScripts) ? body.associatedScripts : []
  return {
    record: body.record,
    associatedScripts: associatedScripts.flatMap((entry: unknown): AssociatedScriptData[] => {
      if (!isObject(entry) || !isObject(entry.associatedScript) || typeof entry.associatedScript.fieldName !== 'string') return []
      const scriptTypeId = entry.associatedScript.scriptTypeId
      return [{
        associatedScript: {
          fieldName: entry.associatedScript.fieldName,
          scriptTypeId: typeof scriptTypeId === 'string' || typeof scriptTypeId === 'number' ? scriptTypeId : undefined,
        },
        scriptType: isRecord(entry.scriptType) ? entry.scriptType : undefined,
        script: isRecord(entry.script) ? entry.script : undefined,
        scriptRevisions: Array.isArray(entry.scriptRevisions) ? recordList(entry.scriptRevisions) : undefined,
        testInputFields: Array.isArray(entry.testInputFields) ? entry.testInputFields as QFieldMetaData[] : undefined,
        testOutputFields: Array.isArray(entry.testOutputFields) ? entry.testOutputFields as QFieldMetaData[] : undefined,
      }]
    }),
  }
}

/**
 * Creates a record's associated script with its first revision
 * (v1 `POST /table/{table}/{pk}/developer/associatedScript/{fieldName}`, JSON body).
 *
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier.
 * @param fieldName - Associated-script field.
 * @param contents - Code of the first revision.
 * @param commitMessage - Commit message of the first revision.
 * @returns The stored script and revision ids.
 */
export async function storeRecordAssociatedScript(
  tableName: string,
  primaryKey: string | number,
  fieldName: string,
  contents: string,
  commitMessage: string
): Promise<StoreAssociatedScriptResult> {
  const body = await apiClient.post<unknown>(
    `${developerPath(tableName, primaryKey)}/associatedScript/${encodeURIComponent(fieldName)}`,
    { contents, commitMessage }
  )
  if (!isObject(body)) throw new Error('Invalid store script response')
  return {
    scriptId: optionalNumber(body.scriptId),
    scriptName: optionalString(body.scriptName),
    scriptRevisionId: optionalNumber(body.scriptRevisionId),
    scriptRevisionSequenceNo: optionalNumber(body.scriptRevisionSequenceNo),
  }
}

/**
 * Loads the latest run logs of one revision of a record's associated script
 * (v1 `GET .../developer/associatedScript/{fieldName}/{scriptRevisionId}/logs`).
 *
 * @param tableName - Exact backend table identifier.
 * @param primaryKey - Record identifier.
 * @param fieldName - Associated-script field.
 * @param scriptRevisionId - Revision whose logs to read.
 * @returns Log records (id descending), each with its `scriptLogLine` records in `values`.
 */
export async function getAssociatedScriptLogs(
  tableName: string,
  primaryKey: string | number,
  fieldName: string,
  scriptRevisionId: string | number
): Promise<QRecord[]> {
  const body = await apiClient.get<unknown>(
    `${developerPath(tableName, primaryKey)}/associatedScript/${encodeURIComponent(fieldName)}/${encodeURIComponent(String(scriptRevisionId))}/logs`
  )
  if (!isObject(body)) throw new Error('Invalid script logs response')
  return recordList(body.scriptLogRecords)
}

/**
 * Waits for a script process to finish, following an async job when it went async.
 * @param processName - Process that was started.
 * @param response - The init response.
 * @returns The completed process values.
 */
async function completedValues(processName: string, response: ProcessResponse): Promise<Record<string, unknown>> {
  let current = response
  const jobUUID = current.type === 'JOB_STARTED' ? current.jobUUID : undefined
  while ((current.type === 'JOB_STARTED' || current.type === 'RUNNING') && jobUUID) {
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MILLIS))
    current = await processStatus(processName, current.processUUID, jobUUID)
  }
  if (current.type === 'ERROR') throw new Error(current.userFacingError || current.error || `${processName} failed.`)
  if (current.type !== 'COMPLETE') throw new Error('Unexpected server response.')
  return current.values
}

/**
 * Process values carrying script files, as the script processes read them.
 * @param scriptId - Script id.
 * @param files - File contents by file name.
 * @returns `scriptId`, `fileNames` and one `fileContents:{name}` value per file.
 */
function scriptFileValues(scriptId: string | number, files: Record<string, string>): Record<string, unknown> {
  const values: Record<string, unknown> = { scriptId, fileNames: Object.keys(files).join(',') }
  for (const [fileName, contents] of Object.entries(files)) values[`fileContents:${fileName}`] = contents
  return values
}

/**
 * Stores a new revision of a script and makes it current (`storeScriptRevision` process).
 *
 * @param request - Script, commit message and file contents.
 * @returns The new revision's id and sequence number.
 */
export async function storeScriptRevision(request: StoreScriptRevisionRequest): Promise<StoreScriptRevisionResult> {
  const processName = 'storeScriptRevision'
  const response = await processInit(processName, {
    values: { ...scriptFileValues(request.scriptId, request.files), commitMessage: request.commitMessage },
    stepTimeoutMillis: SCRIPT_PROCESS_TIMEOUT_MILLIS,
  })
  const values = await completedValues(processName, response)
  return {
    scriptId: optionalNumber(values.scriptId),
    scriptName: optionalString(values.scriptName),
    scriptRevisionId: optionalNumber(values.scriptRevisionId),
    scriptRevisionSequenceNo: optionalNumber(values.scriptRevisionSequenceNo),
  }
}

/**
 * Joins an exception and its causes the way Material shows a failed test.
 * @param exception - Serialized exception (`message`, `cause`).
 * @returns `message\ncaused by: cause message...`, or `undefined` when absent.
 */
function exceptionMessageChain(exception: unknown): string | undefined {
  if (!isObject(exception)) return typeof exception === 'string' && exception ? exception : undefined
  const message = typeof exception.message === 'string' ? exception.message : String(exception.message ?? '')
  const cause = exceptionMessageChain(exception.cause)
  return cause ? `${message}\ncaused by: ${cause}` : message
}

/**
 * Runs a script's test with the given code and inputs (`testScript` process).
 *
 * @param request - Script, file contents and tester input values.
 * @returns The tester's output object, the logged lines, and the exception message chain when the script failed.
 */
export async function testScript(request: TestScriptRequest): Promise<TestScriptResult> {
  const processName = 'testScript'
  const response = await processInit(processName, {
    values: { ...request.inputValues, ...scriptFileValues(request.scriptId, request.files) },
    stepTimeoutMillis: SCRIPT_PROCESS_TIMEOUT_MILLIS,
  })
  const values = await completedValues(processName, response)
  return {
    outputObject: isObject(values.outputObject) ? values.outputObject : {},
    logLines: recordList(values.scriptLogLines).map((line) => ({
      timestamp: line.values.timestamp,
      text: typeof line.values.text === 'string' ? line.values.text : String(line.values.text ?? ''),
    })),
    exceptionMessage: exceptionMessageChain(values.exception),
  }
}

/**
 * Lists a script's revisions, newest sequence first (at most 25, as Material shows).
 *
 * @param scriptId - Script id.
 * @returns The revision records.
 */
export async function queryScriptRevisions(scriptId: string | number): Promise<QRecord[]> {
  const response = await queryRecords(SCRIPT_REVISION_TABLE, { filter: equalsFilter('scriptId', scriptId, 'sequenceNo', false, 25) })
  return response.records
}

/**
 * Lists the files of one script revision.
 *
 * @param scriptRevisionId - Revision id.
 * @returns The file records (`fileName`, `contents`).
 */
export async function queryScriptRevisionFiles(scriptRevisionId: string | number): Promise<QRecord[]> {
  const response = await queryRecords(SCRIPT_REVISION_FILE_TABLE, { filter: equalsFilter('scriptRevisionId', scriptRevisionId, 'id', true, 100) })
  return response.records
}

/**
 * Lists the pre-defined files of a multi-file script type.
 *
 * @param scriptTypeId - Script type id.
 * @returns The file schema records (`name`, `fileType`).
 */
export async function queryScriptTypeFileSchemas(scriptTypeId: string | number): Promise<QRecord[]> {
  const response = await queryRecords(SCRIPT_TYPE_FILE_SCHEMA_TABLE, { filter: equalsFilter('scriptTypeId', scriptTypeId, 'id', true, 100) })
  return response.records
}
