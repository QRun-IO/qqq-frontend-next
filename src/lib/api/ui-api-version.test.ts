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

// Tests for the UI API version check

import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import {
  checkUiApiCompatibility,
  compareSemver,
  evaluateCompatibility,
  getUiApiVersion,
  parseSemver,
  PRE_SEMVER_UI_API_VERSION,
} from './ui-api-version'

/**
 * Version info for a server version.
 *
 * @param apiVersion - The version.
 * @returns The info.
 */
function info(apiVersion: string) {
  return { apiVersion, features: [], extensions: [], preSemver: false }
}

describe('parseSemver / compareSemver', () => {
  it('parses MAJOR.MINOR.PATCH with an optional v and suffix', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3])
    expect(parseSemver('v2.0.1-rc.1')).toEqual([2, 0, 1])
    expect(parseSemver('v1')).toBeNull()
  })

  it('orders versions', () => {
    expect(compareSemver([1, 10, 0], [1, 9, 9])).toBeGreaterThan(0)
    expect(compareSemver([1, 0, 0], [1, 0, 0])).toBe(0)
    expect(compareSemver([0, 9, 0], [1, 0, 0])).toBeLessThan(0)
  })
})

describe('evaluateCompatibility', () => {
  it('accepts any 1.x at or above the minimum', () => {
    expect(evaluateCompatibility(info('1.3.0')).compatible).toBe(true)
    expect(evaluateCompatibility(info('1.2.9')).compatible).toBe(false)
    expect(evaluateCompatibility(info('1.7.2')).compatible).toBe(true)
  })

  it('rejects a newer major with a message to update the app', () => {
    const result = evaluateCompatibility(info('2.0.0'))
    expect(result.compatible).toBe(false)
    expect(result.message).toMatch(/newer than this app supports/)
  })

  it('rejects an older server with a message to upgrade it', () => {
    const result = evaluateCompatibility(info('0.9.0'))
    expect(result.compatible).toBe(false)
    expect(result.message).toMatch(/older than this app supports/)
  })

  it('rejects an unrecognised version', () => {
    expect(evaluateCompatibility(info('v1')).message).toMatch(/unrecognised/)
  })
})

describe('getUiApiVersion', () => {
  it('reads GET /qqq/v1/version', async () => {
    server.use(http.get('*/qqq/v1/version', () => HttpResponse.json({ apiVersion: '1.1.0', features: ['version', 7], extensions: [{ name: 'esb', version: '1.0.0', pathPrefix: '/esb' }] })))
    const result = await getUiApiVersion()
    expect(result).toEqual({ apiVersion: '1.1.0', features: ['version'], extensions: [{ name: 'esb', version: '1.0.0', pathPrefix: '/esb' }], preSemver: false })
  })

  it('treats a server without the endpoint as the pre-semver 1.0.0', async () => {
    server.use(http.get('*/qqq/v1/version', () => new HttpResponse(null, { status: 404 })))
    const result = await getUiApiVersion()
    expect(result.apiVersion).toBe(PRE_SEMVER_UI_API_VERSION)
    expect(result.preSemver).toBe(true)
  })

  it('treats a body without apiVersion (e.g. an SPA page) as the pre-semver 1.0.0', async () => {
    server.use(http.get('*/qqq/v1/version', () => HttpResponse.json({})))
    expect(await getUiApiVersion()).toEqual({ apiVersion: PRE_SEMVER_UI_API_VERSION, features: [], extensions: [], preSemver: true })
    server.use(http.get('*/qqq/v1/version', () => HttpResponse.text('<!doctype html><html></html>')))
    expect((await getUiApiVersion()).preSemver).toBe(true)
    expect((await checkUiApiCompatibility()).compatible).toBe(false)
  })
})

describe('checkUiApiCompatibility', () => {
  it('reports an incompatible server', async () => {
    server.use(http.get('*/qqq/v1/version', () => HttpResponse.json({ apiVersion: '2.0.0' })))
    expect((await checkUiApiCompatibility()).compatible).toBe(false)
  })

  it('does not block on an unreachable endpoint', async () => {
    server.use(http.get('*/qqq/v1/version', () => new HttpResponse(null, { status: 500 })))
    expect((await checkUiApiCompatibility()).compatible).toBe(true)
  })
})
