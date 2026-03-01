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
 * @file Data payload shapes returned by the `/widgets/{name}` API endpoint.
 */

// QQQ Widget Data Types

import type { CSSProperties } from 'react'

/**
 * Base shape for all widget data payloads.
 *
 * The `type` discriminant is used to select the correct renderer component.
 * Additional properties are defined by each concrete widget type below.
 */
export interface WidgetData {
  /** Widget renderer type identifier (e.g. 'chart', 'statistics', 'recordGrid'). */
  type: string
  /** Additional arbitrary properties defined by each concrete widget type. */
  [key: string]: unknown
}

/**
 * Data payload for chart-type widgets rendered with Recharts.
 *
 * Supports line, bar, pie, and area chart variants; the renderer selects
 * the appropriate Recharts component based on `chartType`.
 */
export interface ChartWidgetData extends WidgetData {
  /** Discriminant that identifies this as a chart widget payload. */
  type: 'chart'
  /** The Recharts chart variant to render. */
  chartType: 'line' | 'bar' | 'pie' | 'area'
  /** Ordered x-axis / category labels corresponding to each data index. */
  labels: string[]
  /** One or more data series to plot on the chart. */
  datasets: ChartDataset[]
  /** Optional heading shown above the chart. */
  title?: string
}

/**
 * A single data series within a `ChartWidgetData` payload.
 *
 * Each dataset maps to one series on a line/bar/area chart or one slice on a pie chart.
 */
export interface ChartDataset {
  /** Human-readable name for this series, shown in the chart legend. */
  label: string
  /** Ordered data values aligned with the `labels` array in the parent `ChartWidgetData`. */
  data: number[]
  /** Optional CSS color applied to this series' line, bar, or slice. */
  color?: string
}

/**
 * Data payload for statistics-type widgets that display a single headline KPI.
 *
 * Optionally includes a trend indicator (direction, percentage, label) rendered
 * as an up/down arrow badge next to the primary value.
 */
export interface StatisticsWidgetData extends WidgetData {
  /** Discriminant that identifies this as a statistics widget payload. */
  type: 'statistics'
  /** Heading text shown above the primary value. */
  title: string
  /** The headline metric value to display prominently. */
  value: string | number
  /** Optional unit label appended after `value` (e.g. '%', 'ms', 'records'). */
  unit?: string
  /** Optional trend context shown alongside the primary value. */
  trend?: {
    /** Visual direction of the trend arrow. */
    direction: 'up' | 'down' | 'flat'
    /** Numeric magnitude of the trend (e.g. 12 for 12%). */
    value: number
    /** Human-readable description of the trend period (e.g. 'vs last week'). */
    label: string
  }
}

/**
 * Data payload for HTML-type widgets that render raw markup.
 *
 * The `html` string MUST be sanitized with DOMPurify before being set via
 * `dangerouslySetInnerHTML` to prevent XSS attacks.
 */
export interface HtmlWidgetData extends WidgetData {
  /** Discriminant that identifies this as an HTML widget payload. */
  type: 'html'
  /** Raw HTML markup to render inside the widget body (must be sanitized before use). */
  html: string
}

/**
 * Data payload for record-grid widgets that display a tabular list of records.
 *
 * Either `columns` (simple field names) or `fields` (full field metadata) may be
 * provided; the renderer uses whichever is available for column configuration.
 */
export interface RecordGridWidgetData extends WidgetData {
  /** Discriminant that identifies this as a record grid widget payload. */
  type: 'recordGrid'
  /** Name of the source table these records belong to. */
  tableName: string
  /** Field names — used as column keys when full metadata is unavailable */
  columns?: string[]
  /** Full field metadata — used for proper labels and type-aware rendering */
  fields?: import('./metadata').QFieldMetaData[]
  /** Array of record value objects to display as rows in the grid. */
  records: Array<{
    /** Raw field values keyed by field name. */
    values: Record<string, unknown>
    /** Pre-formatted display strings keyed by field name. */
    displayValues?: Record<string, string>
  }>
  /** Total number of records available server-side (may exceed `records.length`). */
  totalCount?: number
}

/**
 * Discriminated union of all block element types that can appear inside a `BlockWidgetData`.
 *
 * Each block variant corresponds to a discrete UI component rendered sequentially
 * (or in a grid) within the block widget layout.
 *
 * Variants:
 * - `text` — plain or styled text paragraph
 * - `big_number` — large headline number with an optional label and icon
 * - `up_or_down` — a value compared to a baseline with directional styling
 * - `progress` — a progress bar with current value, max, and optional label
 * - `button` — a clickable action button
 * - `icon` — a standalone icon (Material Icon name)
 * - `image` — an inline image
 * - `audio` — an audio player element
 * - `divider` — a horizontal rule separating blocks
 * - `input` — an inline form input (text/number/etc.)
 * - `html` — raw HTML markup (must be sanitized before rendering)
 */
export type BlockData =
  | { type: 'text'; text: string; styles?: CSSProperties }
  | { type: 'big_number'; value: string | number; label?: string; icon?: string }
  | { type: 'up_or_down'; value: number; baseValue: number; label?: string }
  | { type: 'progress'; value: number; max: number; label?: string }
  | { type: 'button'; label: string; actionCode?: string; icon?: string }
  | { type: 'icon'; iconName: string; color?: string; size?: number }
  | { type: 'image'; src: string; alt: string; width?: number; height?: number }
  | { type: 'audio'; src: string; label?: string }
  | { type: 'divider' }
  | { type: 'input'; name: string; label: string; inputType?: string; defaultValue?: string }
  | { type: 'html'; html: string }

/**
 * Data payload for block-type widgets composed of ordered heterogeneous UI elements.
 *
 * Blocks are laid out vertically, horizontally, or in a grid according to `layout`.
 * Each entry in `blocks` is a `BlockData` variant rendered by the matching block component.
 */
export interface BlockWidgetData {
  /** Ordered list of block elements to render inside this widget. */
  blocks: BlockData[]
  /** Controls how blocks are arranged spatially within the widget container. */
  layout?: 'vertical' | 'horizontal' | 'grid'
}
