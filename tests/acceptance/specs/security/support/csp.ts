/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Reading the dashboard's security headers (QRun-IO/qqq#695) in acceptance specs.
import { createHash } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import type { Diagnostics } from '../../../support/fixtures'

/** The directives every dashboard document's policy has, in the order the server sends them. */
export const POLICY_DIRECTIVES = [
  'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'worker-src',
  'manifest-src', 'media-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors',
]

/**
 * Parses a Content-Security-Policy header value.
 *
 * @param header - The header value.
 * @returns Directive name to its source list, in header order.
 */
export function parsePolicy(header: string | undefined): Record<string, string[]> {
  const policy: Record<string, string[]> = {}
  for (const part of (header ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (name) policy[name] = sources
  }
  return policy
}

/**
 * The CSP hash sources of the inline scripts in an HTML document, computed here,
 * independently of the server.
 *
 * @param html - The document as served.
 * @returns Distinct `'sha256-...'` sources.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>()
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/(^|\s)src\s*=/i.test(attributes)) continue
    hashes.add(`'sha256-${createHash('sha256').update(body.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`)
  }
  return [...hashes]
}

/**
 * Origins of the script bundles that customComponent widgets declare (componentSourceUrl),
 * which the dashboard policy must allow.
 *
 * @param api - A backend request context with a session.
 * @returns Distinct origins.
 */
export async function customComponentOrigins(api: APIRequestContext): Promise<string[]> {
  const metaData = await (await api.get('/qqq/v1/metaData')).json() as { widgets?: Record<string, { type?: string; defaultValues?: Record<string, unknown> }> }
  const origins = new Set<string>()
  for (const widget of Object.values(metaData.widgets ?? {})) {
    const url = widget.defaultValues?.componentSourceUrl
    if (widget.type === 'customComponent' && typeof url === 'string' && /^https?:\/\//.test(url)) origins.add(new URL(url).origin)
  }
  return [...origins]
}

/**
 * Whitelists the diagnostics each engine reports for a request the policy blocked on purpose:
 * the `securitypolicyviolation` event and the console / failed-request lines naming the URL.
 *
 * @param diagnostics - The test's diagnostics.
 * @param url - The blocked URL.
 */
export function allowBlockedByPolicy(diagnostics: Diagnostics, url: string) {
  diagnostics.allow(url)
  diagnostics.allow(url.replace(/\/$/, ''))
}
