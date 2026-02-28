/**
 * StatisticsWidget — KPI tile grid widget.
 *
 * Displays one or more numeric metric tiles, each with a label, value, optional
 * unit, and an optional trend indicator (up/down/flat with a percentage badge).
 * Supports both a multi-tile array shape and a legacy single-tile shape from
 * the backend wire format.
 */
'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

/**
 * Data model for a single KPI tile within a statistics widget.
 *
 * Supports both the multi-tile array shape (`statistics: [StatTile]`) and
 * the legacy single-tile shape where the tile fields live at the top level
 * of the payload.
 */
export interface StatTile {
  /** Descriptive label rendered above the numeric value. */
  label: string
  /** The primary metric value; can be a formatted string or a raw number. */
  value: string | number
  /** Optional secondary description shown when no trend indicator is present. */
  description?: string
  /** Optional Lucide icon name (reserved for future icon rendering). */
  iconName?: string
  /** Optional accent color applied to the tile (reserved for future styling). */
  color?: string
  /** Optional unit suffix displayed next to the value (e.g., '%', 'ms'). */
  unit?: string
  /** Optional trend indicator showing direction and percentage change. */
  trend?: {
    /** Visual direction of the trend arrow. */
    direction: 'up' | 'down' | 'flat'
    /** Magnitude of the change expressed as a percentage. */
    value: number
    /** Optional context label appended after the percentage (e.g., 'vs last week'). */
    label?: string
  }
}

/** Wire-format payload for a statistics widget returned by the backend API. */
export interface StatisticsWidgetPayload {
  /** Discriminator field identifying this as a statistics widget payload. */
  type: 'statistics'
  /** Multi-tile array shape; takes precedence over the legacy single-tile fields. */
  statistics?: StatTile[]
  /** Legacy single-tile: metric label. */
  title?: string
  /** Legacy single-tile: metric value. */
  value?: string | number
  /** Legacy single-tile: metric unit suffix. */
  unit?: string
  /** Legacy single-tile: trend indicator. */
  trend?: {
    /** Visual direction of the trend arrow. */
    direction: 'up' | 'down' | 'flat'
    /** Magnitude of the change expressed as a percentage. */
    value: number
    /** Context label appended after the percentage. */
    label: string
  }
  /**
   * When true, renders a compact single-line layout suitable for dense dashboards.
   *
   * The mini variant shows a small icon placeholder, the value, and the label inline
   * using reduced font sizes, and omits trend indicators and secondary metrics.
   * Can also be set per-tile via `values.mini` in widget metadata.
   */
  mini?: boolean
}

/** Props accepted by the StatisticsWidget component. */
interface StatisticsWidgetProps {
  /** Typed payload from the widget API response. */
  data: StatisticsWidgetPayload
  /** Widget name for data-qqq-id attributes */
  widgetName: string
}

/**
 * Renders a responsive grid of KPI stat tiles.
 *
 * Normalizes both the multi-tile array shape and the legacy single-tile payload
 * shape into a uniform array of StatTile objects, then renders each tile via
 * StatTileCard. Column count adjusts automatically based on tile count
 * (1→1 col, 2→2 cols, 3→3 cols, 4+→4 cols on large screens).
 *
 * When `data.mini === true`, renders each tile via `StatTileMini` instead —
 * a single-line compact layout suitable for dense dashboards or sidebar panels.
 *
 * @param data - Statistics widget payload from the backend API.
 * @param widgetName - Widget name scoped to data-qqq-id attributes.
 */
export function StatisticsWidget({ data, widgetName }: StatisticsWidgetProps) {
  const isMini = data.mini === true

  // Normalize to array of tiles
  const tiles: StatTile[] = data.statistics
    ? data.statistics
    : [
        {
          label: data.title ?? '',
          value: data.value ?? '—',
          unit: data.unit,
          trend: data.trend,
        },
      ]

  if (isMini) {
    return (
      <div
        className="flex flex-col gap-1"
        data-qqq-id={`statistics-mini-${widgetName}`}
      >
        {tiles.map((tile, idx) => (
          <StatTileMini
            key={`${widgetName}-mini-${idx}`}
            tile={tile}
            widgetName={widgetName}
            index={idx}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid gap-4',
        tiles.length === 1
          ? 'grid-cols-1'
          : tiles.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : tiles.length === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      )}
      data-qqq-id={`statistics-grid-${widgetName}`}
    >
      {tiles.map((tile, idx) => (
        <StatTileCard
          key={`${widgetName}-tile-${idx}`}
          tile={tile}
          widgetName={widgetName}
          index={idx}
        />
      ))}
    </div>
  )
}

/** Props accepted by the internal StatTileCard helper component. */
interface StatTileCardProps {
  /** The stat tile data to render. */
  tile: StatTile
  /** Parent widget name used for data-qqq-id scoping. */
  widgetName: string
  /** Zero-based index of this tile within the grid. */
  index: number
}

/**
 * Renders a single KPI metric tile card.
 *
 * Displays a label, a large numeric value with optional unit suffix, and either
 * a TrendBadge (when trend data is present) or a plain description string.
 *
 * @param tile - The stat tile data to display.
 * @param widgetName - Parent widget name for data-qqq-id scoping.
 * @param index - Position of the tile within the grid (used in data-qqq-id).
 */
function StatTileCard({ tile, widgetName, index }: StatTileCardProps) {
  const { label, value, description, unit, trend } = tile

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-6 shadow-sm"
      data-qqq-id={`stat-tile-${widgetName}-${index}`}
    >
      {/* Title row */}
      <span
        className="text-sm font-medium text-muted-foreground"
        data-qqq-id={`stat-label-${widgetName}-${index}`}
      >
        {label}
      </span>

      {/* Big value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-3xl font-bold text-foreground"
          data-qqq-id={`stat-value-${widgetName}-${index}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>

      {/* Trend / description */}
      {trend && (
        <TrendBadge direction={trend.direction} value={trend.value} label={trend.label} />
      )}
      {description && !trend && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  )
}

/** Props accepted by the internal StatTileMini helper component. */
interface StatTileMiniProps {
  /** The stat tile data to render in compact form. */
  tile: StatTile
  /** Parent widget name used for data-qqq-id scoping. */
  widgetName: string
  /** Zero-based index of this tile within the list. */
  index: number
}

/**
 * Renders a single KPI metric tile in the compact mini variant.
 *
 * Displays value and label on a single line using reduced font sizes.
 * An optional unit suffix is shown immediately after the value. Trend indicators
 * and secondary descriptions are omitted to keep the layout minimal.
 *
 * @param tile - The stat tile data to display.
 * @param widgetName - Parent widget name for data-qqq-id scoping.
 * @param index - Position of the tile within the list (used in data-qqq-id).
 */
function StatTileMini({ tile, widgetName, index }: StatTileMiniProps) {
  const { label, value, unit } = tile

  return (
    <div
      className="flex items-center gap-2 px-2 py-1"
      data-qqq-id={`stat-mini-${widgetName}-${index}`}
    >
      <span
        className="text-sm font-semibold text-foreground tabular-nums"
        data-qqq-id={`stat-mini-value-${widgetName}-${index}`}
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
        )}
      </span>
      <span
        className="text-xs text-muted-foreground truncate"
        data-qqq-id={`stat-mini-label-${widgetName}-${index}`}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * Renders a compact trend indicator badge with a directional icon and percentage value.
 *
 * Colors and icons are determined by `direction`: up → emerald/TrendingUp,
 * down → destructive/TrendingDown, flat → muted/Minus. An optional context
 * label is appended after the percentage in muted text.
 *
 * @param direction - Visual direction of the trend ('up', 'down', or 'flat').
 * @param value - Percentage magnitude of the change.
 * @param label - Optional context label shown after the percentage (e.g., 'vs last week').
 */
function TrendBadge({
  direction,
  value,
  label,
}: {
  /** Visual direction of the trend arrow. */
  direction: 'up' | 'down' | 'flat'
  /** Percentage magnitude of the change. */
  value: number
  /** Optional context label appended after the percentage. */
  label?: string
}) {
  const config = {
    up: {
      icon: TrendingUp,
      classes: 'text-emerald-600',
      label: `+${value}%`,
    },
    down: {
      icon: TrendingDown,
      classes: 'text-destructive',
      label: `-${value}%`,
    },
    flat: {
      icon: Minus,
      classes: 'text-muted-foreground',
      label: `${value}%`,
    },
  }[direction]

  const Icon = config.icon

  return (
    <div className="flex items-center gap-1">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.classes)} aria-hidden="true" />
      <span className={cn('text-sm font-medium', config.classes)}>{config.label}</span>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  )
}
