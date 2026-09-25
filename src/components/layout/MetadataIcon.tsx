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
 * @file MetadataIcon — renders a QQQ `QIcon` (name, path, color) declared in backend metadata.
 */

import React from 'react'
import { FileBarChart, FolderOpen, LayoutGrid, Table2, Workflow, type LucideIcon } from 'lucide-react'

import type { QIcon } from '@/types'
import { cn } from '@/lib/utils/cn'
import { materialIconComponent, normalizeMaterialIconName } from '@/lib/utils/material-icons'

/** Kind of metadata object the icon belongs to; selects the fallback glyph. */
export type MetadataIconKind = 'app' | 'table' | 'process' | 'report' | 'section'

const FALLBACK: Record<MetadataIconKind, LucideIcon> = {
  app: LayoutGrid,
  table: Table2,
  process: Workflow,
  report: FileBarChart,
  section: FolderOpen,
}

/** Props for {@link MetadataIcon}. */
export interface MetadataIconProps {
  /** Structured icon from metadata (`icon: {name, path, color}`). */
  icon?: QIcon | null
  /** Legacy icon name (`iconName`), used when `icon` has no name or path. */
  iconName?: string | null
  /** Object kind, used for the fallback glyph when no icon is declared or the name is unknown. */
  kind?: MetadataIconKind
  /** Tailwind classes for size and color. */
  className?: string
}

/**
 * Renders the icon declared in QQQ metadata.
 *
 * - `icon.path` renders an `<img>` (as Material Dashboard does).
 * - `icon.name` renders the matching Lucide glyph; `icon.color` sets its color.
 * - No icon, or a name without a mapping, renders the fallback for `kind`.
 *
 * The element is decorative (`aria-hidden`); the adjacent label names the item.
 * `data-qqq-icon` carries the declared name (or `path`/`none`), and
 * `data-qqq-icon-fallback` marks a fallback glyph.
 *
 * @param props - Component properties.
 * @returns An `<img>` or `<svg>` element.
 */
export function MetadataIcon({ icon, iconName, kind = 'section', className }: MetadataIconProps) {
  const sizeClass = cn('h-4 w-4 flex-shrink-0', className)

  if (icon?.path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- metadata icon paths are arbitrary backend assets
      <img
        src={icon.path}
        alt=""
        aria-hidden="true"
        className={cn(sizeClass, 'object-contain')}
        data-qqq-icon="path"
      />
    )
  }

  const name = icon?.name || iconName || undefined
  const Icon = materialIconComponent(name)
  // createElement: the glyph is looked up from static maps, not created during render
  const props: React.SVGProps<SVGSVGElement> & Record<`data-${string}`, string | undefined> = {
    className: sizeClass,
    style: icon?.color ? { color: icon.color } : undefined,
    'aria-hidden': 'true',
    'data-qqq-icon': name ? normalizeMaterialIconName(name) : 'none',
    'data-qqq-icon-fallback': Icon ? undefined : 'true',
  }
  return React.createElement(Icon ?? FALLBACK[kind], props)
}

/** Props for {@link SectionIcon}. */
export interface SectionIconProps {
  /** A table or app section, as declared in metadata. */
  section: { icon?: QIcon; iconName?: string }
  /** Extra classes. */
  className?: string
}

/**
 * Renders a section's declared icon inline before its heading text (as Material
 * Dashboard does), or nothing when the section declares no icon.
 *
 * @param props - Component properties.
 * @returns The icon, or `null`.
 */
export function SectionIcon({ section, className }: SectionIconProps) {
  if (!section.icon?.name && !section.icon?.path && !section.iconName) return null
  return (
    <MetadataIcon
      icon={section.icon}
      iconName={section.iconName}
      kind="section"
      className={cn('mr-2 inline-block align-[-0.125em] text-muted-foreground', className)}
    />
  )
}
