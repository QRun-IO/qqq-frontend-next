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


/** @file Offline TypeScript language service. Reads only bounded virtual source and shipped libraries. */

import type ts from 'typescript-editor'

/** One virtual source file. */
export interface IdeFile { path: string; content: string }
/** Advisory editor operation; no emit or execution operation exists. */
export type IdeOperation = 'diagnostics' | 'completion' | 'hover' | 'definition' | 'format'
/** Bounded editor request carrying a complete in-memory project snapshot. */
export interface IdeRequest {
  id: number
  operation: IdeOperation
  files: IdeFile[]
  file: string
  position: number
  declarations: string
}
/** Serializable diagnostic or edit coordinates use UTF-16 offsets, like CodeMirror. */
export interface IdeDiagnostic { from: number; to: number; message: string; severity: 'error' | 'warning'; code: number }
/** Plain-text completion; documentation cannot introduce executable markup. */
export interface IdeCompletion { label: string; type: string; detail: string; from: number; to: number }
/** A definition within the user's virtual files. */
export interface IdeDefinition { file: string; from: number; to: number }
/** Formatting edits apply only if the originating snapshot is still current. */
export interface IdeEdit { from: number; to: number; insert: string }
/** The response never includes compiler objects or executable output. */
export interface IdeResult {
  diagnostics?: IdeDiagnostic[]
  completions?: IdeCompletion[]
  hover?: { from: number; to: number; text: string } | null
  definitions?: IdeDefinition[]
  edits?: IdeEdit[]
}

export const IDE_VERSION = '6.0.3'
export const IDE_MAX_FILES = 200
export const IDE_MAX_SOURCE_BYTES = 2 * 1024 * 1024
export const IDE_MAX_FILE_BYTES = 256 * 1024
export const IDE_MAX_DECLARATION_BYTES = 128 * 1024

/** Fallback matches the isolated read SDK; scoped server declarations may narrow it. */
export const IDE_SDK = `declare module "@qqq/sdk" {
 export type Scalar = string | number | boolean | null;
 export interface Criterion { field: string; operator: "EQUALS" | "NOT_EQUALS" | "IN" | "LESS_THAN" | "LESS_THAN_OR_EQUALS" | "GREATER_THAN" | "GREATER_THAN_OR_EQUALS"; values: Scalar[] }
 export interface Qqq { query(table: string, fields: string[], criteria?: Criterion[], limit?: number): Promise<ReadonlyArray<Readonly<Record<string, Scalar>>>> }
 export type HookEvent = "PRE_INSERT" | "PRE_UPDATE" | "PRE_DELETE" | "POST_INSERT" | "POST_UPDATE" | "POST_DELETE" | "AFTER_INSERT" | "AFTER_UPDATE" | "AFTER_DELETE";
 export type CommittedEvent = Readonly<{ id: string; tableName: string; recordId: Exclude<Scalar, null>; dryRun?: boolean }> & (Readonly<{ dataState: "CURRENT"; record: Readonly<Record<string, unknown>> }> | Readonly<{ dataState: "DELETED_METADATA"; record?: never }>);
 export interface Context { readonly event: HookEvent | "CONTEXT"; readonly payload: Readonly<Record<string, unknown>> & { readonly event?: CommittedEvent } }
 export type HookResult = { action: "ALLOW" } | { action: "REJECT"; message: string } | { action: "PATCH"; patch: Record<string, Scalar> };
}`

/**
 * Validate before posting to the worker and again at its entry point.
 * @param request - Untrusted message shape.
 * @returns Valid typed request or throws without parsing source code.
 */
export function validateIdeRequest(request: unknown): IdeRequest {
  const r = request as IdeRequest
  if (!r || !Number.isSafeInteger(r.id) || r.id < 1 || !['diagnostics', 'completion', 'hover', 'definition', 'format'].includes(r.operation)
    || !Array.isArray(r.files) || r.files.length < 1 || r.files.length > IDE_MAX_FILES || typeof r.declarations !== 'string'
    || new TextEncoder().encode(r.declarations).length > IDE_MAX_DECLARATION_BYTES) throw new Error('Invalid editor request')
  const seen = new Set<string>()
  let bytes = 0
  for (const file of r.files) {
    if (!file || typeof file.path !== 'string' || file.path.length > 100 || !file.path.endsWith('.ts')
      || file.path.split('/').some((part) => !/^[A-Za-z_0-9][A-Za-z_0-9.-]*$/.test(part) || part.includes('..'))
      || typeof file.content !== 'string' || file.content.includes('\0') || seen.has(file.path.toLowerCase())) throw new Error('Invalid editor source')
    seen.add(file.path.toLowerCase())
    const size = new TextEncoder().encode(file.content).length
    bytes += size
    if (size > IDE_MAX_FILE_BYTES || bytes > IDE_MAX_SOURCE_BYTES) throw new Error('Editor source limit exceeded')
  }
  const current = r.files.find((file) => file.path === r.file)
  if (!current || !Number.isSafeInteger(r.position) || r.position < 0 || r.position > current.content.length) throw new Error('Invalid editor position')
  return r
}

/**
 * A persistent advisory language-service session with no filesystem or network.
 * Library contents are trusted build-time copies from the pinned compiler package.
 */
export class TypeScriptSession {
  private readonly sources = new Map<string, string>()
  private readonly versions = new Map<string, number>()
  private readonly service: ts.LanguageService
  private revision = 0

  /**
   * Create a virtual host with the same strict flags and source import shape as the server.
   * @param compiler - Exact editor-only TypeScript package.
   * @param libraries - Shipped ES2022 standard declarations, with no DOM or Node types.
   */
  constructor(private readonly compiler: typeof ts, private readonly libraries: Readonly<Record<string, string>>) {
    if (compiler.version !== IDE_VERSION) throw new Error('Editor TypeScript version mismatch')
    const options: ts.CompilerOptions = {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noEmit: true,
      target: compiler.ScriptTarget.ES2022, module: compiler.ModuleKind.ES2022,
      moduleResolution: compiler.ModuleResolutionKind.Bundler, types: [], lib: ['lib.es2022.d.ts'],
      skipLibCheck: false, allowJs: false,
    }
    const read = (file: string) => this.sources.get(file) ?? this.libraries[file]
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => options,
      getProjectVersion: () => String(this.revision),
      getScriptFileNames: () => [...this.sources.keys()],
      getScriptVersion: (file) => String(this.versions.get(file) ?? 0),
      getScriptSnapshot: (file) => { const value = read(file); return value === undefined ? undefined : compiler.ScriptSnapshot.fromString(value) },
      getCurrentDirectory: () => '/src',
      getDefaultLibFileName: () => '/lib/lib.es2022.d.ts',
      fileExists: (file) => read(file) !== undefined,
      readFile: read,
      readDirectory: () => [],
      directoryExists: (directory) => directory === '/src' || directory === '/sdk' || directory === '/lib' || [...this.sources.keys()].some((file) => file.startsWith(directory + '/')),
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      resolveModuleNameLiterals: (names, containing) => names.map((literal) => {
        if (literal.text === '@qqq/sdk') return { resolvedModule: { resolvedFileName: '/sdk/qqq.d.ts', extension: compiler.Extension.Dts } }
        if (!/^(\.\/|\.\.\/)/.test(literal.text) || !literal.text.endsWith('.js')) return { resolvedModule: undefined }
        const segments = containing.split('/').slice(0, -1)
        for (const part of literal.text.split('/')) {
          if (part === '..') segments.pop()
          else if (part !== '.') segments.push(part)
        }
        const file = segments.join('/').replace(/\.js$/, '.ts')
        return { resolvedModule: file.startsWith('/src/') && this.sources.has(file) ? { resolvedFileName: file, extension: compiler.Extension.Ts } : undefined }
      }),
    }
    this.service = compiler.createLanguageService(host, compiler.createDocumentRegistry())
  }

  /**
   * Update changed virtual files, then compute only the requested advisory feature.
   * @param input - Bounded project and operation.
   * @returns Plain, bounded result.
   */
  run(input: IdeRequest): IdeResult {
    const request = validateIdeRequest(input)
    const next = new Map(request.files.map((file) => ['/src/' + file.path, file.content]))
    next.set('/sdk/qqq.d.ts', request.declarations || IDE_SDK)
    for (const [file, content] of next) {
      if (this.sources.get(file) !== content) this.versions.set(file, (this.versions.get(file) ?? 0) + 1)
    }
    for (const file of this.sources.keys()) if (!next.has(file)) this.versions.delete(file)
    this.sources.clear()
    for (const [file, content] of next) this.sources.set(file, content)
    this.revision++
    const file = '/src/' + request.file
    const position = request.position
    const compiler = this.compiler
    switch (request.operation) {
      case 'diagnostics': {
        const values = [...this.service.getSyntacticDiagnostics(file), ...this.service.getSemanticDiagnostics(file)]
        return { diagnostics: values.slice(0, 100).map((item) => ({
          from: item.start ?? 0, to: (item.start ?? 0) + (item.length ?? 0), code: item.code,
          severity: item.category === compiler.DiagnosticCategory.Error ? 'error' : 'warning',
          message: compiler.flattenDiagnosticMessageText(item.messageText, ' ').slice(0, 1000),
        })) }
      }
      case 'completion': {
        const result = this.service.getCompletionsAtPosition(file, position, { includeCompletionsForModuleExports: false, includeCompletionsWithInsertText: false })
        const start = position - (this.sources.get(file)!.slice(0, position).match(/[\w$]*$/)?.[0].length ?? 0)
        return { completions: result?.entries.slice(0, 100).map((entry) => ({
          label: entry.name.slice(0, 200), type: entry.kind, detail: (entry.kindModifiers ?? '').slice(0, 100),
          from: entry.replacementSpan?.start ?? result.optionalReplacementSpan?.start ?? start,
          to: entry.replacementSpan ? entry.replacementSpan.start + entry.replacementSpan.length : position,
        })) ?? [] }
      }
      case 'hover': {
        const info = this.service.getQuickInfoAtPosition(file, position)
        return { hover: info ? { from: info.textSpan.start, to: info.textSpan.start + info.textSpan.length,
          text: (compiler.displayPartsToString(info.displayParts) + '\n' + compiler.displayPartsToString(info.documentation)).trim().slice(0, 4000) } : null }
      }
      case 'definition':
        return { definitions: this.service.getDefinitionAtPosition(file, position)?.filter((item) => item.fileName.startsWith('/src/')).slice(0, 20)
          .map((item) => ({ file: item.fileName.slice(5), from: item.textSpan.start, to: item.textSpan.start + item.textSpan.length })) ?? [] }
      case 'format': {
        const edits = this.service.getFormattingEditsForDocument(file, {
          indentSize: 2, tabSize: 2, convertTabsToSpaces: true, newLineCharacter: '\n',
          insertSpaceAfterCommaDelimiter: true, insertSpaceAfterKeywordsInControlFlowStatements: true,
          insertSpaceBeforeAndAfterBinaryOperators: true,
        })
        if (edits.length > 1000) throw new Error('Formatting edit limit exceeded')
        return { edits: edits.map((edit) => ({ from: edit.span.start, to: edit.span.start + edit.span.length, insert: edit.newText })) }
      }
    }
  }

  /** Release all compiler caches when the trusted worker is disposed. */
  dispose() { this.service.dispose(); this.sources.clear(); this.versions.clear() }
}

