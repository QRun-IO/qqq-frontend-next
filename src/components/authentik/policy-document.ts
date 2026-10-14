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
 * @file The policy document format of qbit-authentik (its docs/POLICY-FORMAT.md): a strict,
 * fail-closed parser and the canonical generator, byte-for-byte the same as the qbit's Java
 * `PolicyParser` and `PolicyGenerator`, so the editor's live preview is exactly what the
 * server validates and stores. The server checks everything again; this is for the preview.
 */

/** The actions a statement can grant, in canonical statement order. */
export const POLICY_ACTIONS = ['hasAccess', 'read', 'insert', 'edit', 'delete'] as const

/** One policy action. */
export type PolicyAction = (typeof POLICY_ACTIONS)[number]

/** A valid resource: a QQQ permission base name. */
export const RESOURCE_PATTERN = /^[A-Za-z0-9_]+$/

/** The spec and version a document must carry. */
export interface PolicyFormat {
  spec: string
  version: string
}

/** The outcome of parsing a document. */
export type PolicyParseResult =
  | { ok: true; permissions: Set<string>; resources: string[] }
  | { ok: false; error: string }

/**
 * Whether a string is one of the five actions.
 * @param value - Candidate.
 * @returns True for `hasAccess`, `read`, `insert`, `edit` or `delete`.
 */
export function isPolicyAction(value: string): value is PolicyAction {
  return (POLICY_ACTIONS as readonly string[]).includes(value)
}

/**
 * The QQQ permission an action grants on a resource.
 * @param resource - Permission base name.
 * @param action - Action.
 * @returns `{resource}.{action}`.
 */
export function permissionName(resource: string, action: PolicyAction): string {
  return `${resource}.${action}`
}

/**
 * Split a permission name into resource and action.
 * @param permission - `{resource}.{action}`.
 * @returns The parts, or null when it is not a valid policy permission.
 */
export function splitPermission(permission: string): { resource: string; action: PolicyAction } | null {
  const dot = permission.lastIndexOf('.')
  if (dot <= 0 || dot === permission.length - 1) return null
  const resource = permission.slice(0, dot)
  const action = permission.slice(dot + 1)
  if (!isPolicyAction(action) || !RESOURCE_PATTERN.test(resource)) return null
  return { resource, action }
}

/**
 * A short description of a found value for messages.
 * @param value - Anything.
 * @returns E.g. `"x"`, `nothing` or `number`.
 */
function describe(value: unknown): string {
  if (value === undefined || value === null) return 'nothing'
  if (typeof value === 'string') return `"${value.length > 40 ? `${value.slice(0, 40)}...` : value}"`
  return Array.isArray(value) ? 'array' : typeof value
}

/**
 * An array of strings, or an error message.
 * @param value - Candidate.
 * @param what - Where it is, for the message.
 * @returns The strings, or `{ error }`.
 */
function strings(value: unknown, what: string): string[] | { error: string } {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return { error: `${what} must be an array of strings` }
  return value as string[]
}

/**
 * Parse a document, failing closed: any problem is reported and grants nothing.
 * @param document - The document as JSON text or an object.
 * @param format - Expected spec and version.
 * @returns The permissions and resources, or the first problem.
 */
export function parsePolicy(document: unknown, format: PolicyFormat): PolicyParseResult {
  let json: unknown = document
  if (typeof document === 'string') {
    if (document.trim() === '') return { ok: false, error: 'The document is empty' }
    try {
      json = JSON.parse(document)
    } catch {
      return { ok: false, error: 'The document is not a JSON object' }
    }
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { ok: false, error: 'The document is not a JSON object' }
  const object = json as Record<string, unknown>
  if (object.PolicySpec !== format.spec) return { ok: false, error: `PolicySpec must be "${format.spec}" (found ${describe(object.PolicySpec)})` }
  if (object.PolicyVersion !== format.version) return { ok: false, error: `PolicyVersion must be "${format.version}" (found ${describe(object.PolicyVersion)})` }

  const permissions = new Set<string>()
  const resources: string[] = []
  if (object.Statement === undefined || object.Statement === null) return { ok: true, permissions, resources }
  if (!Array.isArray(object.Statement)) return { ok: false, error: 'Statement must be an array' }

  for (let i = 0; i < object.Statement.length; i++) {
    const statement = object.Statement[i] as unknown
    const n = i + 1
    if (typeof statement !== 'object' || statement === null || Array.isArray(statement)) return { ok: false, error: `Statement ${n} must be an object` }
    const s = statement as Record<string, unknown>
    if (s.Effect !== 'Allow') return { ok: false, error: `Statement ${n}: Effect must be "Allow" (found ${describe(s.Effect)}); Deny is not supported yet` }
    const actionNames = strings(s.Action, `Statement ${n}: Action`)
    if (!Array.isArray(actionNames)) return { ok: false, error: actionNames.error }
    const actions = new Set<PolicyAction>()
    for (const name of actionNames) {
      if (name === '*') POLICY_ACTIONS.forEach((action) => actions.add(action))
      else if (isPolicyAction(name)) actions.add(name)
      else return { ok: false, error: `Statement ${n}: unknown action "${name}"` }
    }
    const resourceNames = strings(s.Resource, `Statement ${n}: Resource`)
    if (!Array.isArray(resourceNames)) return { ok: false, error: resourceNames.error }
    for (const resource of resourceNames) {
      if (!RESOURCE_PATTERN.test(resource)) return { ok: false, error: `Statement ${n}: resource "${resource}" must match [A-Za-z0-9_]+` }
      if (!resources.includes(resource)) resources.push(resource)
      actions.forEach((action) => permissions.add(permissionName(resource, action)))
    }
  }
  return { ok: true, permissions, resources }
}

/** A generated document in both written forms. */
export interface GeneratedPolicy {
  /** Compact JSON, as stored on the group. */
  compact: string
  /** Pretty JSON (2-space indent, trailing newline), for reading. */
  pretty: string
  /** Statements in the document. */
  statementCount: number
}

/**
 * Compare strings by UTF-16 code units, like Java's `String.compareTo` (the qbit sorts with it).
 * @param a - First.
 * @param b - Second.
 * @returns Negative, zero or positive.
 */
function compareJava(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The canonical document for a set of permissions: one Allow statement per granted action in
 * the order hasAccess, read, insert, edit, delete; resources sorted; no `*`.
 * @param permissions - `{resource}.{action}` names; others are ignored.
 * @param format - Spec and version to write.
 * @returns The document, compact and pretty.
 */
export function generatePolicy(permissions: Iterable<string>, format: PolicyFormat): GeneratedPolicy {
  const byAction = new Map<PolicyAction, Set<string>>(POLICY_ACTIONS.map((action) => [action, new Set<string>()]))
  for (const permission of permissions) {
    const parts = splitPermission(permission)
    if (parts) byAction.get(parts.action)?.add(parts.resource)
  }
  const statements = POLICY_ACTIONS
    .map((action) => ({ action, resources: [...(byAction.get(action) ?? [])].sort(compareJava) }))
    .filter((statement) => statement.resources.length > 0)

  const q = (value: string) => JSON.stringify(value)
  const compactStatements = statements.map((s) => `{"Effect":"Allow","Action":[${q(s.action)}],"Resource":[${s.resources.map(q).join(',')}]}`)
  const compact = `{"PolicySpec":${q(format.spec)},"PolicyVersion":${q(format.version)},"Statement":[${compactStatements.join(',')}]}`

  const prettyStatements = statements.map((s) => [
    '    {',
    '      "Effect": "Allow",',
    `      "Action": [${q(s.action)}],`,
    '      "Resource": [',
    s.resources.map((r) => `        ${q(r)}`).join(',\n'),
    '      ]',
    '    }',
  ].join('\n'))
  const pretty = [
    '{',
    `  "PolicySpec": ${q(format.spec)},`,
    `  "PolicyVersion": ${q(format.version)},`,
    statements.length === 0 ? '  "Statement": []' : `  "Statement": [\n${prettyStatements.join(',\n')}\n  ]`,
    '}',
    '',
  ].join('\n')
  return { compact, pretty, statementCount: statements.length }
}

/**
 * Whether a document round-trips: parsing the generated document gives back exactly the
 * permissions it was generated from.
 * @param permissions - Valid policy permissions.
 * @param format - Spec and version.
 * @returns True when parse(generate(x)) equals x.
 */
export function roundTrips(permissions: Set<string>, format: PolicyFormat): boolean {
  const parsed = parsePolicy(generatePolicy(permissions, format).compact, format)
  if (!parsed.ok || parsed.permissions.size !== permissions.size) return false
  for (const permission of permissions) if (!parsed.permissions.has(permission)) return false
  return true
}
