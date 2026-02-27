/** Barrel export — re-exports all public components, types, and payload interfaces from the widgets module. */

export { WidgetBlock } from './WidgetBlock'
export { WidgetGrid } from './WidgetGrid'
export type { WidgetGridItem, WidgetSpan } from './WidgetGrid'
export { WidgetErrorBoundary } from './WidgetErrorBoundary'
export { WidgetRenderer } from './WidgetRenderer'
export { ConnectedWidget } from './ConnectedWidget'
export { AppHome } from './AppHome'

export { StatisticsWidget } from './StatisticsWidget'
export type { StatisticsWidgetPayload, StatTile } from './StatisticsWidget'

export { BarChartWidget } from './BarChartWidget'
export type { BarChartWidgetPayload } from './BarChartWidget'

export { LineChartWidget } from './LineChartWidget'
export type { LineChartWidgetPayload } from './LineChartWidget'

export { PieChartWidget } from './PieChartWidget'
export type { PieChartWidgetPayload } from './PieChartWidget'

export { RecordGridWidget } from './RecordGridWidget'
export type { RecordGridWidgetPayload } from './RecordGridWidget'

export { BlockWidget } from './BlockWidget'
export type { BlockWidgetPayload } from './BlockWidget'

export { DividerWidget } from './DividerWidget'
export type { DividerWidgetPayload } from './DividerWidget'

export { QuickLinksWidget } from './QuickLinksWidget'
export type { QuickLinksWidgetPayload, QuickLink } from './QuickLinksWidget'

export { AlertWidget } from './AlertWidget'
export type { AlertWidgetPayload, AlertSeverity } from './AlertWidget'

export { ProcessSummaryWidget } from './ProcessSummaryWidget'
export type { ProcessSummaryWidgetPayload, ProcessRun, ProcessRunStatus } from './ProcessSummaryWidget'

export { CompositeWidget } from './CompositeWidget'
export type { CompositeWidgetProps } from './CompositeWidget'
