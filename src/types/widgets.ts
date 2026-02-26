// QQQ Widget Data Types

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
