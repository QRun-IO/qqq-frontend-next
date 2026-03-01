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
 * @file Barrel export — re-exports all public components, types, and payload interfaces from the widgets module.
 */

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
