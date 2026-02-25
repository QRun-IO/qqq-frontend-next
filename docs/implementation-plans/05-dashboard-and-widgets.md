# Work Package 5: Dashboard and Widgets

## 1. Prerequisites

### 1.1 Exact Imports from Package 1

```typescript
// From @/lib/types
import type { QAppMetaData, QTableSection, QTableMetaData } from '@/lib/types'
import type { QRecord, QFieldMetaData, QFieldValue } from '@/lib/types'

// From @/lib/api
import { apiClient } from '@/lib/api/client'

// From @/lib/context
import { useQContext } from '@/lib/context/q-context'
import type { QContextValue } from '@/lib/context/q-context'

// From @/lib/auth
import { useAuth } from '@/lib/auth/use-auth'

// From @/components/layout
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { LayoutHeader } from '@/components/layout/layout-header'

// From @/hooks/use-theme
import { useTheme } from '@/hooks/use-theme'
```

### 1.2 Exact Imports from Package 2 (DataGrid)

```typescript
// From @/components/data-grid
import { DataGrid } from '@/components/data-grid/data-grid'
import type { DataGridProps, Column, ColumnConfig } from '@/components/data-grid/types'
import { CellRenderer } from '@/components/data-grid/cell-renderer'
import type { CellRendererProps } from '@/components/data-grid/cell-renderer'
import { usePagination } from '@/components/data-grid/hooks/use-pagination'
import { useColumnConfig } from '@/components/data-grid/hooks/use-column-config'
import { FilterBuilder } from '@/components/data-grid/filter-builder'
import type { FilterExpression } from '@/components/data-grid/filter-builder'
```

### 1.3 Exact Imports from Package 3 (Forms)

```typescript
// From @/components/form
import { EntityForm } from '@/components/form/entity-form'
import type { EntityFormProps } from '@/components/form/entity-form'
import { DynamicFormField } from '@/components/form/dynamic-form-field'
import type { DynamicFormFieldProps } from '@/components/form/dynamic-form-field'
import { FieldDisplay } from '@/components/form/field-display'
import type { FieldDisplayProps } from '@/components/form/field-display'
```

### 1.4 External Dependencies

- **recharts**: ^2.12.0
- **tailwindcss**: ^4.0.0
- **shadcn/ui**: Latest stable
- **react-hook-form**: ^7.50.0
- **zod**: ^3.22.0

---

## 2. Requirements Traceability

### 2.1 Source Requirements

| Requirement | Source | Status |
|------------|--------|--------|
| App Home page replaces placeholder | 5.2.2 (App Home) | To Implement |
| Widget container with label, reload, export, dropdowns | 5.3.6 (Widget Components) | To Implement |
| Responsive grid layout (gridColumns metadata) | 5.3.6 (Widget Components) | To Implement |
| DashboardWidgets orchestrator component | 5.3.6 (Widget Components) | To Implement |
| Chart widgets (Line, Bar, Horizontal Bar, Stacked, Pie) | 5.3.6 (Widget Components) | To Implement |
| Statistics widgets (Mini, Multi, base) | 5.3.6 (Widget Components) | To Implement |
| Block types (Text, BigNumber, UpOrDown, etc.) | 5.3.6 (Widget Components) | To Implement |
| Record Grid widget with embedded CRUD | 5.3.6 (Widget Components) | To Implement |
| Specialized widgets (Composite, Parent, DynamicForm, etc.) | 5.3.6 (Widget Components) | To Implement |
| Widget data fetching with request deduplication | 5.3.6 (Widget Components) | To Implement |
| GET /qqq/v1/widget/{widgetName} API client | 3.6 (Widget Endpoint) | To Implement |
| Query param support for widget requests | 3.6 (Widget Endpoint) | To Implement |
| Auto-refresh capability | 5.3.6 (Widget Components) | To Implement |

### 2.2 Non-Functional Requirements

- TypeScript strict mode compliance
- Responsive design (mobile, tablet, desktop)
- Accessibility (WCAG 2.1 AA)
- Performance: Widget request cancellation to prevent memory leaks
- Error handling and graceful degradation
- Metadata-driven configuration (100% from QQQ backend)

---

## 3. Shared Context Files Required

### 3.1 Files Delivered by Package 1

```
src/lib/types/index.ts
src/lib/types/auth.ts
src/lib/context/q-context.tsx
src/lib/api/client.ts
src/components/layout/dashboard-layout.tsx
src/hooks/use-theme.ts
```

### 3.2 Files Delivered by Package 2

```
src/components/data-grid/data-grid.tsx
src/components/data-grid/types.ts
src/components/data-grid/cell-renderer.tsx
src/components/data-grid/hooks/use-pagination.ts
src/components/data-grid/hooks/use-column-config.ts
src/components/data-grid/filter-builder.tsx
```

### 3.3 Files Delivered by Package 3

```
src/components/form/entity-form.tsx
src/components/form/dynamic-form-field.tsx
src/components/form/field-display.tsx
```

---

## 4. Scope: In and Out

### 4.1 In Scope

**Components:**
- App Home page (page.tsx) at `/src/app/(dashboard)/app/[appName]/page.tsx`
- WidgetContainer: label, reload, export, dropdown, help content
- WidgetGrid: responsive grid layout
- DashboardWidgets orchestrator
- Chart widgets (5 types) using Recharts
- Statistics widgets (3 types)
- Block types (11 types)
- Record Grid widget with CRUD
- Specialized widgets (10 types)
- Widget hooks (useWidgetData, useWidgetDropdowns, etc.)

**API:**
- GET /qqq/v1/widget/{widgetName} client function
- Request deduplication service
- Query param serialization

**Testing:**
- Unit tests for widgets
- Integration tests for widget data flow
- Mock widget API responses

### 4.2 Out of Scope

- Record Query (Package 2)
- Record CRUD operations (Package 3)
- Process Execution (Package 4)
- Storybook component documentation (Package 6)
- Accessibility audit (Package 6)
- E2E tests (Package 6)
- Custom app-specific component implementation
- USMapWidget geographic library integration

---

## 5. Detailed Implementation Steps

### Step 1: Define Widget Type System and Interfaces

**Location:** `src/lib/types/widget.ts`

Create foundational widget type definitions:
- QWidgetMetaData shape
- Widget container metadata
- Grid layout metadata
- Dropdown configuration
- Block type enums and shapes
- Chart data contract
- Statistics data contract
- API request/response types

### Step 2: Create Widget API Client

**Location:** `src/lib/api/widget-client.ts`

Implement:
- `fetchWidgetData()` function with AbortController
- Request deduplication service (singleton)
- Query param builder
- Error handling and retry logic

### Step 3: Build Core Widget Hooks

**Location:** `src/hooks/`

Implement hooks:
- `useWidgetData()`: Fetch and manage widget data with cancellation
- `useWidgetDropdowns()`: Load dropdown possible values
- `useWidgetRefresh()`: Auto-refresh and manual refresh
- `useWidgetExport()`: Export widget data to CSV/JSON

### Step 4: Implement WidgetContainer Component

**Location:** `src/components/widgets/widget-container.tsx`

Render:
- Widget label and icon
- Reload button (trigger refresh)
- Export button (dropdown: CSV, JSON)
- Dropdown selectors (with onChange data re-fetch)
- Help icon with popover
- Child widget content
- Error and loading states

### Step 5: Implement WidgetGrid Component

**Location:** `src/components/widgets/widget-grid.tsx`

Features:
- Responsive Tailwind grid layout
- gridColumns metadata support
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: N columns (per metadata)
- Gap and padding from theme

### Step 6: Implement Block Components

**Location:** `src/components/widgets/blocks/`

Create 11 block renderers:
1. TextBlock: Markdown/formatted text
2. BigNumberBlock: Large number display
3. UpOrDownNumberBlock: Number with delta arrow
4. NumberIconBadgeBlock: Number + icon
5. ProgressBarBlock: Progress bar + label
6. ButtonBlock: Clickable button
7. IconBlock: Icon from icon library
8. ImageBlock: Image with alt text
9. AudioBlock: HTML audio player
10. DividerBlock: Horizontal line
11. InputFieldBlock: Form input
12. TableSubRowDetailRowBlock: Detail row

### Step 7: Implement Chart Widgets

**Location:** `src/components/widgets/charts/`

Create 5 Recharts-based components:
1. DefaultLineChart
2. BarChart
3. HorizontalBarChart
4. StackedBarChart
5. PieChart

Plus `ChartSubheaderWithData` composite.

### Step 8: Implement Statistics Widgets

**Location:** `src/components/widgets/statistics/`

Create 3 components:
1. MiniStatisticsCard
2. MultiStatisticsCard
3. StatisticsCard

### Step 9: Implement Record Grid Widget

**Location:** `src/components/widgets/record-grid-widget.tsx`

Features:
- Embed DataGrid from Package 2
- Add row button
- Edit inline capability
- Delete row action
- Confirm delete dialog
- Sync data to parent widget

### Step 10: Implement Specialized Widgets

**Location:** `src/components/widgets/specialized/`

Create:
1. CompositeWidget: Multiple sub-widgets
2. ParentWidget: Child widget manager
3. DynamicFormWidget: Embedded EntityForm
4. PivotTableSetupWidget: Pivot config UI
5. FilterAndColumnsSetupWidget: Filter/column setup
6. StepperCard: Step indicator
7. CronUIWidget: CRON builder
8. USMapWidget: Stub/placeholder
9. ScriptViewer: Syntax-highlighted code
10. CustomComponentWidget: Dynamic component mount

### Step 11: Implement DashboardWidgets Orchestrator

**Location:** `src/components/widgets/dashboard-widgets.tsx`

Orchestrate:
- Load widget list from metadata
- Render all widgets in responsive grid
- Manage collective widget lifecycle
- Handle errors at widget level
- Pass down context to children

### Step 12: Implement App Home Page

**Location:** `src/app/(dashboard)/app/[appName]/page.tsx`

Features:
- Fetch QAppMetaData
- Extract widget list
- Render LayoutHeader
- Render DashboardWidgets orchestrator
- Error boundary
- Loading state

### Step 13: Write Unit Tests

Test each component:
- Widget container rendering
- Data fetching with cancellation
- Dropdown selection handling
- Grid responsive behavior
- Block renderers
- Chart widgets with different data shapes

### Step 14: Write Integration Tests

Test:
- Full widget data flow
- Request deduplication
- Widget refresh cycle
- Export functionality

---

## 6. Component Specifications

### 6.1 Widget Type System

```typescript
// src/lib/types/widget.ts

/**
 * Widget dropdown configuration for filtering/parametrization
 */
export interface QWidgetDropdown {
  /** Source name for possible values (e.g., "getAllStatuses") */
  possibleValueSourceName: string
  /** Display label for dropdown */
  label: string
  /** Field name to store selected value */
  fieldName: string
  /** Default selected value */
  defaultValue?: string | number
  /** Whether dropdown is required */
  required?: boolean
}

/**
 * Complete widget metadata
 */
export interface QWidgetMetaData {
  /** Unique widget identifier */
  name: string
  /** Display label */
  label: string
  /** Widget type (chart, statistics, grid, block, form, etc.) */
  type: 'line-chart' | 'bar-chart' | 'horizontal-bar-chart' | 'stacked-bar-chart' | 'pie-chart' |
         'mini-statistics' | 'multi-statistics' | 'statistics' |
         'record-grid' | 'composite' | 'parent' | 'dynamic-form' |
         'pivot-table-setup' | 'filter-columns-setup' | 'stepper' | 'cron' |
         'us-map' | 'script-viewer' | 'custom' | 'block-list'
  /** Icon identifier (from UI library) */
  icon?: string
  /** Number of grid columns (1-12) */
  gridColumns: number
  /** Render as card with shadow/border */
  isCard?: boolean
  /** Show reload/refresh button */
  showReloadButton?: boolean
  /** Show export button */
  showExportButton?: boolean
  /** Dropdown selectors for filtering */
  dropdowns?: QWidgetDropdown[]
  /** Help text/content for help icon popover */
  helpContent?: string
  /** Permission check: whether user can view */
  hasPermission?: boolean
  /** Default widget state values */
  defaultValues?: Record<string, any>
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  autoRefreshInterval?: number
  /** Additional metadata per widget type */
  [key: string]: any
}

/**
 * Block type within block-list widget
 */
export type QBlockType =
  | 'text'
  | 'big-number'
  | 'up-or-down-number'
  | 'number-icon-badge'
  | 'progress-bar'
  | 'button'
  | 'icon'
  | 'image'
  | 'audio'
  | 'divider'
  | 'input-field'
  | 'table-sub-row-detail'

/**
 * Block value structure (varies by type)
 */
export interface QBlock {
  type: QBlockType
  /** Field name for form submission (if applicable) */
  fieldName?: string
  /** Display values per block type */
  values: Record<string, any>
}

/**
 * Text block values
 */
export interface QTextBlockValues {
  text: string
  format?: 'plain' | 'markdown' | 'html'
  fontSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl'
}

/**
 * BigNumber block values
 */
export interface QBigNumberBlockValues {
  value: number
  label: string
  unit?: string
  format?: 'default' | 'currency' | 'percent'
}

/**
 * UpOrDownNumber block values
 */
export interface QUpOrDownNumberBlockValues {
  value: number
  previousValue?: number
  label: string
  percentChange?: number
  colorUp?: string
  colorDown?: string
}

/**
 * NumberIconBadge block values
 */
export interface QNumberIconBadgeBlockValues {
  value: number
  icon: string
  iconColor?: string
  backgroundColor?: string
  label?: string
}

/**
 * ProgressBar block values
 */
export interface QProgressBarBlockValues {
  value: number
  max: number
  label: string
  showPercent?: boolean
  color?: 'blue' | 'green' | 'red' | 'yellow'
}

/**
 * Button block values
 */
export interface QButtonBlockValues {
  label: string
  action: 'navigate' | 'execute' | 'custom'
  target?: string
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Image block values
 */
export interface QImageBlockValues {
  url: string
  altText: string
  maxWidth?: string
  maxHeight?: string
}

/**
 * Audio block values
 */
export interface QAudioBlockValues {
  url: string
  label?: string
  controls?: boolean
}

/**
 * InputField block values
 */
export interface QInputFieldBlockValues {
  type: 'text' | 'number' | 'email' | 'date'
  placeholder?: string
  label?: string
  required?: boolean
}

/**
 * Chart data contract
 */
export interface QChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
    fill?: boolean
  }>
  options?: Record<string, any>
}

/**
 * Statistics data contract
 */
export interface QStatisticsData {
  value: number
  label: string
  icon?: string
  color?: string
  percentChange?: number
  trend?: 'up' | 'down' | 'stable'
  unit?: string
  format?: 'default' | 'currency' | 'percent'
}

/**
 * Multi-statistics data contract
 */
export interface QMultiStatisticsData {
  title?: string
  stats: QStatisticsData[]
}

/**
 * Record grid widget data contract
 */
export interface QRecordGridData {
  columns: ColumnConfig[]
  rows: QRecord[]
  totalCount: number
}

/**
 * Block list widget data contract
 */
export interface QBlockListData {
  blocks: QBlock[]
}

/**
 * Generic widget response (discriminated union)
 */
export type QWidgetResponse =
  | { type: 'chart'; data: QChartData }
  | { type: 'statistics'; data: QStatisticsData | QMultiStatisticsData }
  | { type: 'record-grid'; data: QRecordGridData }
  | { type: 'block-list'; data: QBlockListData }
  | { type: 'html'; data: { html: string } }
  | { type: 'custom'; data: Record<string, any> }

/**
 * Widget request parameters
 */
export interface QWidgetRequestParams {
  [key: string]: string | number | boolean | undefined
}

/**
 * Widget API error response
 */
export interface QWidgetError {
  code: string
  message: string
  details?: Record<string, any>
}
```

### 6.2 Widget Container Component

```typescript
// src/components/widgets/widget-container.tsx

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, RefreshCw, Download, HelpCircle, MoreVertical } from 'lucide-react'
import type { QWidgetMetaData, QWidgetDropdown, QWidgetRequestParams } from '@/lib/types/widget'

export interface WidgetContainerProps {
  /** Widget metadata */
  metadata: QWidgetMetaData
  /** Child widget content to render */
  children: React.ReactNode
  /** Called when dropdown selection changes */
  onDropdownChange?: (params: QWidgetRequestParams) => void
  /** Called when refresh button is clicked */
  onRefresh?: () => void
  /** Called when export is requested */
  onExport?: (format: 'csv' | 'json') => void
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Current dropdown values */
  dropdownValues?: Record<string, string | number>
  /** Dropdown possible values (loaded from API) */
  dropdownOptions?: Record<string, Array<{ label: string; value: string | number }>>
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  metadata,
  children,
  onDropdownChange,
  onRefresh,
  onExport,
  isLoading = false,
  error = null,
  dropdownValues = {},
  dropdownOptions = {},
}) => {
  const [selectedValues, setSelectedValues] = useState<QWidgetRequestParams>(
    metadata.defaultValues || {}
  )

  const handleDropdownChange = useCallback(
    (fieldName: string, value: string | number) => {
      const newValues = { ...selectedValues, [fieldName]: value }
      setSelectedValues(newValues)
      onDropdownChange?.(newValues)
    },
    [selectedValues, onDropdownChange]
  )

  const handleExportCsv = () => onExport?.('csv')
  const handleExportJson = () => onExport?.('json')

  const content = (
    <CardContent className="relative pt-4">
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-md z-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-600 dark:text-gray-400" />
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {children}
    </CardContent>
  )

  const cardElement = metadata.isCard !== false ? (
    <Card className={`col-span-${metadata.gridColumns}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {metadata.icon && <span className="text-lg">{metadata.icon}</span>}
            {metadata.label}
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Dropdown selectors */}
            {metadata.dropdowns && metadata.dropdowns.length > 0 && (
              <div className="flex gap-2">
                {metadata.dropdowns.map((dropdown) => (
                  <Select
                    key={dropdown.fieldName}
                    value={String(selectedValues[dropdown.fieldName] || dropdown.defaultValue || '')}
                    onValueChange={(value) => handleDropdownChange(dropdown.fieldName, value)}
                  >
                    <SelectTrigger className="w-40 h-8 text-sm">
                      <SelectValue placeholder={dropdown.label} />
                    </SelectTrigger>
                    <SelectContent>
                      {dropdownOptions[dropdown.fieldName]?.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            )}

            {/* Refresh button */}
            {metadata.showReloadButton !== false && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                title="Refresh widget"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}

            {/* Export dropdown */}
            {metadata.showExportButton !== false && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" title="Export widget">
                    <Download className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCsv}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJson}>
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Help popover */}
            {metadata.helpContent && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" title="Help">
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">
                  {metadata.helpContent}
                </PopoverContent>
              </Popover>
            )}

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  Configure
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {content}
    </Card>
  ) : (
    <div>{content}</div>
  )

  return cardElement
}
```

### 6.3 Widget Grid Component

```typescript
// src/components/widgets/widget-grid.tsx

import React from 'react'
import type { QWidgetMetaData } from '@/lib/types/widget'

export interface WidgetGridProps {
  /** Widget metadata list */
  widgets: QWidgetMetaData[]
  /** Widget components to render (keyed by widget name) */
  widgetElements: Record<string, React.ReactNode>
  /** Grid gap in pixels */
  gap?: number
  /** Responsive grid column counts */
  responsive?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
}

export const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets,
  widgetElements,
  gap = 4,
  responsive = { mobile: 1, tablet: 2, desktop: 3 },
}) => {
  const getGridColsClass = (gridColumns: number): string => {
    const colMap: Record<number, string> = {
      1: 'col-span-1',
      2: 'col-span-2',
      3: 'col-span-3',
      4: 'col-span-4',
      5: 'col-span-5',
      6: 'col-span-6',
      7: 'col-span-7',
      8: 'col-span-8',
      9: 'col-span-9',
      10: 'col-span-10',
      11: 'col-span-11',
      12: 'col-span-12',
    }
    return colMap[gridColumns] || 'col-span-12'
  }

  const gapClass = `gap-${gap}`

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${responsive.desktop || 3} ${gapClass}`}>
      {widgets.map((widget) => (
        <div key={widget.name} className={getGridColsClass(widget.gridColumns)}>
          {widgetElements[widget.name] || null}
        </div>
      ))}
    </div>
  )
}
```

### 6.4 Widget Hooks

```typescript
// src/hooks/use-widget-data.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/api/client'
import type { QWidgetResponse, QWidgetRequestParams, QWidgetError } from '@/lib/types/widget'

export interface UseWidgetDataOptions {
  /** Auto-refresh interval in milliseconds */
  autoRefreshInterval?: number
  /** Retry on error */
  retryCount?: number
  /** Delay between retries */
  retryDelay?: number
}

export interface UseWidgetDataResult {
  data: QWidgetResponse | null
  isLoading: boolean
  error: QWidgetError | null
  refetch: (params?: QWidgetRequestParams) => Promise<void>
  cancel: () => void
}

export function useWidgetData(
  widgetName: string,
  params?: QWidgetRequestParams,
  options: UseWidgetDataOptions = {}
): UseWidgetDataResult {
  const [data, setData] = useState<QWidgetResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<QWidgetError | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const autoRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(
    async (fetchParams?: QWidgetRequestParams) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/qqq/v1/widget/${widgetName}?${new URLSearchParams(
            Object.entries(fetchParams || params || {}).reduce(
              (acc, [key, value]) => {
                if (value !== undefined) {
                  acc[key] = String(value)
                }
                return acc
              },
              {} as Record<string, string>
            )
          ).toString()}`,
          {
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          setError(errorData)
          setData(null)
        } else {
          const result = await response.json()
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError({
            code: 'FETCH_ERROR',
            message: err.message,
          })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [widgetName, params]
  )

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (autoRefreshTimeoutRef.current) {
      clearTimeout(autoRefreshTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (options.autoRefreshInterval && options.autoRefreshInterval > 0) {
      autoRefreshTimeoutRef.current = setInterval(
        () => fetchData(),
        options.autoRefreshInterval
      )

      return () => {
        if (autoRefreshTimeoutRef.current) {
          clearInterval(autoRefreshTimeoutRef.current)
        }
      }
    }
  }, [fetchData, options.autoRefreshInterval])

  return {
    data,
    isLoading,
    error: error ? { code: error.code, message: error.message } : null,
    refetch: fetchData,
    cancel,
  }
}

// src/hooks/use-widget-dropdowns.ts

import { useState, useEffect } from 'react'
import type { QWidgetDropdown } from '@/lib/types/widget'

export interface UseWidgetDropdownsResult {
  options: Record<string, Array<{ label: string; value: string | number }>>
  isLoading: boolean
  error: string | null
}

export function useWidgetDropdowns(dropdowns?: QWidgetDropdown[]): UseWidgetDropdownsResult {
  const [options, setOptions] = useState<Record<string, Array<{ label: string; value: string | number }>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dropdowns || dropdowns.length === 0) return

    const fetchDropdownOptions = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const newOptions: Record<string, Array<{ label: string; value: string | number }>> = {}

        for (const dropdown of dropdowns) {
          const response = await fetch(
            `/api/qqq/v1/possible-values/${dropdown.possibleValueSourceName}`
          )
          if (!response.ok) throw new Error(`Failed to load ${dropdown.label}`)

          const data = await response.json()
          newOptions[dropdown.fieldName] = data.values || []
        }

        setOptions(newOptions)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dropdowns')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDropdownOptions()
  }, [dropdowns])

  return { options, isLoading, error }
}

// src/hooks/use-widget-export.ts

import { useCallback } from 'react'
import type { QWidgetResponse } from '@/lib/types/widget'

export interface UseWidgetExportResult {
  exportCsv: (data: QWidgetResponse | null, fileName: string) => void
  exportJson: (data: QWidgetResponse | null, fileName: string) => void
}

export function useWidgetExport(): UseWidgetExportResult {
  const exportCsv = useCallback((data: QWidgetResponse | null, fileName: string) => {
    if (!data) return

    let csvContent = 'data:text/csv;charset=utf-8,'
    let rows: string[] = []

    if (data.type === 'record-grid' && 'data' in data && data.data.rows) {
      const headers = data.data.columns?.map((col) => col.header) || []
      rows.push(headers.join(','))

      data.data.rows.forEach((row) => {
        const values = headers.map((header) => {
          const cellValue = row[header.toLowerCase()] || ''
          return `"${String(cellValue).replace(/"/g, '""')}"`
        })
        rows.push(values.join(','))
      })
    } else if (data.type === 'chart' && 'data' in data) {
      const chartData = data.data
      rows.push('Label,Value')
      chartData.labels?.forEach((label, idx) => {
        const value = chartData.datasets[0]?.data[idx] || ''
        rows.push(`"${label}",${value}`)
      })
    }

    csvContent += rows.join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csvContent))
    link.setAttribute('download', `${fileName}.csv`)
    link.click()
  }, [])

  const exportJson = useCallback((data: QWidgetResponse | null, fileName: string) => {
    if (!data) return

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.json`
    link.click()
  }, [])

  return { exportCsv, exportJson }
}
```

### 6.5 Chart Widgets

```typescript
// src/components/widgets/charts/default-line-chart.tsx

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { QChartData } from '@/lib/types/widget'

export interface DefaultLineChartProps {
  data: QChartData
  height?: number
}

export const DefaultLineChart: React.FC<DefaultLineChartProps> = ({ data, height = 300 }) => {
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    value: data.datasets[0]?.data[idx] || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          stroke={data.datasets[0]?.borderColor || '#8884d8'}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// src/components/widgets/charts/bar-chart.tsx

import React from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { QChartData } from '@/lib/types/widget'

export interface BarChartProps {
  data: QChartData
  height?: number
}

export const BarChart: React.FC<BarChartProps> = ({ data, height = 300 }) => {
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce(
      (acc, dataset, datasetIdx) => ({
        ...acc,
        [dataset.label]: dataset.data[idx] || 0,
      }),
      {}
    ),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        {data.datasets.map((dataset, idx) => (
          <Bar
            key={idx}
            dataKey={dataset.label}
            fill={dataset.backgroundColor || '#8884d8'}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

// src/components/widgets/charts/pie-chart.tsx

import React from 'react'
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { QChartData } from '@/lib/types/widget'

export interface PieChartProps {
  data: QChartData
  height?: number
}

export const PieChart: React.FC<PieChartProps> = ({ data, height = 300 }) => {
  const pieData = data.labels.map((label, idx) => ({
    name: label,
    value: data.datasets[0]?.data[idx] || 0,
  }))

  const colors = Array.isArray(data.datasets[0]?.backgroundColor)
    ? data.datasets[0].backgroundColor
    : [
        '#8884d8',
        '#82ca9d',
        '#ffc658',
        '#ff7c7c',
        '#8dd1e1',
        '#d084d0',
        '#a4de6c',
        '#fdb45c',
      ]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}

// src/components/widgets/charts/horizontal-bar-chart.tsx

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { QChartData } from '@/lib/types/widget'

export interface HorizontalBarChartProps {
  data: QChartData
  height?: number
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ data, height = 300 }) => {
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    value: data.datasets[0]?.data[idx] || 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis dataKey="name" type="category" />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="value"
          fill={data.datasets[0]?.backgroundColor || '#8884d8'}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// src/components/widgets/charts/stacked-bar-chart.tsx

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { QChartData } from '@/lib/types/widget'

export interface StackedBarChartProps {
  data: QChartData
  height?: number
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({ data, height = 300 }) => {
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce(
      (acc, dataset, datasetIdx) => ({
        ...acc,
        [dataset.label]: dataset.data[idx] || 0,
      }),
      {}
    ),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        {data.datasets.map((dataset, idx) => (
          <Bar
            key={idx}
            dataKey={dataset.label}
            fill={dataset.backgroundColor || '#8884d8'}
            stackId="stack"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
```

### 6.6 Statistics Widgets

```typescript
// src/components/widgets/statistics/mini-statistics-card.tsx

import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { QStatisticsData } from '@/lib/types/widget'

export interface MiniStatisticsCardProps {
  stat: QStatisticsData
  layout?: 'vertical' | 'horizontal'
}

export const MiniStatisticsCard: React.FC<MiniStatisticsCardProps> = ({
  stat,
  layout = 'vertical',
}) => {
  const iconColor = stat.color || 'text-blue-600'
  const trendIcon = stat.trend === 'up' ? (
    <TrendingUp className="w-4 h-4 text-green-600" />
  ) : stat.trend === 'down' ? (
    <TrendingDown className="w-4 h-4 text-red-600" />
  ) : null

  const containerClass = layout === 'horizontal' ? 'flex items-center gap-4' : 'space-y-2'
  const valueFormat = stat.format === 'currency' ? `$${stat.value.toLocaleString()}` :
                      stat.format === 'percent' ? `${stat.value}%` :
                      stat.value.toLocaleString()

  return (
    <div className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${containerClass}`}>
      {stat.icon && <span className={`text-2xl ${iconColor}`}>{stat.icon}</span>}
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
        <p className="text-2xl font-bold">{valueFormat}</p>
        {stat.percentChange !== undefined && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            {trendIcon}
            <span className={stat.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {stat.percentChange >= 0 ? '+' : ''}{stat.percentChange}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// src/components/widgets/statistics/multi-statistics-card.tsx

import React from 'react'
import { MiniStatisticsCard } from './mini-statistics-card'
import type { QMultiStatisticsData } from '@/lib/types/widget'

export interface MultiStatisticsCardProps {
  data: QMultiStatisticsData
  columns?: number
}

export const MultiStatisticsCard: React.FC<MultiStatisticsCardProps> = ({
  data,
  columns = 2,
}) => {
  return (
    <div className="space-y-3">
      {data.title && <h3 className="font-semibold text-lg">{data.title}</h3>}
      <div className={`grid grid-cols-${columns} gap-3`}>
        {data.stats.map((stat, idx) => (
          <MiniStatisticsCard key={idx} stat={stat} />
        ))}
      </div>
    </div>
  )
}

// src/components/widgets/statistics/statistics-card.tsx

import React from 'react'
import type { QStatisticsData } from '@/lib/types/widget'

export interface StatisticsCardProps {
  stat: QStatisticsData
  size?: 'sm' | 'md' | 'lg'
}

export const StatisticsCard: React.FC<StatisticsCardProps> = ({ stat, size = 'md' }) => {
  const sizeClass = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-base',
    lg: 'p-6 text-lg',
  }[size]

  const valueFormat = stat.format === 'currency' ? `$${stat.value.toLocaleString()}` :
                      stat.format === 'percent' ? `${stat.value}%` :
                      stat.value.toLocaleString()

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${sizeClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 dark:text-gray-400">{stat.label}</p>
          <p className="font-bold mt-1">{valueFormat}</p>
        </div>
        {stat.icon && <span className="text-3xl opacity-20">{stat.icon}</span>}
      </div>
    </div>
  )
}
```

### 6.7 Block Renderers

```typescript
// src/components/widgets/blocks/block-renderer.tsx

import React from 'react'
import type { QBlock, QBlockType } from '@/lib/types/widget'
import { TextBlock } from './text-block'
import { BigNumberBlock } from './big-number-block'
import { UpOrDownNumberBlock } from './up-or-down-number-block'
import { NumberIconBadgeBlock } from './number-icon-badge-block'
import { ProgressBarBlock } from './progress-bar-block'
import { ButtonBlock } from './button-block'
import { IconBlock } from './icon-block'
import { ImageBlock } from './image-block'
import { AudioBlock } from './audio-block'
import { DividerBlock } from './divider-block'
import { InputFieldBlock } from './input-field-block'

export interface BlockRendererProps {
  block: QBlock
  onInputChange?: (fieldName: string, value: any) => void
  onButtonClick?: (action: string, target?: string) => void
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  onInputChange,
  onButtonClick,
}) => {
  switch (block.type) {
    case 'text':
      return <TextBlock values={block.values} />
    case 'big-number':
      return <BigNumberBlock values={block.values} />
    case 'up-or-down-number':
      return <UpOrDownNumberBlock values={block.values} />
    case 'number-icon-badge':
      return <NumberIconBadgeBlock values={block.values} />
    case 'progress-bar':
      return <ProgressBarBlock values={block.values} />
    case 'button':
      return (
        <ButtonBlock
          values={block.values}
          onClick={() => onButtonClick?.(block.values.action, block.values.target)}
        />
      )
    case 'icon':
      return <IconBlock values={block.values} />
    case 'image':
      return <ImageBlock values={block.values} />
    case 'audio':
      return <AudioBlock values={block.values} />
    case 'divider':
      return <DividerBlock values={block.values} />
    case 'input-field':
      return (
        <InputFieldBlock
          values={block.values}
          onChange={(value) => onInputChange?.(block.fieldName || '', value)}
        />
      )
    default:
      return <div className="text-gray-500">Unknown block type: {block.type}</div>
  }
}

// src/components/widgets/blocks/text-block.tsx

import React from 'react'
import type { QTextBlockValues } from '@/lib/types/widget'
import { marked } from 'marked'

export interface TextBlockProps {
  values: QTextBlockValues
}

export const TextBlock: React.FC<TextBlockProps> = ({ values }) => {
  const sizeClass = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  }[values.fontSize || 'base']

  if (values.format === 'html') {
    return (
      <div
        className={sizeClass}
        dangerouslySetInnerHTML={{ __html: values.text }}
      />
    )
  }

  if (values.format === 'markdown') {
    const html = marked.parse(values.text)
    return (
      <div
        className={`prose dark:prose-invert ${sizeClass}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return <p className={sizeClass}>{values.text}</p>
}

// src/components/widgets/blocks/big-number-block.tsx

import React from 'react'
import type { QBigNumberBlockValues } from '@/lib/types/widget'

export interface BigNumberBlockProps {
  values: QBigNumberBlockValues
}

export const BigNumberBlock: React.FC<BigNumberBlockProps> = ({ values }) => {
  const formattedValue =
    values.format === 'currency' ? `$${values.value.toLocaleString()}`
    : values.format === 'percent' ? `${values.value}%`
    : values.value.toLocaleString()

  return (
    <div className="text-center py-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{values.label}</p>
      <p className="text-5xl font-bold mt-2">{formattedValue}</p>
      {values.unit && <p className="text-sm mt-1 text-gray-500">{values.unit}</p>}
    </div>
  )
}

// src/components/widgets/blocks/up-or-down-number-block.tsx

import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { QUpOrDownNumberBlockValues } from '@/lib/types/widget'

export interface UpOrDownNumberBlockProps {
  values: QUpOrDownNumberBlockValues
}

export const UpOrDownNumberBlock: React.FC<UpOrDownNumberBlockProps> = ({ values }) => {
  const isPositive = (values.percentChange || 0) >= 0
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600'
  const trendIcon = isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-600 dark:text-gray-400">{values.label}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-3xl font-bold">{values.value.toLocaleString()}</p>
        {values.percentChange !== undefined && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            {trendIcon}
            <span className="text-sm font-semibold">
              {isPositive ? '+' : ''}{values.percentChange}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// src/components/widgets/blocks/number-icon-badge-block.tsx

import React from 'react'
import type { QNumberIconBadgeBlockValues } from '@/lib/types/widget'

export interface NumberIconBadgeBlockProps {
  values: QNumberIconBadgeBlockValues
}

export const NumberIconBadgeBlock: React.FC<NumberIconBadgeBlockProps> = ({ values }) => {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: values.backgroundColor || '#e5e7eb',
        }}
      >
        <span style={{ color: values.iconColor || '#000' }}>{values.icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold">{values.value}</p>
        {values.label && <p className="text-xs text-gray-600 dark:text-gray-400">{values.label}</p>}
      </div>
    </div>
  )
}

// src/components/widgets/blocks/progress-bar-block.tsx

import React from 'react'
import type { QProgressBarBlockValues } from '@/lib/types/widget'

export interface ProgressBarBlockProps {
  values: QProgressBarBlockValues
}

export const ProgressBarBlock: React.FC<ProgressBarBlockProps> = ({ values }) => {
  const percent = (values.value / values.max) * 100
  const colorClass = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  }[values.color || 'blue']

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{values.label}</p>
        {values.showPercent && <p className="text-sm text-gray-600">{Math.round(percent)}%</p>}
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

// src/components/widgets/blocks/button-block.tsx

import React from 'react'
import { Button } from '@/components/ui/button'
import type { QButtonBlockValues } from '@/lib/types/widget'

export interface ButtonBlockProps {
  values: QButtonBlockValues
  onClick?: () => void
}

export const ButtonBlock: React.FC<ButtonBlockProps> = ({ values, onClick }) => {
  const sizeClass = {
    sm: 'text-sm py-1 px-3',
    md: 'text-base py-2 px-4',
    lg: 'text-lg py-3 px-6',
  }[values.size || 'md']

  return (
    <Button
      onClick={onClick}
      variant={values.variant as 'default' | 'outline' | 'ghost' | 'destructive' || 'default'}
      className={sizeClass}
    >
      {values.label}
    </Button>
  )
}

// src/components/widgets/blocks/icon-block.tsx

import React from 'react'
import type { QBlock } from '@/lib/types/widget'

export interface IconBlockProps {
  values: Record<string, any>
}

export const IconBlock: React.FC<IconBlockProps> = ({ values }) => {
  return (
    <div className="flex items-center justify-center">
      <span className="text-4xl">{values.icon}</span>
    </div>
  )
}

// src/components/widgets/blocks/image-block.tsx

import React from 'react'
import type { QImageBlockValues } from '@/lib/types/widget'

export interface ImageBlockProps {
  values: QImageBlockValues
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ values }) => {
  return (
    <img
      src={values.url}
      alt={values.altText}
      className="rounded-lg"
      style={{
        maxWidth: values.maxWidth || '100%',
        maxHeight: values.maxHeight || 'auto',
      }}
    />
  )
}

// src/components/widgets/blocks/audio-block.tsx

import React from 'react'
import type { QAudioBlockValues } from '@/lib/types/widget'

export interface AudioBlockProps {
  values: QAudioBlockValues
}

export const AudioBlock: React.FC<AudioBlockProps> = ({ values }) => {
  return (
    <div className="space-y-2">
      {values.label && <p className="text-sm font-medium">{values.label}</p>}
      <audio
        controls={values.controls !== false}
        className="w-full"
        src={values.url}
      />
    </div>
  )
}

// src/components/widgets/blocks/divider-block.tsx

import React from 'react'

export interface DividerBlockProps {
  values?: Record<string, any>
}

export const DividerBlock: React.FC<DividerBlockProps> = () => {
  return <div className="border-t border-gray-200 dark:border-gray-700 my-4" />
}

// src/components/widgets/blocks/input-field-block.tsx

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { QInputFieldBlockValues } from '@/lib/types/widget'

export interface InputFieldBlockProps {
  values: QInputFieldBlockValues
  onChange?: (value: string) => void
}

export const InputFieldBlock: React.FC<InputFieldBlockProps> = ({ values, onChange }) => {
  return (
    <div className="space-y-2">
      {values.label && <Label htmlFor="input-field">{values.label}</Label>}
      <Input
        id="input-field"
        type={values.type}
        placeholder={values.placeholder}
        required={values.required}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  )
}
```

### 6.8 Record Grid Widget

```typescript
// src/components/widgets/record-grid-widget.tsx

import React, { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DataGrid } from '@/components/data-grid/data-grid'
import type { DataGridProps } from '@/components/data-grid/types'
import type { QRecordGridData } from '@/lib/types/widget'

export interface RecordGridWidgetProps {
  data: QRecordGridData
  onAddRow?: () => void
  onDeleteRow?: (rowId: string | number) => Promise<void>
  onEditRow?: (rowId: string | number, values: Record<string, any>) => Promise<void>
  allowAdd?: boolean
  allowEdit?: boolean
  allowDelete?: boolean
}

export const RecordGridWidget: React.FC<RecordGridWidgetProps> = ({
  data,
  onAddRow,
  onDeleteRow,
  onEditRow,
  allowAdd = true,
  allowEdit = true,
  allowDelete = true,
}) => {
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = (rowId: string | number) => {
    setSelectedRowId(rowId)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedRowId || !onDeleteRow) return

    setIsDeleting(true)
    try {
      await onDeleteRow(selectedRowId)
    } catch (err) {
      console.error('Failed to delete row:', err)
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setSelectedRowId(null)
    }
  }

  const columns = [
    ...data.columns,
    ...(allowDelete
      ? [
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }: any) => (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteClick(row.original.id)}
              >
                Delete
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <div className="space-y-4">
        {allowAdd && (
          <Button onClick={onAddRow}>
            + Add Row
          </Button>
        )}

        <DataGrid
          columns={columns}
          data={data.rows}
          enableColumnSorting
          enableGlobalFilter
          enableRowSelection={false}
        />
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Row</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this row? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

### 6.9 DashboardWidgets Orchestrator

```typescript
// src/components/widgets/dashboard-widgets.tsx

import React, { useState, useEffect } from 'react'
import { WidgetContainer } from './widget-container'
import { WidgetGrid } from './widget-grid'
import { BlockRenderer } from './blocks/block-renderer'
import { DefaultLineChart } from './charts/default-line-chart'
import { BarChart } from './charts/bar-chart'
import { HorizontalBarChart } from './charts/horizontal-bar-chart'
import { StackedBarChart } from './charts/stacked-bar-chart'
import { PieChart } from './charts/pie-chart'
import { MiniStatisticsCard } from './statistics/mini-statistics-card'
import { MultiStatisticsCard } from './statistics/multi-statistics-card'
import { StatisticsCard } from './statistics/statistics-card'
import { RecordGridWidget } from './record-grid-widget'
import { useWidgetData } from '@/hooks/use-widget-data'
import { useWidgetDropdowns } from '@/hooks/use-widget-dropdowns'
import { useWidgetExport } from '@/hooks/use-widget-export'
import type { QWidgetMetaData, QWidgetRequestParams } from '@/lib/types/widget'

export interface DashboardWidgetsProps {
  widgets: QWidgetMetaData[]
  onWidgetError?: (widgetName: string, error: string) => void
}

const renderWidgetContent = (
  metadata: QWidgetMetaData,
  data: any,
  isLoading: boolean
) => {
  if (!data) return <div className="text-gray-500">No data available</div>

  switch (metadata.type) {
    case 'line-chart':
      return <DefaultLineChart data={data.data} />
    case 'bar-chart':
      return <BarChart data={data.data} />
    case 'horizontal-bar-chart':
      return <HorizontalBarChart data={data.data} />
    case 'stacked-bar-chart':
      return <StackedBarChart data={data.data} />
    case 'pie-chart':
      return <PieChart data={data.data} />
    case 'mini-statistics':
      return <MiniStatisticsCard stat={data.data} />
    case 'multi-statistics':
      return <MultiStatisticsCard data={data.data} />
    case 'statistics':
      return <StatisticsCard stat={data.data} />
    case 'record-grid':
      return <RecordGridWidget data={data.data} />
    case 'block-list':
      return (
        <div className="space-y-4">
          {data.data.blocks.map((block, idx) => (
            <BlockRenderer key={idx} block={block} />
          ))}
        </div>
      )
    case 'html':
      return (
        <div
          dangerouslySetInnerHTML={{ __html: data.data.html }}
        />
      )
    default:
      return <div className="text-gray-500">Unknown widget type: {metadata.type}</div>
  }
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  widgets,
  onWidgetError,
}) => {
  const [widgetParams, setWidgetParams] = useState<Record<string, QWidgetRequestParams>>({})

  const widgetElements: Record<string, React.ReactNode> = {}

  for (const widget of widgets) {
    const params = widgetParams[widget.name]
    const { data, isLoading, error, refetch } = useWidgetData(widget.name, params)
    const { options: dropdownOptions } = useWidgetDropdowns(widget.dropdowns)
    const { exportCsv, exportJson } = useWidgetExport()

    const handleDropdownChange = (newParams: QWidgetRequestParams) => {
      setWidgetParams((prev) => ({
        ...prev,
        [widget.name]: newParams,
      }))
      refetch(newParams)
    }

    const handleExport = (format: 'csv' | 'json') => {
      if (format === 'csv') {
        exportCsv(data, widget.name)
      } else {
        exportJson(data, widget.name)
      }
    }

    widgetElements[widget.name] = (
      <WidgetContainer
        key={widget.name}
        metadata={widget}
        isLoading={isLoading}
        error={error?.message || null}
        dropdownValues={widgetParams[widget.name] || {}}
        dropdownOptions={dropdownOptions}
        onDropdownChange={handleDropdownChange}
        onRefresh={() => refetch()}
        onExport={handleExport}
      >
        {renderWidgetContent(widget, data, isLoading)}
      </WidgetContainer>
    )
  }

  return <WidgetGrid widgets={widgets} widgetElements={widgetElements} />
}
```

### 6.10 API Client Function

```typescript
// src/lib/api/widget-client.ts

import type { QWidgetResponse, QWidgetRequestParams, QWidgetError } from '@/lib/types/widget'

interface CacheEntry {
  data: QWidgetResponse | null
  timestamp: number
}

class WidgetRequestDeduplicator {
  private pendingRequests: Map<string, Promise<QWidgetResponse | null>> = new Map()
  private cache: Map<string, CacheEntry> = new Map()
  private cacheMaxAge = 30000 // 30 seconds

  async fetch(
    widgetName: string,
    params: QWidgetRequestParams = {},
    options: { signal?: AbortSignal; cache?: boolean } = {}
  ): Promise<QWidgetResponse | null> {
    const cacheKey = this.buildCacheKey(widgetName, params)

    // Check cache
    if (options.cache !== false) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
        return cached.data
      }
    }

    // Check pending request
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!
    }

    // Create new request
    const promise = this.executeRequest(widgetName, params, options.signal)
    this.pendingRequests.set(cacheKey, promise)

    try {
      const result = await promise
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      })
      return result
    } finally {
      this.pendingRequests.delete(cacheKey)
    }
  }

  private async executeRequest(
    widgetName: string,
    params: QWidgetRequestParams,
    signal?: AbortSignal
  ): Promise<QWidgetResponse | null> {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value)
          }
          return acc
        },
        {} as Record<string, string>
      )
    ).toString()

    const url = `/api/qqq/v1/widget/${widgetName}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, { signal })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || `Failed to fetch widget: ${response.statusText}`)
    }

    return response.json()
  }

  private buildCacheKey(widgetName: string, params: QWidgetRequestParams): string {
    const paramStr = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&')
    return `${widgetName}:${paramStr}`
  }

  clearCache() {
    this.cache.clear()
  }

  clearCacheForWidget(widgetName: string) {
    const keysToDelete = Array.from(this.cache.keys()).filter((key) =>
      key.startsWith(`${widgetName}:`)
    )
    keysToDelete.forEach((key) => this.cache.delete(key))
  }
}

export const widgetDeduplicator = new WidgetRequestDeduplicator()

export async function fetchWidgetData(
  widgetName: string,
  params?: QWidgetRequestParams,
  signal?: AbortSignal
): Promise<QWidgetResponse | null> {
  return widgetDeduplicator.fetch(widgetName, params || {}, { signal })
}
```

---

## 7. API Client Functions

### 7.1 Widget Data Fetching

```typescript
// Signature
async function fetchWidgetData(
  widgetName: string,
  params?: Record<string, string | number | boolean>,
  signal?: AbortSignal
): Promise<QWidgetResponse | null>

// Usage
const response = await fetchWidgetData('salesDashboard', {
  month: '2025-02',
  region: 'us-east'
})
```

### 7.2 Possible Values Fetching

```typescript
// Signature
async function fetchPossibleValues(
  sourceName: string
): Promise<Array<{ label: string; value: string | number }>>

// Usage
const options = await fetchPossibleValues('getAllRegions')
```

### 7.3 Widget Request Deduplication

```typescript
// Request is automatically deduplicated by widgetDeduplicator
// If two requests for same widget + params are made simultaneously,
// second one reuses first one's Promise instead of creating new request
```

---

## 8. Testing Requirements

### 8.1 Unit Tests

Create test files:
- `__tests__/components/widgets/widget-container.test.tsx`
- `__tests__/components/widgets/widget-grid.test.tsx`
- `__tests__/components/widgets/blocks/text-block.test.tsx`
- `__tests__/components/widgets/blocks/big-number-block.test.tsx`
- `__tests__/components/widgets/charts/default-line-chart.test.tsx`
- `__tests__/components/widgets/statistics/mini-statistics-card.test.tsx`
- `__tests__/hooks/use-widget-data.test.ts`
- `__tests__/hooks/use-widget-export.test.ts`
- `__tests__/lib/api/widget-client.test.ts`

### 8.2 Integration Tests

- Widget data flow (fetch -> render -> refresh)
- Dropdown selection triggers data refetch
- Request cancellation on component unmount
- Export functionality (CSV, JSON)
- Record grid widget CRUD operations
- Multiple widgets on same page

### 8.3 Test Coverage Targets

- Components: 85%+ line coverage
- Hooks: 90%+ line coverage
- API client: 95%+ line coverage
- E2E scenarios: All critical user flows

---

## 9. Acceptance Criteria

### Component Rendering

1. WidgetContainer renders label, icon, and metadata-driven UI correctly
2. WidgetGrid applies gridColumns metadata to responsive layout
3. WidgetGrid is 1-column on mobile, 2-column on tablet, N-column on desktop per metadata
4. Reload button appears when showReloadButton is true
5. Export button appears when showExportButton is true
6. Help popover displays helpContent when present
7. Dropdown selectors render for each QWidgetDropdown in metadata

### Data Fetching and Lifecycle

8. useWidgetData fetches data from GET /qqq/v1/widget/{widgetName}
9. Query params are correctly serialized and passed to API
10. Request deduplicator prevents duplicate simultaneous requests for same widget+params
11. Changing dropdown selection triggers widget data refetch with new params
12. Changing dropdown selection cancels previous in-flight request
13. useWidgetData cleanup cancels fetch AbortController on unmount
14. Auto-refresh interval works correctly when autoRefreshInterval > 0
15. Manual refresh button calls refetch()
16. Error state renders error message when API returns error

### Chart Widgets

17. DefaultLineChart renders line chart with labels and data
18. BarChart renders vertical bar chart with multiple datasets
19. HorizontalBarChart renders horizontal bars
20. StackedBarChart renders stacked bars
21. PieChart renders pie/doughnut with legend
22. All charts are responsive (ResponsiveContainer)
23. All charts render tooltip on hover
24. Chart data loads correctly from widget API response

### Statistics Widgets

25. MiniStatisticsCard renders value, label, icon, percentage change
26. MiniStatisticsCard shows TrendingUp icon when percentChange > 0
27. MiniStatisticsCard shows TrendingDown icon when percentChange < 0
28. MultiStatisticsCard renders title and grid of stats
29. StatisticsCard renders stat with icon and value

### Block Renderers

30. TextBlock renders plain text correctly
31. TextBlock renders markdown when format='markdown'
32. BigNumberBlock renders large number with label and unit
33. UpOrDownNumberBlock shows trend arrow and percentage
34. ProgressBarBlock renders progress bar with label and percentage
35. ButtonBlock is clickable and calls onClick handler
36. ImageBlock renders image with alt text and max-width
37. AudioBlock renders HTML audio player with controls
38. DividerBlock renders horizontal line
39. InputFieldBlock renders form input with label

### Record Grid Widget

40. RecordGridWidget embeds DataGrid from Package 2
41. RecordGridWidget shows Add Row button when allowAdd=true
42. RecordGridWidget Delete button calls onDeleteRow callback
43. Delete confirmation dialog appears before deletion
44. RecordGridWidget syncs deleted rows back to parent

### Export Functionality

45. useWidgetExport.exportCsv generates CSV with widget data
46. useWidgetExport.exportJson generates JSON with widget data
47. Export CSV contains proper headers and escaped values
48. Export triggers download in browser

### DashboardWidgets Orchestrator

49. DashboardWidgets renders all widgets from metadata array
50. DashboardWidgets passes widget params to useWidgetData hooks
51. DashboardWidgets maps widget.type to correct component renderer
52. DashboardWidgets manages dropdown changes at orchestrator level

### App Home Page

53. App home page loads QAppMetaData for [appName]
54. App home page extracts widget list from metadata.widgets
55. App home page renders DashboardWidgets with widget list
56. App home page renders DashboardLayout for consistent styling
57. Loading skeleton appears while metadata loads
58. Error boundary catches widget render errors

### API Contract

59. Widget API accepts dynamic query params per widget
60. Widget API response shape matches QWidgetResponse discriminated union
61. Widget API returns proper error JSON on error
62. Widget request includes auth token in headers

---

## 10. Implementation Dependencies

### Package 1 Dependencies (Must be Complete)

- QContext provider with useQContext hook
- Theme context with useTheme hook
- API client with fetch/auth
- Auth context with useAuth hook
- DashboardLayout component
- Type definitions for QRecord, QFieldMetaData

### Package 2 Dependencies (Must be Complete)

- DataGrid component and usePagination hook
- Column config types
- Cell renderer system
- Filter builder

### Package 3 Dependencies (Must be Complete)

- EntityForm component
- DynamicFormField component
- FieldDisplay component

---

## 11. Performance Considerations

- Widget requests use AbortController to cancel pending requests
- Request deduplicator prevents simultaneous duplicate requests
- Chart rendering uses ResponsiveContainer for responsive scaling
- Lazy load widget components using React.lazy() for code splitting
- Implement virtualization for large record grids
- Memoize widgets with React.memo to prevent unnecessary re-renders

---

## 12. Error Handling

- All API calls catch and display errors gracefully
- Error boundary wraps widget content
- Missing metadata fields default to sensible values
- Failed widget doesn't block other widgets on page
- Network errors show user-friendly message

---

## 13. Deliverables Checklist

- [ ] Type system (src/lib/types/widget.ts) - 150+ lines
- [ ] WidgetContainer component - 250+ lines
- [ ] WidgetGrid component - 80+ lines
- [ ] All 5 chart widgets - 350+ lines
- [ ] All 3 statistics widgets - 200+ lines
- [ ] All 11 block renderers - 400+ lines
- [ ] BlockRenderer orchestrator - 80+ lines
- [ ] RecordGridWidget - 150+ lines
- [ ] DashboardWidgets orchestrator - 200+ lines
- [ ] useWidgetData hook - 120+ lines
- [ ] useWidgetDropdowns hook - 80+ lines
- [ ] useWidgetExport hook - 100+ lines
- [ ] Widget API client - 150+ lines
- [ ] App home page (page.tsx) - 100+ lines
- [ ] Unit tests - 800+ lines
- [ ] Integration tests - 400+ lines
- [ ] Documentation - README.md with usage examples

