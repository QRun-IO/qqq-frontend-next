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
 * @file assistant-attachments — what the assistant panel lets a user attach. A server that reads
 * attachments (`features.attachments` in `GET /assistant/config`) takes text, Markdown, PDF,
 * images and data files up to `limits.maxAttachmentBytes`; older servers only use attached
 * CSV/Excel files for bulk loads. The accept list is a hint for the file picker: the server
 * checks the content itself.
 */

import type { AssistantConfig } from '@/types/assistant'

/** Most files attached to one conversation at a time. */
export const MAX_ATTACHMENTS = 5

/** File picker hint when the server only uses attachments for bulk loads. */
export const BULK_LOAD_ACCEPT = '.csv,.tsv,.txt,.xlsx'

/** File picker hint when the server reads attachments. */
export const ATTACHMENTS_ACCEPT = [
  '.txt', '.md', '.markdown', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.csv', '.tsv', '.xlsx', '.json',
  'text/plain', 'text/markdown', 'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/csv',
  'text/tab-separated-values', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json',
].join(',')

/** How the panel offers attaching. */
export interface AttachmentPolicy {
  /** Whether the attach button is shown. */
  enabled: boolean
  /** The server reads attachments (wide types); false for the bulk-load fallback. */
  reads: boolean
  /** The file input's accept hint. */
  accept: string
  /** The attach button's tooltip. */
  title: string
  /** Largest file in bytes, when the server says. */
  maxBytes?: number
  /** Human-readable types the server reads, when it says. */
  types?: string[]
}

/**
 * Derives the attach policy from the assistant config, falling back to the bulk-load behaviour
 * (CSV or Excel files, only where saved bulk load profiles exist) when the server does not
 * announce attachment reading.
 *
 * @param config - `GET /assistant/config`, or null.
 * @param bulkLoadAvailable - Whether the instance stores saved bulk load profiles.
 * @returns The policy.
 */
export function attachmentPolicy(config: AssistantConfig | null | undefined, bulkLoadAvailable: boolean): AttachmentPolicy {
  if (config?.features?.attachments === true) {
    return {
      enabled: true,
      reads: true,
      accept: ATTACHMENTS_ACCEPT,
      title: 'Attach a file',
      ...(config.limits?.maxAttachmentBytes ? { maxBytes: config.limits.maxAttachmentBytes } : {}),
      ...(config.limits?.attachmentTypes?.length ? { types: config.limits.attachmentTypes } : {}),
    }
  }
  return { enabled: bulkLoadAvailable, reads: false, accept: BULK_LOAD_ACCEPT, title: 'Attach a file (CSV or Excel) for a bulk load' }
}

/**
 * A byte count for people (`512 KB`, `2.5 MB`).
 *
 * @param bytes - The size.
 * @returns The formatted size.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** The icon family of an attachment. */
export type AttachmentKind = 'image' | 'spreadsheet' | 'json' | 'pdf' | 'text' | 'file'

/**
 * Picks an attachment's kind from its content type or, failing that, its name.
 *
 * @param fileName - The file name.
 * @param contentType - The content type, when known.
 * @returns The kind.
 */
export function attachmentKind(fileName: string | undefined, contentType?: string): AttachmentKind {
  const type = (contentType ?? '').toLowerCase()
  const extension = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'image'
  if (type === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (type.includes('json') || extension === 'json') return 'json'
  if (type.includes('csv') || type.includes('spreadsheet') || type.includes('tab-separated') || ['csv', 'tsv', 'xlsx'].includes(extension)) return 'spreadsheet'
  if (type.startsWith('text/') || ['txt', 'md', 'markdown'].includes(extension)) return 'text'
  return 'file'
}

/**
 * Checks a picked file before uploading it.
 *
 * @param file - The file (name and size only; the content is never read here).
 * @param policy - The attach policy.
 * @param attached - How many files are attached already.
 * @returns A message for the user, or null when the file may be uploaded.
 */
export function checkAttachment(file: { name: string; size: number }, policy: AttachmentPolicy, attached: number): string | null {
  if (attached >= MAX_ATTACHMENTS) return `You can attach up to ${MAX_ATTACHMENTS} files. Remove one to attach another.`
  if (file.size === 0) return `${file.name} is empty.`
  if (policy.maxBytes && file.size > policy.maxBytes) {
    return `${file.name} is ${formatBytes(file.size)}. The assistant reads files up to ${formatBytes(policy.maxBytes)}.`
  }
  return null
}
