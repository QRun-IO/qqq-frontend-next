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
        tiles.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
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
  const { label, value, description, unit, trend, color } = tile

  const accentStyle = color ? { borderLeftColor: color } : undefined

  return (
    <div
      className="flex flex-col gap-1 rounded-lg border-l-4 border-l-blue-500 bg-gray-50 p-4 dark:bg-gray-800"
      style={accentStyle}
      data-qqq-id={`stat-tile-${widgetName}-${index}`}
    >
      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-bold text-gray-900 dark:text-gray-100"
          data-qqq-id={`stat-value-${widgetName}-${index}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{unit}</span>
        )}
      </div>

      {/* Label */}
      <span
        className="text-xs font-medium text-gray-600 dark:text-gray-400"
        data-qqq-id={`stat-label-${widgetName}-${index}`}
      >
        {label}
      </span>

      {/* Description */}
      {description && (
        <span className="text-xs text-gray-500 dark:text-gray-500">{description}</span>
      )}

      {/* Trend */}
      {trend && (
        <TrendBadge direction={trend.direction} value={trend.value} label={trend.label} />
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
      classes: 'text-emerald-600 dark:text-emerald-400',
      label: `+${value}%`,
    },
    down: {
      icon: TrendingDown,
      classes: 'text-red-600 dark:text-red-400',
      label: `-${value}%`,
    },
    flat: {
      icon: Minus,
      classes: 'text-gray-500 dark:text-gray-400',
      label: `${value}%`,
    },
  }[direction]

  const Icon = config.icon

  return (
    <div className="flex items-center gap-1 pt-0.5">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', config.classes)} aria-hidden="true" />
      <span className={cn('text-xs font-medium', config.classes)}>{config.label}</span>
      {label && <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>}
    </div>
  )
}
