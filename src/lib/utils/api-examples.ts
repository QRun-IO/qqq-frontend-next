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
 * @file API examples for the record developer view: the HTTP operations that apply to a record
 * (the v1 data API the UI uses, and application APIs from their OpenAPI specs), filtered by the
 * user's permissions, with copyable curl, fetch and Java snippets. Credentials are always
 * placeholders (an environment variable or `<your-session-uuid>`), never real values.
 */

import type { QFieldMetaData, QProcessMetaData, QRecord, QTableMetaData } from '@/types'

/** How a request authenticates. */
export type ApiAuth = 'session' | 'bearer' | 'apiKey'

/** HTTP methods the examples use. */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** One request a developer can make for the record. */
export interface ApiOperation {
  /** Stable id within its list. */
  id: string
  /** Short name, e.g. "Get this record". */
  label: string
  method: ApiMethod
  /** Absolute URL. */
  url: string
  description?: string
  /** Request body: JSON, or multipart form fields. */
  body?: { kind: 'json'; value: unknown } | { kind: 'form'; fields: Record<string, string> }
}

/** Snippet languages offered. */
export type SnippetLanguage = 'curl' | 'fetch' | 'java'

/** Placeholder environment variable for bearer tokens. */
export const TOKEN_ENV = 'QQQ_API_TOKEN'
/** Placeholder environment variable for API keys. */
export const API_KEY_ENV = 'QQQ_API_KEY'
/** Placeholder for a browser session cookie. */
export const SESSION_PLACEHOLDER = '<your-session-uuid>'

/** Field types whose values are not sent in example bodies. */
const NON_EXAMPLE_TYPES = new Set(['BLOB'])

/**
 * Whether a table has a capability; tables that publish none are not restricted.
 * @param table - Table metadata.
 * @param capability - Capability name.
 * @returns True when allowed.
 */
function hasCapability(table: QTableMetaData, capability: string): boolean {
  return !table.capabilities?.length || (table.capabilities as string[]).includes(capability)
}

/**
 * Example field values for writing the record: its editable, visible, non-key fields, with
 * their current values (JSON-safe scalars only).
 * @param table - Table metadata.
 * @param record - The record.
 * @returns Field name to value.
 */
export function exampleWriteValues(table: QTableMetaData, record: QRecord): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of Object.values(table.fields ?? {}) as QFieldMetaData[]) {
    if (!field.isEditable || field.isHidden || field.name === table.primaryKeyField || NON_EXAMPLE_TYPES.has(field.type)) continue
    const value = record.values[field.name]
    if (value === undefined || (value !== null && typeof value === 'object')) continue
    values[field.name] = value
  }
  return values
}

/**
 * The v1 data API operations (the routes the UI itself uses) for one record, filtered by the
 * user's table permissions and the table's capabilities, plus process init for the record's
 * processes the user may run.
 *
 * @param options - Inputs.
 * @param options.baseUrl - Absolute URL of the v1 API, ending in `/qqq/v1`.
 * @param options.table - Table metadata.
 * @param options.record - The record.
 * @param options.processes - Processes the record view offers (already permission-filtered).
 * @returns The operations, in a stable order.
 */
export function v1Operations({ baseUrl, table, record, processes }: {
  baseUrl: string
  table: QTableMetaData
  record: QRecord
  processes: QProcessMetaData[]
}): ApiOperation[] {
  const pk = record.values[table.primaryKeyField]
  const tablePath = `${baseUrl}/table/${encodeURIComponent(table.name)}`
  const recordPath = `${tablePath}/${encodeURIComponent(String(pk))}`
  const pkFilter = { filter: { criteria: [{ fieldName: table.primaryKeyField, operator: 'EQUALS', values: [pk] }] } }
  const writeValues = exampleWriteValues(table, record)
  const operations: ApiOperation[] = []

  if (table.readPermission) {
    if (hasCapability(table, 'TABLE_GET')) operations.push({ id: 'get', label: 'Get this record', method: 'GET', url: recordPath, description: 'The record with its values and display values.' })
    if (hasCapability(table, 'TABLE_QUERY')) operations.push({ id: 'query', label: 'Query by primary key', method: 'POST', url: `${tablePath}/query`, body: { kind: 'json', value: { ...pkFilter, filter: { ...pkFilter.filter, limit: 10 } } }, description: 'Any QQueryFilter: criteria, orderBys, skip and limit.' })
    if (hasCapability(table, 'TABLE_COUNT')) operations.push({ id: 'count', label: 'Count matching records', method: 'POST', url: `${tablePath}/count`, body: { kind: 'json', value: pkFilter } })
  }
  if (table.insertPermission && hasCapability(table, 'TABLE_INSERT')) {
    operations.push({ id: 'insert', label: 'Insert a copy', method: 'POST', url: tablePath, body: { kind: 'json', value: writeValues }, description: 'A new record with this record\'s editable values.' })
  }
  if (table.editPermission && hasCapability(table, 'TABLE_UPDATE')) {
    operations.push({ id: 'update', label: 'Update this record', method: 'PATCH', url: recordPath, body: { kind: 'json', value: writeValues }, description: 'Send only the fields to change; null clears a field.' })
  }
  if (table.deletePermission && hasCapability(table, 'TABLE_DELETE')) {
    operations.push({ id: 'delete', label: 'Delete this record', method: 'DELETE', url: recordPath })
  }
  for (const process of processes) {
    const fields: Record<string, string> = { recordsParam: 'recordIds', recordIds: String(pk) }
    if (process.tableName && process.tableName !== table.name) fields.tableName = table.name
    operations.push({
      id: `process-${process.name}`,
      label: `Run ${process.label}`,
      method: 'POST',
      url: `${baseUrl}/processes/${encodeURIComponent(process.name)}/init`,
      body: { kind: 'form', fields },
      description: 'Starts the process for this record; continue with /processes/{name}/{processUUID}/step/{stepName}.',
    })
  }
  return operations
}

/** What an application API's OpenAPI spec tells us about one table. */
export interface SpecOperations {
  /** Absolute base URL of the API version (the spec's first server). */
  serverUrl: string
  /** How the API authenticates. */
  auth: ApiAuth
  operations: ApiOperation[]
}

/**
 * Whether a value is a plain object.
 * @param value - Candidate.
 * @returns True for non-null, non-array objects.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The auth an OpenAPI spec declares: bearer for http bearer and OAuth2, an API key for apiKey
 * schemes, else bearer.
 * @param spec - The spec.
 * @returns The auth kind to show.
 */
function specAuth(spec: Record<string, unknown>): ApiAuth {
  const schemes = isObject(spec.components) && isObject(spec.components.securitySchemes) ? Object.values(spec.components.securitySchemes) : []
  for (const scheme of schemes) {
    if (isObject(scheme) && scheme.type === 'apiKey') return 'apiKey'
  }
  return 'bearer'
}

/**
 * The operations an application API's OpenAPI spec (for one table) offers, with path
 * parameters filled with the record's primary key, example bodies from the record's values,
 * and the user's table permissions applied (read for GET, insert for POST, edit for PATCH or
 * PUT, delete for DELETE; process endpoints are kept, as their permissions are the process's).
 *
 * @param options - Inputs.
 * @param options.spec - The parsed OpenAPI document of the table in one API version.
 * @param options.origin - Origin to resolve a relative server URL against.
 * @param options.table - Table metadata.
 * @param options.record - The record.
 * @returns The server, auth and operations; null for a document without paths.
 */
export function specOperations({ spec, origin, table, record }: {
  spec: unknown
  origin: string
  table: QTableMetaData
  record: QRecord
}): SpecOperations | null {
  if (!isObject(spec) || !isObject(spec.paths)) return null
  const servers = Array.isArray(spec.servers) ? spec.servers.filter(isObject) : []
  const serverUrl = new URL(typeof servers[0]?.url === 'string' ? servers[0].url : '/', origin).toString().replace(/\/$/, '')
  const pk = String(record.values[table.primaryKeyField])
  const writeValues = exampleWriteValues(table, record)
  const operations: ApiOperation[] = []

  // the record route is the table's shortest path ending in one parameter, e.g. /person/{id}; the
  // table's routes are under its base (/person, /person/query, /person/bulk), the rest are processes
  const recordRoute = Object.keys(spec.paths)
    .filter((path) => /^\/[^{}]*\/\{[^}]+\}$/.test(path))
    .sort((a, b) => a.split('/').length - b.split('/').length)[0]
  const basePath = recordRoute?.replace(/\/\{[^}]+\}$/, '')
  const tableRoutes = basePath === undefined ? null : new Set([basePath, `${basePath}/`, `${basePath}/query`, `${basePath}/bulk`, recordRoute])

  for (const [path, item] of Object.entries(spec.paths)) {
    if (!isObject(item)) continue
    const params = path.match(/\{[^}]+\}/g) ?? []
    if (params.length > 1) continue
    const filledPath = path.replace(/\{[^}]+\}/, encodeURIComponent(pk))
    const isBulk = /\/bulk$/.test(path)
    const isQuery = /\/query$/.test(path)
    const isTableRoute = tableRoutes === null || tableRoutes.has(path)
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = item[method]
      if (!isObject(operation)) continue
      const upper = method.toUpperCase() as ApiMethod
      if (isTableRoute && !permitted(table, upper)) continue
      if (isBulk && upper !== 'POST' && upper !== 'PATCH' && upper !== 'DELETE') continue
      let url = `${serverUrl}${filledPath}`
      if (isQuery && upper === 'GET') url += `?${encodeURIComponent(table.primaryKeyField)}=${encodeURIComponent(pk)}&pageSize=10`
      const label = typeof operation.summary === 'string' && operation.summary ? operation.summary : `${upper} ${path}`
      let body: ApiOperation['body']
      if (upper === 'POST' || upper === 'PATCH' || upper === 'PUT') {
        if (isBulk) body = { kind: 'json', value: upper === 'PATCH' ? [{ [table.primaryKeyField]: record.values[table.primaryKeyField], ...writeValues }] : [writeValues] }
        else if (isObject(operation.requestBody)) body = { kind: 'json', value: writeValues }
      } else if (upper === 'DELETE' && isBulk) {
        body = { kind: 'json', value: [record.values[table.primaryKeyField]] }
      }
      operations.push({ id: `${upper} ${path}`, label, method: upper, url, body, description: typeof operation.description === 'string' ? firstLine(operation.description) : undefined })
    }
  }
  return { serverUrl, auth: specAuth(spec), operations }
}

/**
 * Whether the user's table permissions allow an HTTP method on the table's routes.
 * @param table - Table metadata.
 * @param method - HTTP method.
 * @returns True when allowed.
 */
function permitted(table: QTableMetaData, method: ApiMethod): boolean {
  switch (method) {
    case 'GET': return table.readPermission
    case 'POST': return table.insertPermission
    case 'PUT':
    case 'PATCH': return table.editPermission
    case 'DELETE': return table.deletePermission
  }
}

/**
 * First line (sentence block) of a description.
 * @param text - Description.
 * @returns Its first non-empty line.
 */
function firstLine(text: string): string | undefined {
  return text.split('\n').map((line) => line.trim()).find(Boolean)
}

/**
 * Quotes a string for a POSIX shell (single quotes).
 * @param value - Text.
 * @returns The quoted text.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Builds a copyable snippet for an operation.
 * @param operation - The request.
 * @param auth - How it authenticates.
 * @param language - curl, fetch or java.
 * @returns The snippet source.
 */
export function buildSnippet(operation: ApiOperation, auth: ApiAuth, language: SnippetLanguage): string {
  switch (language) {
    case 'curl': return curlSnippet(operation, auth)
    case 'fetch': return fetchSnippet(operation, auth)
    case 'java': return javaSnippet(operation, auth)
  }
}

/**
 * curl snippet.
 * @param operation - The request.
 * @param auth - How it authenticates.
 * @returns Shell source.
 */
function curlSnippet(operation: ApiOperation, auth: ApiAuth): string {
  const lines = [`curl -X ${operation.method} ${shellQuote(operation.url)}`]
  if (auth === 'session') lines.push(`-b ${shellQuote(`sessionUUID=${SESSION_PLACEHOLDER}`)}`)
  if (auth === 'bearer') lines.push(`-H "Authorization: Bearer $${TOKEN_ENV}"`)
  if (auth === 'apiKey') lines.push(`-H "x-api-key: $${API_KEY_ENV}"`)
  if (operation.body?.kind === 'json') {
    lines.push(`-H 'Content-Type: application/json'`)
    lines.push(`-d ${shellQuote(JSON.stringify(operation.body.value, null, 2))}`)
  } else if (operation.body?.kind === 'form') {
    for (const [name, value] of Object.entries(operation.body.fields)) lines.push(`-F ${shellQuote(`${name}=${value}`)}`)
  }
  return lines.join(' \\\n  ')
}

/**
 * fetch (JavaScript / TypeScript) snippet.
 * @param operation - The request.
 * @param auth - How it authenticates.
 * @returns JavaScript source.
 */
function fetchSnippet(operation: ApiOperation, auth: ApiAuth): string {
  const headers: string[] = []
  if (auth === 'bearer') headers.push(`Authorization: \`Bearer \${process.env.${TOKEN_ENV}}\``)
  if (auth === 'apiKey') headers.push(`'x-api-key': process.env.${API_KEY_ENV}`)
  if (operation.body?.kind === 'json') headers.push(`'Content-Type': 'application/json'`)

  const lines: string[] = []
  if (operation.body?.kind === 'form') {
    lines.push('const body = new FormData()')
    for (const [name, value] of Object.entries(operation.body.fields)) lines.push(`body.append(${JSON.stringify(name)}, ${JSON.stringify(value)})`)
    lines.push('')
  }
  lines.push(`const response = await fetch(${JSON.stringify(operation.url)}, {`)
  lines.push(`  method: '${operation.method}',`)
  if (auth === 'session') lines.push(`  credentials: 'include', // the browser's QQQ session cookie`)
  if (headers.length) lines.push(`  headers: { ${headers.join(', ')} },`)
  if (operation.body?.kind === 'json') {
    const json = JSON.stringify(operation.body.value, null, 2).split('\n').join('\n  ')
    lines.push(`  body: JSON.stringify(${json}),`)
  } else if (operation.body?.kind === 'form') {
    lines.push('  body,')
  }
  lines.push('})')
  lines.push(`if (!response.ok) throw new Error(\`HTTP \${response.status}\`)`)
  lines.push('const data = await response.json()')
  return lines.join('\n')
}

/**
 * Quotes text as a Java string literal.
 * @param value - Text.
 * @returns The literal.
 */
function javaString(value: string): string {
  return JSON.stringify(value)
}

/**
 * Java 17+ (java.net.http) snippet.
 * @param operation - The request.
 * @param auth - How it authenticates.
 * @returns Java source.
 */
function javaSnippet(operation: ApiOperation, auth: ApiAuth): string {
  const lines: string[] = []
  const builder = [`HttpRequest.newBuilder(URI.create(${javaString(operation.url)}))`]
  if (auth === 'session') builder.push(`   .header("Cookie", "sessionUUID=" + System.getenv("QQQ_SESSION_UUID"))`)
  if (auth === 'bearer') builder.push(`   .header("Authorization", "Bearer " + System.getenv("${TOKEN_ENV}"))`)
  if (auth === 'apiKey') builder.push(`   .header("x-api-key", System.getenv("${API_KEY_ENV}"))`)

  if (operation.body?.kind === 'json') {
    builder.push(`   .header("Content-Type", "application/json")`)
    const json = JSON.stringify(operation.body.value, null, 2).split('\n').map((line) => `      ${line}`).join('\n')
    builder.push(`   .method("${operation.method}", HttpRequest.BodyPublishers.ofString("""\n${json}\n      """))`)
  } else if (operation.body?.kind === 'form') {
    lines.push('String boundary = "qqq" + UUID.randomUUID();')
    lines.push('StringBuilder form = new StringBuilder();')
    for (const [name, value] of Object.entries(operation.body.fields)) {
      lines.push(`form.append("--").append(boundary).append("\\r\\nContent-Disposition: form-data; name=\\"${name}\\"\\r\\n\\r\\n").append(${javaString(value)}).append("\\r\\n");`)
    }
    lines.push('form.append("--").append(boundary).append("--\\r\\n");')
    lines.push('')
    builder.push(`   .header("Content-Type", "multipart/form-data; boundary=" + boundary)`)
    builder.push(`   .method("${operation.method}", HttpRequest.BodyPublishers.ofString(form.toString()))`)
  } else {
    builder.push(`   .method("${operation.method}", HttpRequest.BodyPublishers.noBody())`)
  }
  builder.push('   .build();')

  lines.push('HttpClient client = HttpClient.newHttpClient();')
  lines.push(`HttpRequest request = ${builder.join('\n')}`)
  lines.push('HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());')
  lines.push('System.out.println(response.statusCode() + " " + response.body());')
  return lines.join('\n')
}
