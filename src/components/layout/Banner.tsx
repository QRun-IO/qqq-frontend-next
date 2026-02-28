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

'use client'

/** Banner — displays top-of-site environment/status banners driven by branding metadata. */

import React, { useState } from 'react'
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'

import type { Banner } from '@/types'

/**
 * Props for the BannerComponent.
 */
export interface BannerProps {
  /** Map of banner keys to Banner metadata objects from the branding config. */
  banners: Record<string, Banner>
  /** Optional callback invoked with the banner key when a banner is dismissed. */
  onDismiss?: (bannerKey: string) => void
}

/**
 * Maps each banner severity level to its CSS custom-property tokens, icon component,
 * and accessible ARIA label string.
 */
const severityConfig = {
  info: {
    bg: 'var(--qqq-banner-info-bg)',
    border: 'var(--qqq-banner-info-border)',
    text: 'var(--qqq-banner-info-text)',
    icon: Info,
    ariaLabel: 'Information banner',
  },
  warning: {
    bg: 'var(--qqq-banner-warning-bg)',
    border: 'var(--qqq-banner-warning-border)',
    text: 'var(--qqq-banner-warning-text)',
    icon: AlertTriangle,
    ariaLabel: 'Warning banner',
  },
  error: {
    bg: 'var(--qqq-banner-error-bg)',
    border: 'var(--qqq-banner-error-border)',
    text: 'var(--qqq-banner-error-text)',
    icon: AlertCircle,
    ariaLabel: 'Error banner',
  },
} as const

/**
 * Renders one or more dismissible banners at the top of the page.
 *
 * Banners are keyed by an arbitrary string (e.g. `QFMD_TOP_OF_SITE`).
 * Severity determines icon and color tokens used; the `color` field on an
 * individual banner overrides the default background. Dismissed banners are
 * tracked in local state and optionally reported via `onDismiss`.
 *
 * @param banners - Map of banner key → Banner metadata from branding config.
 * @param onDismiss - Optional callback invoked with the dismissed banner key.
 * @returns A region of banner elements, or `null` when none are visible.
 */
export default function BannerComponent({ banners, onDismiss }: BannerProps) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())

  const bannerKeys = Object.keys(banners)

  if (bannerKeys.length === 0) return null

  const visibleBanners = bannerKeys.filter((key) => !dismissedKeys.has(key))

  if (visibleBanners.length === 0) return null

  /**
   * Marks a banner as dismissed in local state and propagates the event upward.
   *
   * @param key - The banner key to dismiss.
   */
  const handleDismiss = (key: string) => {
    setDismissedKeys((prev) => new Set([...prev, key]))
    onDismiss?.(key)
  }

  // Primary banner is QFMD_TOP_OF_SITE; render all visible banners
  return (
    <div role="region" aria-label="Site banners" data-qqq-id="banner-region">
      {visibleBanners.map((key) => {
        const banner = banners[key]
        const config = severityConfig[banner.severity] ?? severityConfig.info
        const Icon = config.icon

        return (
          <div
            key={key}
            role="alert"
            aria-live="polite"
            aria-label={config.ariaLabel}
            className="flex items-center justify-center gap-3 border-b px-6 py-2 text-sm font-medium"
            style={{
              background: banner.color ?? config.bg,
              borderColor: config.border,
              color: config.text,
              minHeight: 'var(--qqq-banner-height)',
            }}
            data-qqq-id={`banner-${key}`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-center">{banner.text}</span>
            {banner.dismissible && (
              <button
                onClick={() => handleDismiss(key)}
                className="flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
                aria-label={`Dismiss ${config.ariaLabel}`}
                data-qqq-id={`button-dismiss-banner-${key}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
