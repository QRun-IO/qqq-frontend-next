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


/** @file Browser-worker transport with bounded requests, deadlines and explicit termination. */

import { IDE_VERSION, validateIdeRequest, type IdeFile, type IdeOperation, type IdeRequest, type IdeResult } from './typescript-session'
import { z } from 'zod'

const offset = z.number().int().min(0).max(262_144)
const results = {
  diagnostics: z.object({ diagnostics: z.array(z.object({ from: offset, to: offset, code: z.number().int(), severity: z.enum(['error', 'warning']), message: z.string().max(1000) }).strict()).max(100) }).strict(),
  completion: z.object({ completions: z.array(z.object({ label: z.string().max(200), type: z.string().max(100), detail: z.string().max(100), from: offset, to: offset }).strict()).max(100) }).strict(),
  hover: z.object({ hover: z.object({ from: offset, to: offset, text: z.string().max(4000) }).strict().nullable() }).strict(),
  definition: z.object({ definitions: z.array(z.object({ file: z.string().max(100), from: offset, to: offset }).strict()).max(20) }).strict(),
  format: z.object({ edits: z.array(z.object({ from: offset, to: offset, insert: z.string().max(262_144) }).strict()).max(1000) }).strict(),
}

/** Minimal browser worker seam for deterministic lifecycle tests. */
export interface IdeWorker {
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage: (request: IdeRequest) => void
  terminate: () => void
}

/** The finite queue refused a request; nothing was sent and nothing failed, so a caller may re-admit it once the queue drains. */
export class EditorAnalysisBusyError extends Error {
  constructor() { super('Editor analysis queue is full'); this.name = 'EditorAnalysisBusyError' }
}

/** Browser analysis is advisory; its result cannot publish or run a script. */
export class TypeScriptWorkerClient {
  private worker: IdeWorker | null = null
  private nextId = 1
  private warm = false
  private served = 0
  private disposed = false
  private idle: ReturnType<typeof setTimeout> | null = null
  private readonly pending = new Map<number, { operation: IdeOperation; resolve: (value: IdeResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()

  /**
   * Construct lazily; only opening an isolated editor downloads the trusted worker.
   * @param factory - Browser implementation or a trusted test fixture.
   */
  constructor(private readonly factory: () => IdeWorker = () => new Worker('/scripting-generated/typescript-6.0.3.worker.js')) {}

  /**
   * Analyze an immutable in-memory snapshot without giving it browser capabilities.
   * @param operation - Advisory feature to compute.
   * @param files - Current source buffers.
   * @param file - Active source path.
   * @param position - UTF-16 cursor offset.
   * @param declarations - Server-filtered SDK declaration text, or empty fallback.
   * @returns Bounded plain-text results from the language service.
   */
  request(operation: IdeOperation, files: IdeFile[], file: string, position: number, declarations = ''): Promise<IdeResult> {
    if (this.disposed) return Promise.reject(new Error('Editor analysis is closed'))
    if (this.pending.size >= 4) return Promise.reject(new EditorAnalysisBusyError())
    let request: IdeRequest
    try { request = validateIdeRequest({ id: this.nextId++, operation, files, file, position, declarations }) }
    catch { return Promise.reject(new Error('Editor source or request exceeds supported limits')) }
    if (this.idle) { clearTimeout(this.idle); this.idle = null }
    try {
      if (!this.worker) {
        this.worker = this.factory()
        this.worker.onmessage = (event) => this.receive(event.data)
        this.worker.onerror = () => this.stop('Editor analysis worker failed')
      }
    } catch { return Promise.reject(new Error('Editor analysis worker is unavailable')) }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop('Editor analysis exceeded its time limit'), this.warm ? 3_000 : 10_000)
      this.pending.set(request.id, { operation, resolve, reject, timer })
      try { this.worker!.postMessage(request) }
      catch { this.stop('Editor request could not be sent') }
    })
  }

  /**
   * Validate the envelope before releasing results to UI consumers.
   * @param message - Structured-cloned worker response.
   */
  private receive(message: unknown) {
    try {
      const value = message as { protocol: string; version: string; id: number; result?: IdeResult; error?: string }
      if (!value || value.protocol !== 'qqq-typescript-ide/1' || value.version !== IDE_VERSION || !this.pending.has(value.id)
        || new TextEncoder().encode(JSON.stringify(value)).length > 262_144
        || (value.result === undefined) === (value.error === undefined)) throw new Error('Invalid editor response')
      const pending = this.pending.get(value.id)!
      const result = value.error ? null : results[pending.operation].parse(value.result)
      clearTimeout(pending.timer)
      this.pending.delete(value.id)
      this.warm = true
      if (value.error) pending.reject(new Error('Editor analysis could not be completed'))
      else pending.resolve(result!)
      this.served++
      if (!this.pending.size) {
        if (this.served >= 200) this.stop('Editor analysis cache renewed')
        else this.idle = setTimeout(() => this.stop('Idle editor analysis released'), 30_000)
      }
    } catch { this.stop('Editor analysis returned an invalid response') }
  }

  /**
   * Terminate CPU work and reject every queued operation; no implicit retry occurs.
   * @param reason - Generic local diagnostic without user source.
   */
  private stop(reason: string) {
    this.worker?.terminate()
    this.worker = null
    this.warm = false
    this.served = 0
    if (this.idle) { clearTimeout(this.idle); this.idle = null }
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error(reason)) }
    this.pending.clear()
  }

  /** Unmount permanently closes this client and all its pending analysis. */
  dispose() { this.disposed = true; this.stop('Editor analysis is closed') }
}

