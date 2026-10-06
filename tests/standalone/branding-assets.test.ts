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

/** @file Path authority, public-file precedence and bounded branding cache contracts. */
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { brandingImagePath, createBrandingAssetAlias } from '../../standalone/branding-assets.mjs'

const invalid = ['logo.png', 'https://images.example/a.png', '//images.example/a.png', 'data:image/png;base64,a', '/', '/brand/../a.png', '/brand/%2e%2e/a.png', '/brand/%252e%252e/a.png', '/brand/a%2fb.png', '/brand/a%5cb.png', '/brand//a.png', '/brand/./a.png', '/brand/a%00.png', '/brand/a%ZZ.png', '/brand/a%FF.png', '/brand/index.html', '/brand/private.js', '/app/a.png', '/login/a.png', '/callback/a.png', '/_next/a.png', '/qqq/a.png', '/data/a.png', '/metaData/a.png']
const roots: string[] = []
function directory() { const root = mkdtempSync(path.join(tmpdir(), 'branding-assets-')); roots.push(root); return root }
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it.each(invalid)('rejects unsafe or unrelated declaration %s before routing', (value) => expect(brandingImagePath(value)).toBeNull())
it('canonicalizes only once and excludes query/fragment from lookup', () => {
  expect(brandingImagePath('/brand/logo.png?v=1#icon')).toBe('/brand/logo.png')
  expect(brandingImagePath('/brand/a%20b.png')).toBe('/brand/a b.png')
  expect(brandingImagePath('/brand/%C3%A9.png')).toBe('/brand/é.png')
  expect(brandingImagePath('/brand/a+b.PNG')).toBe('/brand/a+b.PNG')
  expect(brandingImagePath(null)).toBeNull()
})
it('uses at most two declared roles with GET/HEAD and leaves other methods/routes alone', async () => {
  const load = vi.fn(async () => ({ branding: { logo: '/brand/logo.png?v=1', icon: '/brand/icon.svg' } }))
  const alias = createBrandingAssetAlias(load, directory())
  expect(await alias('POST', '/brand/logo.png')).toBeNull()
  for (const value of invalid) expect(await alias('GET', value)).toBeNull()
  expect(load).not.toHaveBeenCalled()
  expect(await alias('GET', '/brand/logo.png?cache=2')).toBe('/qqq/branding/logo')
  expect(await alias('HEAD', '/brand/icon.svg')).toBe('/qqq/branding/icon')
  expect(await alias('GET', '/brand/unlisted.png')).toBeNull()
  expect(load).toHaveBeenCalledTimes(1)
})
it('keeps a real public file with Next, while outside-root symlinks do not grant local-file authority', async () => {
  const root = directory(); const outside = directory()
  mkdirSync(path.join(root, 'brand'))
  writeFileSync(path.join(root, 'brand/logo.png'), 'local public file')
  writeFileSync(path.join(outside, 'icon.svg'), 'outside bytes')
  symlinkSync(path.join(outside, 'icon.svg'), path.join(root, 'brand/icon.svg'))
  const load = vi.fn(async () => ({ branding: { logo: '/brand/logo.png', icon: '/brand/icon.svg' } }))
  const alias = createBrandingAssetAlias(load, root)
  expect(await alias('GET', '/brand/logo.png')).toBeNull()
  expect(load).not.toHaveBeenCalled()
  expect(await alias('GET', '/brand/icon.svg')).toBe('/qqq/branding/icon')
})
it('refreshes expired declarations before use and removes old aliases on failed refresh', async () => {
  let now = 100; vi.spyOn(Date, 'now').mockImplementation(() => now)
  const load = vi.fn().mockResolvedValueOnce({ branding: { logo: '/first.png' } }).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ branding: { logo: '/second.png' } })
  const alias = createBrandingAssetAlias(load, directory())
  expect(await alias('GET', '/first.png')).toBe('/qqq/branding/logo')
  now += 60_000
  expect(await alias('GET', '/first.png')).toBeNull()
  expect(await alias('GET', '/second.png')).toBeNull()
  expect(load).toHaveBeenCalledTimes(2)
  now += 5_000
  expect(await alias('GET', '/second.png')).toBe('/qqq/branding/logo')
  expect(await alias('GET', '/first.png')).toBeNull()
})
it('coalesces concurrent initial loads and consistently prefers logo for identical paths', async () => {
  let finish!: (value: unknown) => void
  const load = vi.fn(() => new Promise((resolve) => { finish = resolve }))
  const alias = createBrandingAssetAlias(load, directory())
  const first = alias('GET', '/same.png'); const second = alias('HEAD', '/same.png')
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
  finish({ branding: { logo: '/same.png', icon: '/same.png' } })
  expect(await first).toBe('/qqq/branding/logo'); expect(await second).toBe('/qqq/branding/logo')
})
it('missing and external-only branding adds no aliases', async () => {
  for (const value of [undefined, {}, { branding: null }, { branding: { logo: 'https://images.example/logo.png', icon: 'data:image/png;base64,a' } }]) {
    const alias = createBrandingAssetAlias(async () => value, directory())
    expect(await alias('GET', '/logo.png')).toBeNull()
  }
})
