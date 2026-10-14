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

import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './client'
import {
  isCollaborationInstalled,
  listFavorites,
  listRecents,
  normalizeCollaborationList,
  recordRecent,
  reorderFavorites,
  starFavorite,
  unstarFavorite,
} from './collaboration'

/**
 * An Axios error carrying an HTTP status, as the API client rejects with.
 *
 * @param status - The HTTP status code.
 * @returns The error.
 */
function httpError(status: number): AxiosError {
  return new AxiosError('HTTP ' + status, String(status), undefined, undefined, { status } as AxiosResponse)
}

vi.mock('./client', () => ({
  default: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))
const get = vi.mocked(apiClient.get)
const target = { targetType: 'RECORD' as const, targetName: 'person', recordId: '1' }
const item = {
  ...target,
  id: 8,
  available: true,
  label: 'Alice Johnson',
  href: '/app/person/1',
  folder: 'Customers',
  sortOrder: 0,
}

beforeEach(() => vi.resetAllMocks())

describe('collaboration normalization', () => {
  it('normalizes nullable fields, drops malformed identities and preserves cursor and order', () => {
    expect(
      normalizeCollaborationList({
        items: [null, {}, { ...item, targetType: 'OTHER' }, { ...item, recordId: null }, item],
        nextCursor: 'opaque',
      })
    ).toEqual({ items: [item], nextCursor: 'opaque' })
    expect(normalizeCollaborationList('<html>')).toEqual({ items: [], nextCursor: null })
    expect(normalizeCollaborationList({ items: null })).toEqual({ items: [], nextCursor: null })
    expect(
      normalizeCollaborationList({ items: [{ targetType: 'TABLE', targetName: 'person' }] })
        .items[0]
    ).toEqual({
      targetType: 'TABLE',
      targetName: 'person',
      recordId: null,
      id: null,
      available: false,
      label: 'Unavailable',
      href: null,
      folder: null,
      sortOrder: null,
    })
  })

  it('redacts unavailable labels and rejects unsafe navigation', () => {
    const result = normalizeCollaborationList({
      items: [
        { ...item, available: false },
        { ...item, href: 'javascript:alert(1)' },
        { ...item, href: '//evil.test/app/person/1' },
      ],
    })
    expect(result.items[0]).toMatchObject({ label: 'Unavailable', href: null })
    expect(result.items.every((row) => row.href === null)).toBe(true)
  })

  it('loads all favorite pages and detects repeated cursors', async () => {
    get
      .mockResolvedValueOnce({ items: [item], nextCursor: 'two' })
      .mockResolvedValueOnce({ items: [{ ...item, id: 9 }], nextCursor: null })
    expect((await listFavorites()).items.map((row) => row.id)).toEqual([8, 9])
    expect(get).toHaveBeenLastCalledWith('/qbit/collaboration/favorites', {
      params: { limit: 100, cursor: 'two' },
    })
    get.mockResolvedValue({ items: [], nextCursor: 'repeat' })
    await expect(listFavorites()).rejects.toThrow('repeated continuation cursor')
  })

  it('drops unavailable recents and passes the requested limit', async () => {
    get.mockResolvedValue({ items: [item, { ...item, available: false }], nextCursor: null })
    expect((await listRecents(12)).items).toEqual([item])
    expect(get).toHaveBeenCalledWith('/qbit/collaboration/recents', { params: { limit: 12 } })
  })
})

describe('collaboration discovery', () => {
  it.each([true, false])(
    'uses version extensions without probing favorites (installed=%s)',
    async (installed) => {
      get.mockResolvedValue({
        apiVersion: '1.0.0',
        extensions: installed ? [{ name: 'collaboration' }] : [],
      })
      expect(await isCollaborationInstalled()).toBe(installed)
      expect(get).toHaveBeenCalledTimes(1)
    }
  )
  it('treats a version response with no extensions as authoritative', async () => {
    get.mockResolvedValue({ apiVersion: '1.0.0' })
    expect(await isCollaborationInstalled()).toBe(false)
    expect(get).toHaveBeenCalledTimes(1)
  })
  it.each([403, 404])(
    'probes older backends and treats favorites %s as unavailable',
    async (status) => {
      get
        .mockRejectedValueOnce(httpError(404))
        .mockRejectedValueOnce(httpError(status))
      expect(await isCollaborationInstalled()).toBe(false)
    }
  )
  it.each(['<html>not found</html>', null, []])(
    'handles a non-JSON or malformed probe body %s',
    async (body) => {
      get.mockResolvedValueOnce('<html>').mockResolvedValueOnce(body)
      expect(await isCollaborationInstalled()).toBe(false)
    }
  )
  it.each([{ items: [] }, { items: null }])(
    'accepts an empty nullable favorites list on an older backend (%s)',
    async ({ items }) => {
      get.mockRejectedValueOnce(httpError(404)).mockResolvedValueOnce({ items })
      expect(await isCollaborationInstalled()).toBe(true)
    }
  )
  it.each([401, 500])('does not hide version failures %s', async (status) => {
    get.mockRejectedValueOnce(httpError(status))
    await expect(isCollaborationInstalled()).rejects.toMatchObject({ response: { status } })
    expect(get).toHaveBeenCalledTimes(1)
  })
  it('propagates a failing fallback probe', async () => {
    get.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('network'))
    await expect(isCollaborationInstalled()).rejects.toThrow('network')
  })
})

it('sends the exact mutation bodies, including DELETE JSON and folder clearing', async () => {
  for (const method of [apiClient.put, apiClient.delete, apiClient.patch, apiClient.post])
    vi.mocked(method).mockResolvedValue({ success: true })
  await expect(starFavorite(target)).resolves.toEqual({ success: true })
  await unstarFavorite(target)
  await reorderFavorites({ ids: [8], folders: { '8': null } })
  await recordRecent(target)
  expect(apiClient.put).toHaveBeenCalledWith('/qbit/collaboration/favorites', target)
  expect(apiClient.delete).toHaveBeenCalledWith('/qbit/collaboration/favorites', { data: target })
  expect(apiClient.patch).toHaveBeenCalledWith('/qbit/collaboration/favorites/order', {
    ids: [8],
    folders: { '8': null },
  })
  expect(apiClient.post).toHaveBeenCalledWith('/qbit/collaboration/recents', target)
  vi.mocked(apiClient.put).mockResolvedValue('<html>')
  await expect(starFavorite(target)).rejects.toThrow('not acknowledged')
})
