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

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeQaCaptureCapability } from '@/lib/api/qa-capture'

const jamMocks = vi.hoisted(() => ({
  imports: { recordingLinks: 0, sdk: 0 },
  initialize: vi.fn(),
  isInitialized: vi.fn(() => false),
  open: vi.fn(),
  loadRecorder: vi.fn(),
  metadata: vi.fn(),
}))

vi.mock('@jam.dev/recording-links/sdk', () => {
  jamMocks.imports.recordingLinks++
  return {
    initialize: jamMocks.initialize,
    isInitialized: jamMocks.isInitialized,
    loadRecorder: jamMocks.loadRecorder,
  }
})

vi.mock('@jam.dev/sdk', () => {
  jamMocks.imports.sdk++
  return { jam: { metadata: jamMocks.metadata } }
})

import { blurSelectorsFor, initializeJam, isJamInitialized, openJamRecorder, resetJamLoaderForTesting, setJamMetadataProvider } from './jam-loader'

const ENABLED = normalizeQaCaptureCapability({
  enabled: true,
  reason: 'AUDIENCE',
  provider: 'jam',
  providerConfig: { teamId: 'team-1', recordingLinkId: 'link-1' },
  sanitizer: { redaction: '[redacted]', headerNames: ['authorization'], bodyFieldNames: ['ssn'], queryParamNames: [], valuePatterns: [], dropPathPrefixes: [] },
  blurSelectors: ['[data-qqq-secure]', 'input[type=password]', ' '],
})

const DISABLED = normalizeQaCaptureCapability({ enabled: false, reason: 'OFF' })

beforeEach(() => {
  jamMocks.loadRecorder.mockResolvedValue({ open: jamMocks.open })
})

afterEach(() => {
  resetJamLoaderForTesting()
  vi.clearAllMocks()
  document.head.querySelectorAll('meta[name^="jam:"]').forEach((meta) => meta.remove())
})

describe('Jam loader', () => {
  it('imports nothing, adds no meta and initializes nothing when capture is disabled', async () => {
    expect(initializeJam(DISABLED)).toBeNull()
    await Promise.resolve()
    expect(jamMocks.imports).toEqual({ recordingLinks: 0, sdk: 0 })
    expect(document.head.querySelector('meta[name="jam:team"]')).toBeNull()
    expect(isJamInitialized()).toBe(false)
    await expect(openJamRecorder(DISABLED, { 'jam-recording': 'r' })).rejects.toThrow('not enabled')
  })

  it('adds the team and blur meta and initializes Jam once with the sanitizers', async () => {
    const first = initializeJam(ENABLED)
    const second = initializeJam(ENABLED)
    expect(first).toBe(second)
    await first
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="jam:team"]')!.content).toBe('team-1')
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="jam:blur"]')!.content).toBe('[data-qqq-secure],input[type=password]')
    expect(jamMocks.initialize).toHaveBeenCalledTimes(1)
    const options = jamMocks.initialize.mock.calls[0][0]
    expect(options.teamId).toBe('team-1')
    expect(options.blurSelectors).toEqual(['[data-qqq-secure]', 'input[type=password]'])
    expect(typeof options.network.requestSanitizer).toBe('function')
    expect(typeof options.network.responseSanitizer).toBe('function')
    expect(typeof options.network.webSocketSanitizer).toBe('function')
    expect(typeof options.console.logSanitizer).toBe('function')
    expect(options.network.requestSanitizer({ type: 'fetch', url: '/a', method: 'GET', headers: { authorization: 'x' }, body: undefined }).headers).toEqual({})
    expect(isJamInitialized()).toBe(true)
  })

  it('registers jam.metadata, reading the latest provider at capture time', async () => {
    setJamMetadataProvider(() => ({ table: 'a' }))
    await initializeJam(ENABLED)
    const callback = jamMocks.metadata.mock.calls[0][0] as () => unknown
    expect(callback()).toEqual({ table: 'a' })
    setJamMetadataProvider(() => ({ table: 'b' }))
    expect(callback()).toEqual({ table: 'b' })
  })

  it('does not initialize the SDK twice if it already is', async () => {
    jamMocks.isInitialized.mockReturnValueOnce(true)
    await initializeJam(ENABLED)
    expect(jamMocks.initialize).not.toHaveBeenCalled()
  })

  it('opens the recorder for a Recording Link with its title and reference', async () => {
    await openJamRecorder(ENABLED, { 'jam-recording': 'link-1', 'jam-title': 'Bug: Person', 'jam-reference': 'qa-1' })
    expect(jamMocks.loadRecorder).toHaveBeenCalledWith({ openImmediately: false })
    expect(jamMocks.open).toHaveBeenCalledWith('link-1', { jamParams: { 'jam-title': 'Bug: Person', 'jam-reference': 'qa-1' } })
    await expect(openJamRecorder(ENABLED, {})).rejects.toThrow()
  })

  it('retries after a failed chunk load', async () => {
    jamMocks.initialize.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await expect(initializeJam(ENABLED)).rejects.toThrow('boom')
    expect(isJamInitialized()).toBe(false)
    await initializeJam(ENABLED)
    expect(jamMocks.initialize).toHaveBeenCalledTimes(2)
  })

  it('always blurs the QQQ secure marker', () => {
    expect(blurSelectorsFor({ ...ENABLED, blurSelectors: [] })).toEqual(['[data-qqq-secure]'])
  })
})

/**
 * Lists the app's source files (no tests).
 *
 * @param dir - Directory to walk.
 * @returns File paths.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sources(full)
    return /\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [full] : []
  })
}

describe('Jam chunk isolation', () => {
  it('reaches the Jam packages only through dynamic import() in jam-loader.ts', () => {
    const src = path.resolve(__dirname, '../..')
    const offenders: string[] = []
    const dynamic: string[] = []
    for (const file of sources(src)) {
      const text = readFileSync(file, 'utf-8')
      const relative = path.relative(src, file).split(path.sep).join('/')
      // import/export ... from '@jam.dev/...' (type-only imports are erased at build time)
      for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;'"]*?\bfrom\s+['"](@jam\.dev\/[^'"]+)['"]/g)) {
        if (!match[1]) offenders.push(`${relative}: ${match[2]}`)
      }
      for (const match of text.matchAll(/(?:^|\n)\s*import\s+['"](@jam\.dev\/[^'"]+)['"]/g)) offenders.push(`${relative}: ${match[1]}`)
      if (/(?<!typeof )import\(\s*['"]@jam\.dev\//.test(text)) dynamic.push(relative)
    }
    expect(offenders, 'static runtime imports of Jam would put it in every page chunk').toEqual([])
    expect([...new Set(dynamic)]).toEqual(['lib/qa-capture/jam-loader.ts'])
  })
})
