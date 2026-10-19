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

import { describe, expect, it } from 'vitest'

import type { AssistantConfig } from '@/types/assistant'
import { normalizeAttachmentSettings } from '@/lib/api/assistant-probe'
import { attachmentKind, attachmentPolicy, ATTACHMENTS_ACCEPT, BULK_LOAD_ACCEPT, checkAttachment, formatBytes, MAX_ATTACHMENTS } from './assistant-attachments'

const READS: AssistantConfig = { enabled: true, features: { attachments: true }, limits: { maxAttachmentBytes: 10 * 1024 * 1024, attachmentTypes: ['Text', 'PDF', 'Images'] } }

describe('attachmentPolicy', () => {
  it('accepts text, Markdown, PDF, images and data files when the server reads attachments', () => {
    const policy = attachmentPolicy(READS, false)
    expect(policy).toMatchObject({ enabled: true, reads: true, title: 'Attach a file', maxBytes: 10 * 1024 * 1024, types: ['Text', 'PDF', 'Images'] })
    for (const type of ['.txt', '.md', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.csv', '.tsv', '.xlsx', '.json']) {
      expect(policy.accept.split(',')).toContain(type)
    }
    expect(policy.accept).toBe(ATTACHMENTS_ACCEPT)
  })

  it('falls back to CSV or Excel bulk loads, gated on saved bulk load profiles, when the server does not say', () => {
    for (const config of [null, { enabled: true }, { enabled: true, features: { attachments: false } }] as AssistantConfig[]) {
      expect(attachmentPolicy(config, true)).toEqual({ enabled: true, reads: false, accept: BULK_LOAD_ACCEPT, title: 'Attach a file (CSV or Excel) for a bulk load' })
      expect(attachmentPolicy(config, false).enabled).toBe(false)
    }
  })
})

describe('checkAttachment', () => {
  const policy = attachmentPolicy(READS, false)

  it('rejects a file over the limit before uploading, with both sizes', () => {
    expect(checkAttachment({ name: 'scan.pdf', size: 12 * 1024 * 1024 }, policy, 0)).toBe('scan.pdf is 12 MB. The assistant reads files up to 10 MB.')
  })

  it('rejects empty files and a sixth file, and passes the rest', () => {
    expect(checkAttachment({ name: 'empty.txt', size: 0 }, policy, 0)).toBe('empty.txt is empty.')
    expect(checkAttachment({ name: 'notes.txt', size: 10 }, policy, MAX_ATTACHMENTS)).toMatch(/up to 5 files/)
    expect(checkAttachment({ name: 'notes.txt', size: 524_288 }, policy, 4)).toBeNull()
    expect(checkAttachment({ name: 'big.csv', size: 50 * 1024 * 1024 }, attachmentPolicy(null, true), 0)).toBeNull()
  })
})

describe('formatting', () => {
  it('formats sizes and picks a type icon from the content type or name', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(524_288)).toBe('512 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
    expect(attachmentKind('shot.png')).toBe('image')
    expect(attachmentKind('x', 'image/webp')).toBe('image')
    expect(attachmentKind('paper.pdf')).toBe('pdf')
    expect(attachmentKind('rows.xlsx')).toBe('spreadsheet')
    expect(attachmentKind('data.json')).toBe('json')
    expect(attachmentKind('readme.md')).toBe('text')
    expect(attachmentKind('archive.bin', 'application/octet-stream')).toBe('file')
  })
})

describe('normalizeAttachmentSettings', () => {
  it('keeps valid attachment fields and drops malformed ones', () => {
    expect(normalizeAttachmentSettings(READS)).toEqual(READS)
    const repaired = normalizeAttachmentSettings({
      enabled: true,
      features: { attachments: 'yes', writes: true },
      limits: { maxAttachmentBytes: -1, attachmentTypes: ['PDF', 3, ' '], maxTurnSeconds: 60 },
    } as unknown as AssistantConfig)
    expect(repaired.features).toEqual({ writes: true })
    expect(repaired.limits).toEqual({ attachmentTypes: ['PDF'], maxTurnSeconds: 60 })
    expect(attachmentPolicy(repaired, true).reads).toBe(false)
  })
})
