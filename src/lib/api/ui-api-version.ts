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
 * @file UI API version — the range of the QQQ UI API (`/qqq/v1`) this build supports, and the
 * check against the server's `GET /qqq/v1/version` (QRun-IO/qqq docs/UI-API-CHANGELOG.md).
 */

import { isAxiosError } from 'axios'

import apiClient from './client'

/**
 * The UI API versions this build works with: any server at or above `minimum` and below
 * `belowMajor`.0.0. `minimum` is the version of the vendored document
 * (`src/lib/api/openapi/qqq-v1.json`) minus the additions this build tolerates being absent.
 */
export const SUPPORTED_UI_API = {
  /** Lowest server version this build runs against. */
  minimum: '1.4.0',
  /** First major version this build does not support. */
  belowMajor: 2,
} as const

/** The version servers report before `GET /version` existed (QQQ 4.1.0-RC.5 and earlier). */
export const PRE_SEMVER_UI_API_VERSION = '1.0.0'

/** An extension (module or qbit) registered on the server. */
export interface UiApiExtension {
  /** Namespace, e.g. `alerts`. */
  name: string
  /** The extension's own semantic version. */
  version: string
  /** Path prefix under the API base path, e.g. `/qbit/backups`. */
  pathPrefix: string
  /** Short description. */
  description?: string
}

/** The server's `GET /version` response. */
export interface UiApiVersionInfo {
  /** Semantic version of the UI API the server implements. */
  apiVersion: string
  /** Optional core features the server supports. */
  features: string[]
  /** Registered extensions. */
  extensions: UiApiExtension[]
  /** True when the server predates the version endpoint. */
  preSemver: boolean
}

/** Outcome of the compatibility check. */
export interface UiApiCompatibility {
  /** Whether this build can run against the server. */
  compatible: boolean
  /** What the server reported. */
  info: UiApiVersionInfo
  /** A user-facing explanation when not compatible. */
  message?: string
}

/**
 * Parses `MAJOR.MINOR.PATCH` (ignoring a `v` prefix and any pre-release suffix).
 *
 * @param version - The version text.
 * @returns The three numbers, or null when the text is not a semantic version.
 */
export function parseSemver(version: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/**
 * Compares two semantic versions.
 *
 * @param a - First version.
 * @param b - Second version.
 * @returns Negative, zero or positive as a is lower, equal or higher.
 */
export function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * Decides whether this build supports a server's UI API version.
 *
 * @param info - The server's version info.
 * @returns The compatibility, with a message for the user when it fails.
 */
export function evaluateCompatibility(info: UiApiVersionInfo): UiApiCompatibility {
  const server = parseSemver(info.apiVersion)
  const minimum = parseSemver(SUPPORTED_UI_API.minimum) as [number, number, number]
  const range = `${SUPPORTED_UI_API.minimum} up to (not including) ${SUPPORTED_UI_API.belowMajor}.0.0`
  if (!server) {
    return { compatible: false, info, message: `The server reported an unrecognised UI API version (${info.apiVersion}). This app supports UI API ${range}.` }
  }
  if (server[0] >= SUPPORTED_UI_API.belowMajor) {
    return { compatible: false, info, message: `The server runs UI API ${info.apiVersion}, which is newer than this app supports (${range}). Update the app to a release that supports UI API ${server[0]}.x.` }
  }
  if (compareSemver(server, minimum) < 0) {
    return { compatible: false, info, message: `The server runs UI API ${info.apiVersion}, which is older than this app supports (${range}). Upgrade the server's QQQ version.` }
  }
  return { compatible: true, info }
}

/**
 * Reads the server's UI API version. A server without the endpoint (a 404, or a non-JSON answer such
 * as an SPA page) predates it and is treated as {@link PRE_SEMVER_UI_API_VERSION}.
 *
 * @returns The version info.
 */
export async function getUiApiVersion(): Promise<UiApiVersionInfo> {
  try {
    const body = await apiClient.get<Partial<UiApiVersionInfo> | string>('/version')
    // a server without the endpoint may answer with its SPA page or another non-JSON body
    if (typeof body !== 'object' || body === null || typeof body.apiVersion !== 'string') {
      return { apiVersion: PRE_SEMVER_UI_API_VERSION, features: [], extensions: [], preSemver: true }
    }
    return {
      apiVersion: body.apiVersion,
      features: Array.isArray(body?.features) ? body.features.filter((f): f is string => typeof f === 'string') : [],
      extensions: Array.isArray(body?.extensions) ? body.extensions : [],
      preSemver: false,
    }
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return { apiVersion: PRE_SEMVER_UI_API_VERSION, features: [], extensions: [], preSemver: true }
    }
    throw error
  }
}

/**
 * Checks the server's UI API version against this build's supported range. A failure to reach
 * the endpoint (other than a 404) is not treated as incompatible: the normal error handling of
 * the next request reports it.
 *
 * @returns The compatibility.
 */
export async function checkUiApiCompatibility(): Promise<UiApiCompatibility> {
  try {
    return evaluateCompatibility(await getUiApiVersion())
  } catch {
    return { compatible: true, info: { apiVersion: '', features: [], extensions: [], preSemver: false } }
  }
}
