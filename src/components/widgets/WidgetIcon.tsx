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
 * @file WidgetIcon — renders a QQQ (Material Icons) icon name inside widgets.
 */
'use client'

import React from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, BarChart3, BadgeAlert, BellPlus, Blocks, Braces, Calendar, Check,
  Circle, Clock, FileText, Info, Lock, MapPin, Package, Settings, Star, Trophy, User, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { materialIconComponent } from '@/lib/utils/material-icons'
import { cn } from '@/lib/utils/cn'

/** Material icon names used by QQQ widgets, mapped to the closest Lucide glyph. */
const ICONS: Record<string, LucideIcon> = {
  add_alert: BellPlus,
  arrow_drop_down: ArrowDown,
  arrow_drop_up: ArrowUp,
  arrow_downward: ArrowDown,
  arrow_upward: ArrowUp,
  assessment: BarChart3,
  blocks: Blocks,
  calendar_month: Calendar,
  check: Check,
  data_object: Braces,
  description: FileText,
  error: AlertTriangle,
  group: Users,
  info: Info,
  inventory: Package,
  location_on: MapPin,
  lock: Lock,
  new_releases: BadgeAlert,
  pending: Clock,
  person: User,
  schedule: Clock,
  settings: Settings,
  sports: Trophy,
  star: Star,
  warning: AlertTriangle,
}

/** Props accepted by {@link WidgetIcon}. */
interface WidgetIconProps {
  /** Material Icons name from backend metadata or payload (e.g. `"sports"`). */
  name: string
  /** CSS color from metadata; applied to the glyph. */
  color?: string
  /** Tailwind size/spacing classes. */
  className?: string
  /** `data-qqq-id` for the icon element. */
  qqqId?: string
  /** Optional inline style overrides (e.g. a font size from block styles). */
  style?: React.CSSProperties
}

/**
 * The glyph for a Material Icons name: the widget map first, then the shared metadata
 * icon map (any name QQQ metadata uses), else a neutral circle.
 *
 * @param name - Material Icons name.
 * @returns The Lucide glyph.
 */
export function widgetGlyph(name: string): LucideIcon {
  return ICONS[name] ?? materialIconComponent(name) ?? Circle
}

/**
 * Renders the icon named by QQQ metadata. The glyph is decorative; the Material
 * name is exposed on `data-icon-name` so styling and tests can target it.
 *
 * @param props - See {@link WidgetIconProps}.
 * @returns An `aria-hidden` span wrapping the glyph.
 */
export function WidgetIcon({ name, color, className, qqqId, style }: WidgetIconProps) {
  const Glyph = widgetGlyph(name)
  return (
    <span
      aria-hidden="true"
      className={className}
      data-icon-name={name}
      data-qqq-id={qqqId}
      style={{ color, display: 'inline-flex', alignItems: 'center', ...style }}
    >
      {React.createElement(Glyph, { className: 'h-full w-full', style: { width: '1em', height: '1em' } })}
    </span>
  )
}

/** Props accepted by {@link WidgetIconTile}. */
interface WidgetIconTileProps {
  /** Material Icons name (ignored when `path` is set). */
  name?: string
  /** Image path drawn instead of a named icon. */
  path?: string
  /** Tile color from metadata; the theme's info (else primary) color when absent. */
  color?: string
  /** Tile size classes (default a 1.75 rem header tile). */
  className?: string
  /** `data-qqq-id` for the tile. */
  qqqId?: string
}

/**
 * A white glyph (or a 16 px image) on a rounded tile in the icon's color, as Material
 * Dashboard draws widget header icons and the main widget icon. An image that fails to
 * load is hidden, leaving the colored tile.
 *
 * @param props - See {@link WidgetIconTileProps}.
 * @returns An `aria-hidden` tile.
 */
export function WidgetIconTile({ name, path, color, className, qqqId }: WidgetIconTileProps) {
  const background = color || 'var(--qqq-info-color, var(--color-primary))'
  if (path) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-flex flex-shrink-0 items-center justify-center rounded', className ?? 'h-7 w-7')}
        style={{ backgroundColor: background }}
        data-qqq-id={qqqId}
        data-icon-path={path}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- metadata icon paths are arbitrary backend assets */}
        <img src={path} alt="" width={16} height={16} onError={(event) => { event.currentTarget.style.display = 'none' }} />
      </span>
    )
  }
  const Glyph = widgetGlyph(name ?? '')
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex flex-shrink-0 items-center justify-center rounded text-white', className ?? 'h-7 w-7 text-base')}
      style={{ backgroundColor: background, color: '#ffffff' }}
      data-qqq-id={qqqId}
      data-icon-name={name}
    >
      {React.createElement(Glyph, { style: { width: '1em', height: '1em' } })}
    </span>
  )
}
