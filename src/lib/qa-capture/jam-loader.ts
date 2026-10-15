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
 * @file The only module that loads Jam, and only through dynamic `import()`, so a user without
 * QA capture never downloads the Jam chunks (a test enforces this). It adds the `jam:team` and
 * `jam:blur` meta tags, initializes `@jam.dev/recording-links` once with the sanitizers, and
 * registers `jam.metadata` from `@jam.dev/sdk`.
 *
 * Network behavior verified in the SDK source (recording-links 0.4.0, sdk 1.0.1): `initialize`
 * fetches nothing by itself. It loads `https://js.jam.dev/recorder.js` only when the URL carries
 * `jam-recording` (checked on load and on every pushState/replaceState/popstate) or when
 * `loadRecorder` is called, and `https://js.jam.dev/capture.js` only when a recorder is active in
 * some tab (a `jam:numRecorders` localStorage counter). `jam.metadata` only stores a callback on
 * `window.__jam__`.
 */

import type { QaCaptureCapabilityV1 } from '@/types/qa-capture'
import { buildJamSanitizers } from './sanitizers'

/** The JSON object returned to `jam.metadata`. */
export type JamMetadataProvider = () => Record<string, unknown>

type RecordingLinksSdk = typeof import('@jam.dev/recording-links/sdk')

let sdkPromise: Promise<RecordingLinksSdk> | null = null
let metadataProvider: JamMetadataProvider = () => ({})

/**
 * Adds (or updates) a `<meta name=... content=...>` in the document head.
 *
 * @param name - Meta name.
 * @param content - Meta content.
 */
function upsertMeta(name: string, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = content
}

/**
 * The blur selectors: the server's plus the UI's own secure-value marker.
 *
 * @param capability - The enabled capability.
 * @returns The selectors.
 */
export function blurSelectorsFor(capability: QaCaptureCapabilityV1): string[] {
  return [...new Set(['[data-qqq-secure]', ...capability.blurSelectors.filter((selector) => selector.trim())])]
}

/**
 * Whether Jam has been (or is being) initialized on this page.
 *
 * @returns True after {@link initializeJam} was called with an enabled capability.
 */
export function isJamInitialized(): boolean {
  return sdkPromise !== null
}

/**
 * Sets the function `jam.metadata` calls at capture time.
 *
 * @param provider - Returns the metadata object.
 */
export function setJamMetadataProvider(provider: JamMetadataProvider): void {
  metadataProvider = provider
}

/**
 * Initializes Jam once for an enabled capability. Does nothing (and imports nothing) when the
 * capability is disabled.
 *
 * @param capability - The current capability.
 * @returns The SDK, or null when capture is disabled.
 */
export function initializeJam(capability: QaCaptureCapabilityV1): Promise<RecordingLinksSdk> | null {
  if (!capability.enabled || !capability.providerConfig || !capability.sanitizer) return null
  if (sdkPromise) return sdkPromise
  const { teamId } = capability.providerConfig
  const blurSelectors = blurSelectorsFor(capability)
  const sanitizers = buildJamSanitizers(capability.sanitizer, window.location.origin)
  upsertMeta('jam:team', teamId)
  upsertMeta('jam:blur', blurSelectors.join(','))
  const pending = (async () => {
    const [jam, sdk] = await Promise.all([import('@jam.dev/recording-links/sdk'), import('@jam.dev/sdk')])
    // read at capture time, so the latest provider and page context are used
    sdk.jam.metadata((() => metadataProvider()) as Parameters<typeof sdk.jam.metadata>[0])
    if (!jam.isInitialized()) jam.initialize({ teamId, blurSelectors, ...sanitizers })
    return jam
  })()
  sdkPromise = pending
  pending.catch(() => {
    // a failed chunk load can be retried on the next attempt
    if (sdkPromise === pending) sdkPromise = null
  })
  return pending
}

/**
 * Opens the Jam recorder for a Recording Link, with its `jam-*` parameters (title, reference).
 *
 * @param capability - The enabled capability.
 * @param recordingParams - `jam-recording` plus the other `jam-*` parameters from the report.
 * @returns Resolves once the recorder is open.
 * @throws When capture is disabled or the recorder script cannot load.
 */
export async function openJamRecorder(capability: QaCaptureCapabilityV1, recordingParams: Record<string, string>): Promise<void> {
  const recordingId = recordingParams['jam-recording']
  const pending = initializeJam(capability)
  if (!pending || !recordingId) throw new Error('QA capture is not enabled.')
  const jam = await pending
  const recorder = await jam.loadRecorder({ openImmediately: false })
  const jamParams = Object.fromEntries(Object.entries(recordingParams).filter(([key]) => key !== 'jam-recording'))
  recorder.open(recordingId, { jamParams })
}

/** Forgets the SDK (tests only; the real SDK cannot be initialized twice). */
export function resetJamLoaderForTesting(): void {
  sdkPromise = null
  metadataProvider = () => ({})
}
