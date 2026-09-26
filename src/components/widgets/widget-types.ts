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
 * @file Shared contracts for canonical QQQ widget renderers.
 *
 * The payload interfaces mirror the JSON that the QQQ backend serializes for each
 * `QWidgetData` subclass (see `qqq-backend-core` `model/dashboard/widgets`). Every
 * field is optional because a renderer may omit empty collections; renderers must
 * validate shapes at runtime and show a contained message for anything malformed.
 */

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'

/** Record context for widgets embedded in a record view section. */
export interface WidgetRecordContext {
  /** Name of the table whose record view hosts the widget. */
  tableName: string
  /** Primary key of the hosting record, as a string. */
  recordId?: string
  /** The hosting record, when the page already has it. */
  record?: QRecord
  /** Metadata for the hosting table, when the page already has it. */
  tableMetaData?: QTableMetaData
}

/** A block link as serialized by `BlockLink`. */
export interface QqqBlockLink {
  href?: string
  target?: string
}

/** A block tooltip as serialized by `BlockTooltip`. */
export interface QqqBlockTooltip {
  title?: string
  placement?: string
  /** A composite rendered inside the tooltip instead of plain text. */
  blockData?: QqqCompositeData
}

/** One composite block as serialized by `AbstractBlockWidgetData`. */
export interface QqqBlockData {
  blockId?: string
  blockTypeName?: string
  tooltip?: QqqBlockTooltip
  link?: QqqBlockLink
  /** Per-slot tooltips keyed by upper-case slot name (e.g. `NUMBER`). */
  tooltipMap?: Record<string, QqqBlockTooltip>
  /** Per-slot links keyed by upper-case slot name (e.g. `NUMBER`). */
  linkMap?: Record<string, QqqBlockLink>
  values?: Record<string, unknown>
  styles?: Record<string, unknown>
  conditional?: string
}

/** A composite (itself a block) as serialized by `CompositeWidgetData`. */
export interface QqqCompositeData extends QqqBlockData {
  blocks?: Array<QqqBlockData | QqqCompositeData>
  /** One of FLEX_COLUMN, FLEX_ROW, FLEX_ROW_WRAPPED, FLEX_ROW_SPACE_BETWEEN, FLEX_ROW_CENTER, TABLE_SUB_ROW_DETAILS, BADGES_WRAPPER. */
  layout?: string
  styleOverrides?: Record<string, unknown>
  overlayHtml?: string
  overlayStyleOverrides?: Record<string, unknown>
  modalMode?: string
}

/**
 * Callback for interactive blocks (BUTTON, INPUT_FIELD). Receives the block and the
 * event values (e.g. `{ actionCode }` or `{ fieldName: value }`); a process step
 * hosting the widget uses it to submit the step.
 */
export type BlockActionCallback = (block: QqqBlockData | null, eventValues?: Record<string, unknown>) => boolean | void

/** One dataset in a canonical `ChartData.Data`. */
export interface QqqChartDataset {
  label?: string
  data?: Array<number | null>
  /** Per-point colors (bar/pie). */
  backgroundColors?: string[]
  /** Per-point navigation targets. */
  urls?: Array<string | null>
  /** Series color. */
  color?: string
}

/** Canonical `ChartData` / `LineChartData` / `PieChartData` payload. */
export interface QqqChartPayload {
  type?: string
  title?: string
  /** HTML description shown under the chart. */
  description?: string
  chartData?: {
    labels?: string[]
    datasets?: QqqChartDataset[]
    urls?: Array<string | null>
  }
  isCurrency?: boolean
  isYAxisCurrency?: boolean
  height?: number
  chartSubheaderData?: {
    mainNumber?: number
    vsPreviousPercent?: number
    vsPreviousNumber?: number
    isUpVsPrevious?: boolean
    isGoodVsPrevious?: boolean
    vsDescription?: string
    mainNumberUrl?: string
    previousNumberUrl?: string
  }
}

/** Props accepted by every canonical widget renderer. */
export interface WidgetComponentProps<T> {
  /** Metadata for the widget being rendered. */
  widgetMetaData: QWidgetMetaData
  /** The widget's payload from `POST /qqq/v1/widget/{name}`. */
  data: T
  /** Record context when rendered inside a record view section. */
  recordContext?: WidgetRecordContext
  /** Interactive block callback (process steps). */
  actionCallback?: BlockActionCallback
  /** Re-fetch the widget's data. */
  onReload?: () => void
}

/**
 * Narrows unknown to a plain object.
 *
 * @param value - Any value.
 * @returns True for a non-null, non-array object.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Returns `value` as a list: `[]` when absent (the backend omits empty lists),
 * the list itself when it is one, and `undefined` when it has any other shape.
 * Renderers show {@link WidgetPayloadNotice} for `undefined` instead of throwing,
 * so a malformed payload never crashes the dashboard or logs a console error.
 *
 * @param value - A payload field expected to be a list.
 * @returns The list, `[]` when absent, or `undefined` when malformed.
 */
export function asList<T = unknown>(value: unknown): T[] | undefined {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? (value as T[]) : undefined
}

/**
 * Message for a payload whose shape does not match its widget type.
 *
 * @param widgetType - Human-readable widget type.
 * @param field - The offending field.
 * @returns The message.
 */
export function payloadProblem(widgetType: string, field: string): string {
  return `The ${widgetType} widget data is not in the expected format (${field}).`
}
