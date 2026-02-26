// QQQ Widget Data Types

import type { CSSProperties } from 'react'

export interface WidgetData {
  type: string
  [key: string]: unknown
}

export interface ChartWidgetData extends WidgetData {
  type: 'chart'
  chartType: 'line' | 'bar' | 'pie' | 'area'
  labels: string[]
  datasets: ChartDataset[]
  title?: string
}

export interface ChartDataset {
  label: string
  data: number[]
  color?: string
}

export interface StatisticsWidgetData extends WidgetData {
  type: 'statistics'
  title: string
  value: string | number
  unit?: string
  trend?: {
    direction: 'up' | 'down' | 'flat'
    value: number
    label: string
  }
}

export interface HtmlWidgetData extends WidgetData {
  type: 'html'
  html: string
}

export interface RecordGridWidgetData extends WidgetData {
  type: 'recordGrid'
  tableName: string
  columns: string[]
  records: Array<{
    values: Record<string, unknown>
    displayValues: Record<string, string>
  }>
  totalCount?: number
}

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

export interface BlockWidgetData {
  blocks: BlockData[]
  layout?: 'vertical' | 'horizontal' | 'grid'
}
