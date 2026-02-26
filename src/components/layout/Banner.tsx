'use client'

// Banner component — displays top-of-site environment/status banners

import React, { useState } from 'react'
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'

import type { Banner } from '@/types'

export interface BannerProps {
  banners: Record<string, Banner>
  onDismiss?: (bannerKey: string) => void
}

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

export default function BannerComponent({ banners, onDismiss }: BannerProps) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())

  const bannerKeys = Object.keys(banners)

  if (bannerKeys.length === 0) return null

  const visibleBanners = bannerKeys.filter((key) => !dismissedKeys.has(key))

  if (visibleBanners.length === 0) return null

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
