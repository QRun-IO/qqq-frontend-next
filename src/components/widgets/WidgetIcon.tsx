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
 * Renders the icon named by QQQ metadata. The glyph is decorative; the Material
 * name is exposed on `data-icon-name` so styling and tests can target it.
 *
 * @param props - See {@link WidgetIconProps}.
 * @returns An `aria-hidden` span wrapping the glyph.
 */
export function WidgetIcon({ name, color, className, qqqId, style }: WidgetIconProps) {
  const Glyph = ICONS[name] ?? Circle
  return (
    <span
      aria-hidden="true"
      className={className}
      data-icon-name={name}
      data-qqq-id={qqqId}
      style={{ color, display: 'inline-flex', alignItems: 'center', ...style }}
    >
      <Glyph className="h-full w-full" style={{ width: '1em', height: '1em' }} />
    </span>
  )
}
