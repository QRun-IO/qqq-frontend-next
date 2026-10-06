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

/** @file Exact public branding aliases for the standalone Node server (QQQ #1009). */
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { BACKEND_PREFIXES } from './security-headers.mjs'

const reserved = new Set(['app', 'login', 'callback', '_next', ...BACKEND_PREFIXES].map((part) => part.toLowerCase()))
const imageSuffix = /\.(png|jpe?g|gif|webp|avif|ico|svg)$/i

/** Canonical decoded root-relative image path, rejecting traversal before normalization. */
export function brandingImagePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  const raw = value.split(/[?#]/, 1)[0]
  if (/%(2f|5c)/i.test(raw)) return null
  let decoded
  try { decoded = decodeURIComponent(raw) } catch { return null }
  if (/[\u0000-\u001f\u007f\ufffd\\%?#]/.test(decoded)) return null
  const parts = decoded.slice(1).split('/')
  if (parts.some((part) => !part || part === '.' || part === '..') || reserved.has(parts[0].toLowerCase())) return null
  return imageSuffix.test(decoded) ? decoded : null
}

/** Keep existing regular public files with Next; never inspect a path outside that root. */
async function hasPublicFile(directory, image) {
  try {
    const root = await realpath(directory)
    const file = await realpath(path.join(root, image.slice(1)))
    return file.startsWith(root + path.sep) && (await stat(file)).isFile()
  } catch { return false }
}

/**
 * Maps at most the two public metadata fields to fixed backend roles. An expired cache
 * refreshes before use; failed reads cannot keep stale asset authority. The caller bounds
 * the metadata fetch. No browser URL, cookie, or body is passed to that fetch.
 */
export function createBrandingAssetAlias(loadAuthentication, publicDirectory) {
  let aliases = new Map()
  let expires = 0
  let loading = null
  const refresh = () => {
    loading ??= Promise.resolve().then(loadAuthentication).then((authentication) => {
      const next = new Map()
      for (const role of ['logo', 'icon']) {
        const image = brandingImagePath(authentication?.branding?.[role])
        if (image && !next.has(image)) next.set(image, `/qqq/branding/${role}`)
      }
      aliases = next
      expires = Date.now() + 60_000
    }).catch(() => {
      aliases = new Map()
      expires = Date.now() + 5_000
    }).finally(() => { loading = null })
    return loading
  }
  return async (method, url) => {
    if (method !== 'GET' && method !== 'HEAD') return null
    const image = brandingImagePath(url)
    if (!image || await hasPublicFile(publicDirectory, image)) return null
    if (Date.now() >= expires) await refresh()
    return aliases.get(image) ?? null
  }
}
