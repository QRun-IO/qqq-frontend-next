'use client'

// StatisticsWidget — KPI tile widget showing a numeric metric with trend indicator

import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

// The wire-format for a "statistics" widget from the backend.
// The existing StatisticsWidgetData in @/types models a single stat;
// the mock data returns one per widget. We support both a single tile
// and a multi-tile array shape.
export interface StatTile {
  label: string
  value: string | number
  description?: string
  iconName?: string
  color?: string
  unit?: string
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    label?: string
  }
}

export interface StatisticsWidgetPayload {
  type: 'statistics'
  // Array shape: { statistics: [...] }
  statistics?: StatTile[]
  // Single-tile shape (legacy): { title, value, unit, trend }
  title?: string
  value?: string | number
  unit?: string
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    label: string
  }
}

interface StatisticsWidgetProps {
  data: StatisticsWidgetPayload
  /** Widget name for data-qqq-id attributes */
  widgetName: string
}

export function StatisticsWidget({ data, widgetName }: StatisticsWidgetProps) {
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

// ------------------------------------------------------------------
// Individual tile card
// ------------------------------------------------------------------
interface StatTileCardProps {
  tile: StatTile
  widgetName: string
  index: number
}

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

// ------------------------------------------------------------------
// Trend badge
// ------------------------------------------------------------------
function TrendBadge({
  direction,
  value,
  label,
}: {
  direction: 'up' | 'down' | 'flat'
  value: number
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
