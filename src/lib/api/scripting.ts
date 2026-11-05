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

/** @file Versioned isolated-scripting API; no legacy process or arbitrary-code routes. */

import { z } from 'zod'
import apiClient from './client'

const id = z.number().int().positive()
const nullableId = id.nullable()
const file = z.object({ path: z.string().max(100), content: z.string().max(262_144) })
const revision = z.object({ id, sequence: z.number().int().nullable(), message: z.string().nullable(), author: z.string().nullable() })
const status = z.object({
  id, revisionId: nullableId, artifactId: nullableId, version: nullableId,
  status: z.string().nullable(), actor: z.string().nullable(), createdAt: z.string().nullable(),
})
const project = z.object({
  scriptId: id, executionMode: z.enum(['LEGACY', 'ISOLATED']), latestRevisionId: nullableId,
  revisions: z.array(revision).max(100), builds: z.array(status).max(100), publications: z.array(status).max(100),
  actions: z.array(z.string()), workerAvailable: z.boolean(), importAvailable: z.boolean().default(false),
})
const provenance = z.object({ repository: z.string(), commitSha: z.string().regex(/^[a-f0-9]{40}$/), subdirectory: z.string(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), importedBy: z.string() })
const draft = z.object({ revisionId: id, sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), files: z.array(file).min(1).max(200), provenance: provenance.nullish() })
const build = z.object({
  buildId: id, success: z.boolean(), artifactId: nullableId, artifactVersion: nullableId,
  diagnostics: z.array(z.object({ file: z.string(), line: z.number().int(), column: z.number().int(), code: z.string(), message: z.string() })).max(100),
})
const result = z.object({ executionId: id, status: z.string(), message: z.string().nullable(), contextJson: z.string().nullable() })

/** Explicit read grant; runtime rechecks every table, field and budget. */
export const scriptCapabilitySchema = z.object({
  operation: z.literal('READ'), table: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  fields: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).min(1).max(100),
  maxRows: z.number().int().min(1).max(500), maxCalls: z.number().int().min(1).max(20),
}).strict()

/** A bounded source file in the shared Script registry. */
export type ScriptSourceFile = z.infer<typeof file>
/** Current authorized authoring controls and recent immutable history. */
export type ScriptProject = z.infer<typeof project>
/** Outcome of compilation, which never publishes automatically. */
export type ScriptBuild = z.infer<typeof build>
/** Audited context-test result. */
export type ScriptContextResult = z.infer<typeof result>
/** Explicit read-only declaration sent with a build or narrowed test. */
export type ScriptCapability = z.infer<typeof scriptCapabilitySchema>
/** Retained origin of an imported immutable source revision. */
export type ScriptProvenance = z.infer<typeof provenance>

/**
 * Create a server-marked isolated project; mode and actor are never submitted.
 * @param name - Human project name.
 * @param signal - Cancels observation, not server persistence.
 * @returns New core project identity.
 */
export async function createScriptProject(name: string, signal?: AbortSignal): Promise<number> {
  const validated = z.string().trim().min(1).max(200).parse(name)
  return z.object({ id }).parse(await apiClient.post('/qbit/scripting/projects', { name: validated }, { signal })).id
}

/**
 * Explicitly import one immutable repository commit as an ordinary draft.
 * @param scriptId - Core Script id.
 * @param baseRevisionId - Observed latest revision, rejecting stale changes.
 * @param repository - Authorized GitHub owner/repository.
 * @param commitSha - Full immutable commit id; branches are not accepted.
 * @param subdirectory - Dedicated TypeScript subtree, or null for the root.
 * @param signal - Cancels observation, not committed server work.
 * @returns New source revision identity; never builds or publishes automatically.
 */
export async function importScriptDraft(scriptId: string | number, baseRevisionId: number | null, repository: string, commitSha: string, subdirectory: string | null, signal?: AbortSignal) {
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('A full lowercase 40-character commit SHA is required')
  return z.object({ id }).parse(await apiClient.post(`${scriptProjectPath(scriptId)}/imports`, { baseRevisionId, repository, commitSha, subdirectory }, { signal, timeout: 60_000 })).id
}

/**
 * Validate and encode an immutable project identity.
 * @param scriptId - Positive core Script id.
 * @returns Relative versioned extension path.
 */
function scriptProjectPath(scriptId: string | number): string {
  const value = String(scriptId)
  if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 2_147_483_647) throw new Error('Invalid script identity')
  return `/qbit/scripting/projects/${value}`
}

/**
 * Read current permissions and recent revisions/builds/publications.
 * @param scriptId - Core Script id.
 * @param signal - Optional observation cancellation.
 * @returns Validated project status.
 */
export async function getScriptProject(scriptId: string | number, signal?: AbortSignal): Promise<ScriptProject> {
  return project.parse(await apiClient.get(scriptProjectPath(scriptId), { signal }))
}

/**
 * Load a saved immutable source revision within its owning project.
 * @param scriptId - Core Script id.
 * @param revisionId - Immutable revision id.
 * @param signal - Optional observation cancellation.
 * @returns Validated source snapshot.
 */
export async function getScriptDraft(scriptId: string | number, revisionId: number, signal?: AbortSignal) {
  return draft.parse(await apiClient.get(`${scriptProjectPath(scriptId)}/revisions/${id.parse(revisionId)}`, { signal }))
}

/**
 * Append source; an optimistic base mismatch requires reloading.
 * @param scriptId - Core Script id.
 * @param baseRevisionId - Latest revision observed before editing, or null.
 * @param files - Complete new source snapshot.
 * @param message - Human revision note.
 * @param signal - Optional observation cancellation.
 * @returns New immutable source revision id.
 */
export async function saveScriptDraft(scriptId: string | number, baseRevisionId: number | null, files: ScriptSourceFile[], message: string, signal?: AbortSignal) {
  return z.object({ id }).parse(await apiClient.post(`${scriptProjectPath(scriptId)}/drafts`, { baseRevisionId, files, message }, { signal })).id
}

/**
 * Strictly compile a saved revision in the configured isolated worker.
 * @param scriptId - Core Script id.
 * @param revisionId - Saved revision to compile.
 * @param entryPoint - Source entry file.
 * @param capabilities - Explicit read declarations.
 * @param signal - Cancels observation, not server execution.
 * @returns Bounded build result and diagnostics.
 */
export async function compileScriptRevision(scriptId: string | number, revisionId: number, entryPoint: string, capabilities: ScriptCapability[], signal?: AbortSignal): Promise<ScriptBuild> {
  return build.parse(await apiClient.post(`${scriptProjectPath(scriptId)}/builds`, { revisionId, entryPoint, capabilities }, { signal, timeout: 150_000 }))
}

/**
 * Read a previous build without exposing its executable bundle.
 * @param scriptId - Core Script id.
 * @param buildId - Immutable build id.
 * @param signal - Optional observation cancellation.
 * @returns Bounded diagnostic details.
 */
export async function getScriptBuild(scriptId: string | number, buildId: number, signal?: AbortSignal): Promise<ScriptBuild> {
  return build.parse(await apiClient.get(`${scriptProjectPath(scriptId)}/builds/${id.parse(buildId)}`, { signal }))
}

/**
 * Test the built artifact with bounded JSON; this does not publish or bind it.
 * @param scriptId - Core Script id.
 * @param buildId - Immutable build id.
 * @param input - JSON context fixture.
 * @param capabilities - Granted subset of the build declarations.
 * @param signal - Cancels observation, not server execution.
 * @returns Audited execution status and context JSON.
 */
export async function testScriptContext(scriptId: string | number, buildId: number, input: Record<string, unknown>, capabilities: ScriptCapability[], signal?: AbortSignal): Promise<ScriptContextResult> {
  return result.parse(await apiClient.post(`${scriptProjectPath(scriptId)}/builds/${id.parse(buildId)}/test-context`, { input, capabilities }, { signal, timeout: 150_000 }))
}

/**
 * Publish one tested build with a separate explicit user action.
 * @param scriptId - Core Script id.
 * @param buildId - Immutable build id.
 * @param note - Publication note.
 * @param signal - Optional observation cancellation.
 * @returns New immutable publication id.
 */
export async function publishScriptBuild(scriptId: string | number, buildId: number, note: string, signal?: AbortSignal) {
  return z.object({ id }).parse(await apiClient.post(`${scriptProjectPath(scriptId)}/builds/${id.parse(buildId)}/publications`, { note }, { signal })).id
}

/**
 * Generate declarations only for requested, currently readable capabilities.
 * @param scriptId - Core Script id.
 * @param capabilities - Requested read declarations.
 * @param signal - Optional observation cancellation.
 * @returns Scoped @qqq/sdk declaration text.
 */
export async function getScriptApiTypes(scriptId: string | number, capabilities: ScriptCapability[], signal?: AbortSignal) {
  return z.object({ declarations: z.string().max(262_144) }).parse(await apiClient.post(`${scriptProjectPath(scriptId)}/typings`, { capabilities }, { signal })).declarations
}

/** Native phases: POST observes backend actions; AFTER is dispatched from a committed Jobs intent. */
export const scriptHookEventSchema = z.enum(['PRE_INSERT', 'PRE_UPDATE', 'PRE_DELETE', 'POST_INSERT', 'POST_UPDATE', 'POST_DELETE', 'AFTER_INSERT', 'AFTER_UPDATE', 'AFTER_DELETE'])
const hookPhase = z.object({ event: scriptHookEventSchema, patchableFields: z.array(z.string()).max(1000) })
const hookTarget = z.object({ tableName: z.string(), label: z.string().nullable(), phases: z.array(hookPhase).max(9) })
const binding = z.object({
  id, name: z.string(), tableName: z.string(), event: scriptHookEventSchema, publicationId: id, enabled: z.boolean(),
  grants: z.array(scriptCapabilitySchema).max(20), patchableFields: z.array(z.string()).max(100),
})
const hookView = z.object({ targets: z.array(hookTarget).max(200), bindings: z.array(binding).max(100), historyLimited: z.boolean(), nextBindingId: nullableId })
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])
const hookResult = result.extend({ hook: z.object({ action: z.enum(['ALLOW', 'REJECT', 'PATCH']), message: z.string().nullable(), patch: z.record(z.string(), scalar).nullable() }).nullable() })
/** Host-installed phase chosen for a dry run or binding. */
export type ScriptHookEvent = z.infer<typeof scriptHookEventSchema>
/** Bounded authorized target and retained binding view. */
export type ScriptHookView = z.infer<typeof hookView>
/** Audited simulated decision; no native mutation occurred. */
export type ScriptHookResult = z.infer<typeof hookResult>

/**
 * Discover host-installed phases and recent project bindings.
 * @param scriptId - Current source project.
 * @param signal - Optional observation cancellation.
 * @param beforeBindingId - Exclusive keyset cursor for retained older bindings.
 * @returns Current authorized targets and bounded binding history.
 */
export async function getScriptHooks(scriptId: string | number, signal?: AbortSignal, beforeBindingId: number | null = null): Promise<ScriptHookView> {
  return hookView.parse(await apiClient.get(`${scriptProjectPath(scriptId)}/hooks`, { signal, params: beforeBindingId === null ? undefined : { beforeBindingId: id.parse(beforeBindingId) } }))
}

/**
 * Pin a published script to an explicitly installed record event.
 * @param scriptId - Owning source project.
 * @param input - Explicit binding and narrowed capabilities.
 * @param signal - Cancels observation, not a committed binding.
 * @returns New binding identity with an atomic audit receipt.
 */
export async function createScriptBinding(scriptId: string | number, input: {
  name: string; tableName: string; event: ScriptHookEvent; publicationId: number; capabilities: ScriptCapability[]; patchableFields: string[]
}, signal?: AbortSignal): Promise<number> {
  const checked = z.object({ name: z.string().trim().min(1).max(200), tableName: z.string().min(1).max(200), event: scriptHookEventSchema,
    publicationId: id, capabilities: z.array(scriptCapabilitySchema).max(20), patchableFields: z.array(z.string().max(100)).max(100),
  }).strict().parse(input)
  return z.object({ id }).parse(await apiClient.post(`${scriptProjectPath(scriptId)}/bindings`, checked, { signal })).id
}

/**
 * Change enabled state without editing a service-owned table directly.
 * @param scriptId - Owning source project.
 * @param bindingId - Pinned binding.
 * @param enabled - Explicit next state.
 * @param signal - Cancels observation, not server persistence.
 * @returns The exact binding whose state was committed.
 */
export async function setScriptBindingEnabled(scriptId: string | number, bindingId: number, enabled: boolean, signal?: AbortSignal): Promise<number> {
  return z.object({ id }).parse(await apiClient.post(`${scriptProjectPath(scriptId)}/bindings/${id.parse(bindingId)}/state`, { enabled: z.boolean().parse(enabled) }, { signal })).id
}

/**
 * Simulate an event using an authorized current record, with no record writes.
 * @param scriptId - Owning source project.
 * @param buildId - Saved immutable build to test.
 * @param input - Target/event, actual record identity and proposed scalar changes.
 * @param signal - Cancels observation, not isolated execution.
 * @returns Audited decision; returned patches have not been applied or natively validated.
 */
export async function testScriptHook(scriptId: string | number, buildId: number, input: {
  tableName: string; event: ScriptHookEvent; recordId: string; changes: unknown
}, signal?: AbortSignal): Promise<ScriptHookResult> {
  const checked = z.object({ tableName: z.string().min(1).max(200), event: scriptHookEventSchema, recordId: z.string().trim().min(1).max(1024),
    changes: z.record(z.string(), scalar).refine((value) => Object.keys(value).length <= 100, 'At most 100 changes are permitted'),
  }).strict().parse(input)
  return hookResult.parse(await apiClient.post(`${scriptProjectPath(scriptId)}/builds/${id.parse(buildId)}/test-hook`, checked, { signal, timeout: 150_000 }))
}
