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
 * @file CompanyFooter — "© year, companyName" linking to companyUrl, at the end of every page
 * (Material Dashboard Footer, QRun-IO/qqq#719).
 */

import React from 'react'

import type { QBrandingMetaData } from '@/types'

/**
 * Whether a company URL may be linked: http(s) only (never `javascript:` or `data:`).
 *
 * @param url - The branding company URL.
 * @returns True for an http or https URL.
 */
export function isSafeCompanyUrl(url: string | undefined): url is string {
  if (!url?.trim()) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Renders the company footer when branding names the company and its web site, as the
 * Material Dashboard does (both are required there too).
 *
 * @param props - Component props.
 * @param props.branding - Branding metadata.
 * @param props.year - The year shown (defaults to the current year).
 * @returns The footer, or null.
 */
export default function CompanyFooter({ branding, year = new Date().getFullYear() }: { branding: QBrandingMetaData | undefined; year?: number }) {
  const name = branding?.companyName?.trim()
  const url = branding?.companyUrl?.trim()
  if (!name || !isSafeCompanyUrl(url)) return null
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-center gap-1 pb-2 text-sm text-muted-foreground" data-qqq-id="footer-company">
      <span>&copy; {year},</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-qqq-id="link-company"
      >
        {name}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </footer>
  )
}
