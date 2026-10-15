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

/** @file Optional secured-data extension calls. */
import apiClient from './client'

export interface RevealOptions {
  reasons: string[]
  allowFreeText: boolean
  requireFreeText: boolean
  durationMinutes: number
  remainingToday: number | null
}
export interface RevealTarget {
  tableName: string
  primaryKey: string | number
  fieldName: string
}
export interface RevealResult {
  value: unknown
  displayValue: string | null
  expiresAt: string
  revealId: string | number
}
export interface BreakGlassSession {
  id: string | number
  reason: string
  expiresAt: string
  tableName?: string | null
  scope?: string | null
  ceiling: string
}
export interface SecuredDataStatus {
  breakGlass: BreakGlassSession | null
}

/**
 * Load policy options; normalize the qbit's published names and the design's original names.
 * @param tableName - Table owning the field.
 * @param fieldName - Field to reveal.
 * @returns Normalized policy and allowance.
 */
export async function getRevealOptions(
  tableName: string,
  fieldName: string
): Promise<RevealOptions> {
  const data = await apiClient.get<
    Partial<RevealOptions> & {
      reasonOptions?: string[]
      allowFreeTextReason?: boolean
      revealMinutes?: number
      remainingDailyAllowance?: number | null
    }
  >('/qbit/secured-data/reveal/options', { params: { tableName, fieldName } })
  return {
    reasons: data.reasonOptions ?? data.reasons ?? [],
    allowFreeText: data.allowFreeTextReason ?? data.allowFreeText ?? false,
    requireFreeText: data.requireFreeText ?? false,
    durationMinutes: data.revealMinutes ?? data.durationMinutes ?? 5,
    remainingToday: data.remainingDailyAllowance ?? data.remainingToday ?? null,
  }
}

/**
 * Request a single audited, time limited reveal.
 * @param request - Record field and audit reason.
 * @returns Authorized value and expiry.
 */
export function revealField(
  request: RevealTarget & { reason: string; reasonText: string }
): Promise<RevealResult> {
  const { tableName, primaryKey, fieldName, reason, reasonText } = request
  return apiClient.post<RevealResult>('/qbit/secured-data/reveal', {
    tableName,
    primaryKey,
    fieldName,
    reason,
    reasonText,
  })
}

/**
 * Read the current session's emergency access status.
 * @returns Current break-glass status.
 */
export function getSecuredDataStatus(): Promise<SecuredDataStatus> {
  return apiClient.get<SecuredDataStatus>('/qbit/secured-data/status')
}
