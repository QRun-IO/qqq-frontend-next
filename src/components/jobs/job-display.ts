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

/** @file Small job display helpers shared by the tray and live view. */

/** Matches the server terminal states (NEEDS_REVIEW still requires intervention).
 * @param status - Server state.
 * @returns Whether execution has ended.
 */
export function isJobTerminal(status: string) {
  return ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(status)
}

/** Formats a duration without a clock wrapping at 24 hours.
 * @param seconds - Duration.
 * @returns Human-readable duration.
 */
export function jobDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  if (value < 60) return `${value}s`
  if (value < 3600) return `${Math.floor(value / 60)}m ${value % 60}s`
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`
}

/** Formats a byte measurement.
 * @param bytes - Byte count.
 * @returns Human-readable bytes.
 */
export function jobBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(4, Math.max(0, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024))))
  return `${(bytes / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`
}
