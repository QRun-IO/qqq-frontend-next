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
 * @file Banner — renders the branding banner declared for one display slot.
 */

'use client'

import React from 'react'
import DOMPurify from 'dompurify'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

import type { Banner } from '@/types'
import { cn } from '@/lib/utils/cn'

/**
 * Banner slots QQQ applications declare (`MaterialDashboardBannerSlots`), with the
 * accessible name of the landmark each renders in. Unknown slots are not rendered,
 * as in Material Dashboard.
 */
export const BANNER_SLOTS = {
  QFMD_TOP_OF_SITE: 'Site banner',
  QFMD_TOP_OF_BODY: 'Page banner',
  QFMD_SIDE_NAV_UNDER_LOGO: 'Navigation banner',
} as const

/** A known banner slot name. */
export type BannerSlotName = keyof typeof BANNER_SLOTS

/** Default colors and icon per severity; `textColor`/`backgroundColor` override them. */
const severityConfig = {
  INFO: { bg: 'var(--qqq-banner-info-bg)', border: 'var(--qqq-banner-info-border)', text: 'var(--qqq-banner-info-text)', icon: Info },
  WARNING: { bg: 'var(--qqq-banner-warning-bg)', border: 'var(--qqq-banner-warning-border)', text: 'var(--qqq-banner-warning-text)', icon: AlertTriangle },
  ERROR: { bg: 'var(--qqq-banner-error-bg)', border: 'var(--qqq-banner-error-border)', text: 'var(--qqq-banner-error-text)', icon: AlertCircle },
  SUCCESS: { bg: 'var(--qqq-banner-success-bg, #f0fdf4)', border: 'var(--qqq-banner-success-border, #bbf7d0)', text: 'var(--qqq-banner-success-text, #166534)', icon: CheckCircle2 },
} as const

/** Props for {@link BannerComponent}. */
export interface BannerProps {
  /** Branding banners keyed by slot. */
  banners?: Record<string, Banner>
  /** Slot to render. */
  slot: BannerSlotName
  /** Extra classes for placement. */
  className?: string
}

/**
 * Renders the banner configured for `slot`, or nothing when the slot is empty.
 *
 * `messageHTML` (sanitized with DOMPurify) takes precedence over `messageText`.
 * Severity selects default colors and an icon; `textColor`, `backgroundColor` and
 * `additionalStyles` from metadata override them.
 *
 * @param props - Component properties.
 * @returns A labelled `region` landmark containing the banner, or `null`.
 */
export default function BannerComponent({ banners, slot, className }: BannerProps) {
  const banner = banners?.[slot]
  if (!banner || (!banner.messageHTML && !banner.messageText)) return null
  const html = banner.messageHTML ? DOMPurify.sanitize(banner.messageHTML) : ''

  const config = severityConfig[banner.severity ?? 'INFO'] ?? severityConfig.INFO
  const Icon = config.icon
  const style: React.CSSProperties = {
    background: banner.backgroundColor ?? config.bg,
    borderColor: config.border,
    color: banner.textColor ?? config.text,
    ...(banner.additionalStyles as React.CSSProperties | undefined),
  }

  return (
    <div
      role="region"
      aria-label={BANNER_SLOTS[slot]}
      className={cn('flex items-center justify-center gap-3 border px-4 py-2 text-sm font-medium', className)}
      style={style}
      data-qqq-id={`banner-${slot}`}
      data-severity={(banner.severity ?? 'INFO').toLowerCase()}
    >
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {html ? (
        <span className="text-center" data-qqq-id={`banner-${slot}-message`} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="text-center" data-qqq-id={`banner-${slot}-message`}>{banner.messageText}</span>
      )}
    </div>
  )
}
