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
 * @file BrandedHeaderBar — the theme's branded bar across the top of the window, above the
 * navigation and the page (Material Dashboard BrandedHeaderBar, QRun-IO/qqq#719).
 */

'use client'

import React from 'react'

import type { QThemeMetaData } from '@/types'

/**
 * Renders the branded header bar when the theme enables it: its background and text colors,
 * logo (with alt text), height and tagline come from the theme through the Material
 * `--qqq-branded-header-*` variables, so application customCss can restyle it too.
 *
 * It is a plain region rather than a second banner landmark (the page header is the banner).
 *
 * @param props - Component props.
 * @param props.theme - The application theme, or null.
 * @returns The bar, or null when the theme does not enable it.
 */
export default function BrandedHeaderBar({ theme }: { theme: QThemeMetaData | null }) {
  const [logoFailed, setLogoFailed] = React.useState(false)
  if (!theme?.brandedHeaderEnabled) return null
  return (
    <div
      className="qqq-branded-header-bar flex shrink-0 items-center justify-between px-4"
      data-branded-header="true"
      data-qqq-id="branded-header-bar"
      style={{
        backgroundColor: 'var(--qqq-branded-header-background-color, #1a2035)',
        color: 'var(--qqq-branded-header-text-color, #ffffff)',
        height: 'var(--qqq-branded-header-height, 48px)',
      }}
    >
      <div className="flex min-w-0 items-center gap-4">
        {theme.brandedHeaderLogoPath && !logoFailed && (
          <img
            src={theme.brandedHeaderLogoPath}
            alt={theme.brandedHeaderLogoAltText || 'Logo'}
            className="object-contain"
            style={{ height: 'calc(var(--qqq-branded-header-height, 48px) - 8px)', maxWidth: '200px' }}
            onError={() => setLogoFailed(true)}
            data-qqq-id="branded-header-logo"
          />
        )}
        {theme.brandedHeaderTagline && (
          <span className="truncate font-medium" style={{ color: 'var(--qqq-branded-header-text-color, #ffffff)' }} data-qqq-id="branded-header-tagline">
            {theme.brandedHeaderTagline}
          </span>
        )}
      </div>
    </div>
  )
}
