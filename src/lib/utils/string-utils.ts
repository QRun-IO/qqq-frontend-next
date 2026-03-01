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
 * @file string-utils — lightweight string classification predicates used throughout the UI.
 */

/**
 * Returns true when the string is an absolute HTTP or HTTPS URL.
 *
 * Used by `FieldValue` and `BlockWidget` to decide whether to render a value as a link
 * with an external href, as opposed to a relative navigation link or plain text.
 *
 * @param s - The string to test.
 * @returns `true` if `s` begins with `http://` or `https://` (case-insensitive).
 */
export const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s)

/**
 * Returns true when the string is a root-relative path (starts with `/`).
 *
 * Used to distinguish internal Next.js navigation links from external URLs and plain text.
 *
 * @param s - The string to test.
 * @returns `true` if `s` starts with `/`.
 */
export const isRelativeUrl = (s: string): boolean => s.startsWith('/')

/**
 * Returns true when the string looks like an email address.
 *
 * Uses a simple heuristic regex (`local@domain.tld`) suitable for display-time formatting;
 * not intended as a strict RFC-5322 validator.
 *
 * @param s - The string to test.
 * @returns `true` if `s` matches the email heuristic pattern.
 */
export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
