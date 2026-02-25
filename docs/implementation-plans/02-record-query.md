# Work Package 2: Record Query Page

**Package Status:** Ready for Implementation
**Estimated Duration:** 6 weeks
**Team Size:** 2-3 engineers
**Priority:** High - Core feature for data navigation

## 1. Prerequisites

This package **directly depends on** the following components and utilities from Package 1 (Scaffold + Auth + Layout Shell):

### Type Definitions
- `import { QInstance, QTableMetaData, QFieldMetaData, QRecord, QQueryFilter, QFilterCriteria, QCriteriaOperator, QFieldType, QAdornmentType } from '@/types'`
- All enum values for `QCriteriaOperator` (20 operators: EQUALS, NOT_EQUALS, IN, STARTS_WITH, ENDS_WITH, CONTAINS, LESS_THAN, GREATER_THAN, IS_BLANK, BETWEEN, etc.)
- All enum values for `QFieldType` (STRING, INTEGER, LONG, DECIMAL, BOOLEAN, DATE, TIME, DATE_TIME, TEXT, HTML, PASSWORD, BLOB)
- All enum values for `QAdornmentType` (LINK, CHIP, SIZE, ERROR, RENDER_HTML, REVEAL, CODE_EDITOR, FILE_DOWNLOAD, FILE_UPLOAD, TOOLTIP)

### API Client
- `import { apiClient } from '@/lib/api/client'` - Axios instance with 401 interceptor and baseURL
- `import { loadTableMetaData } from '@/lib/api/metadata'` - Returns `QTableMetaData`
- `import { queryKeys } from '@/lib/query-client'` - TanStack Query key factory

### Context & Hooks
- `import { useAuth } from '@/lib/auth/auth-provider'` - Provides `user`, `token`, `isAuthenticated`
- `import { useQContext } from '@/lib/context/q-context'` - Provides `pageHeader`, `accentColor`, `tableMetaData`, `modalStack`, `pushModal`, `popModal`
- `import { useTheme } from '@/lib/theme/theme-provider'` - Provides theme utilities

### Layout Components
- Dashboard layout at `/src/app/(dashboard)/layout.tsx` - Already wraps the page
- Sidebar, Header, Breadcrumbs, Banner components already in place
- Navigation helpers for dynamic routing: `useRouter`, `useParams` from Next.js

### UI Library
- shadcn/ui v1.0+ components (Button, Input, Select, Checkbox, Dialog, Popover, DropdownMenu, etc.)
- TanStack Table v8.0+ for data grid (useReactTable, getCoreRowModel, getPaginationRowModel, etc.)
- TanStack Query v5.0+ for server-side data fetching
- Tailwind CSS 4.0+ for styling

### Existing Page Structure
- Placeholder page at `/src/app/(dashboard)/app/[tableName]/page.tsx` will be **replaced** by the Record Query implementation

---

## 2. Requirements Traceability

| Requirement Section | Feature | Implementation Step | Status |
|---|---|---|---|
| 5.2.3 Query Route | Dynamic route param `[tableName]` | Step 1: Page Setup | New |
| 5.3.2 Data Grid | TanStack Table v8 with columns from metadata | Step 3: Data Grid Implementation | New |
| 5.3.5 Query/Filter Components | Basic quick-filter + Advanced filter builder | Step 4: Filter Components | New |
| 5.4.2 Responsive Query | Mobile-friendly DataGrid, collapsible filters | Step 9: Responsive Design | New |
| 3.4.1 Query | POST /query endpoint, server-side pagination | Step 2: API Query Function | New |
| 3.4.2 Count | POST /count endpoint for total records | Step 2: API Count Function | New |
| 3.7 Possible Values | POST /possibleValues for filter dropdowns | Step 5: Filter Operators & Inputs | New |
| 3.9 Pagination Contract | offset/limit, page size selector (10/25/50/100) | Step 6: Pagination Controls | New |
| 3.10 Filtering Contract | Full QQueryFilter with 20 operators, AND/OR logic | Step 4 & 5: Filter Builder | New |
| N/A Permissions | Check insertPermission, processPermission | Step 1 & 7: Toolbar Setup | New |
| N/A Column Persistence | localStorage for visibility, width, order | Step 8: Column Configuration | New |
| N/A Row Selection | Single/multi-select with checkbox column | Step 3: Row Selection | New |
| N/A Saved Views | Save/load filter + column + sort configs | Step 10: Saved Views | New |
| N/A Export | CSV export (extensible) | Step 11: Export Functionality | New |
| N/A Row Navigation | Row click → `/app/{tableName}/{recordId}` | Step 3: Row Click Handling | New |
| N/A Toolbar | Create button, process launcher, config toggle | Step 7: Toolbar Components | New |
| N/A Table Variants | Support `table.usesVariants` | Step 1 & 7: Variant Selection | New |
| N/A Query Dedup | latestQueryId to discard stale results | Step 2: Query Deduplication | New |

---

## 3. Shared Context Files Required

The following files from `/docs/shared-context/` are critical references:

1. **`qfmd-current-recordquery.tsx`** - Current 260+ line RecordQuery component from legacy codebase
   - State machine pattern (initial → loadingMetaData → loadedMetaData → ... → ready → error)
   - localStorage key patterns for persistence
   - Filter builder logic with all 20 operators
   - Cell renderer dispatch logic per field/adornment type

2. **`qfmd-api-contracts.md`** - Complete API endpoint specifications
   - Request/response shapes for /query, /count, /possibleValues
   - Error response formats
   - Pagination contract (skip = (page - 1) * pageSize)

3. **`qfmd-type-definitions.ts`** - TypeScript interfaces for QQueryFilter, QFilterCriteria, QCriteriaOperator, etc.
   - Recursive structure for sub-filters
   - Expression types: FilterVariableExpression, NowExpression, NowWithOffsetExpression, ThisOrLastPeriodExpression

4. **`qfmd-metadata-sample.json`** - Sample QTableMetaData structure
   - Field metadata with type, adornment, label, hints
   - Table-level permissions (insertPermission, updatePermission, etc.)
   - Process metadata (name, permission, label)

---

## 4. Scope: In and Out

### In Scope (19 detailed features)

1. **Dynamic Route Page** - `/src/app/(dashboard)/app/[tableName]/page.tsx` replacing placeholder
2. **Server-Side Data Grid** - TanStack Table v8 with 50+ columns from metadata
3. **Pagination** - offset/limit via POST /query, page size selector (10/25/50/100), "Go to page" input
4. **Filtering**:
   - Basic mode: Quick text search across visible columns (debounced 400ms)
   - Advanced mode: Full QQueryFilter builder with 20 operators, AND/OR boolean logic, sub-filters
   - Expression types: FilterVariableExpression (literal), NowExpression, NowWithOffsetExpression, ThisOrLastPeriodExpression
5. **Dynamic Column Generation** - From QTableMetaData.fields, respects fieldVisibility, fieldOrder
6. **Cell Renderers** - 12 field types × 10 adornment types = 120 renderer combinations
7. **Sorting** - Multi-column sort via orderBys[], TanStack Table integrations
8. **Row Selection** - Single and multi-select with checkbox column, bulk action awareness
9. **Row Navigation** - Click row → navigate to `/app/{tableName}/{recordId}`
10. **Toolbar**:
    - Create button (if insertPermission)
    - Process launcher dropdown (if processPermission)
    - Column configuration toggle
    - Density selector (compact/standard/comfortable)
    - Saved views menu
    - Export dropdown (CSV)
11. **Column Configuration Panel** - Show/hide, reorder (drag-drop or buttons), persist to localStorage
12. **Saved Views** - Save current filter + columns + sort as named view, load/delete views (localStorage or process-backed)
13. **Query Deduplication** - latestQueryId pattern to discard stale results
14. **localStorage Persistence** - Density, column widths, column visibility, column order, saved views
15. **Table Variants** - If table.usesVariants, variant selector in toolbar, pass tableVariant to /query
16. **Loading/Empty/Error States** - Skeleton loaders, empty state message, error recovery
17. **Responsive Design** - Mobile-friendly grid (collapsible columns, horizontal scroll), tablet layout
18. **Accessibility** - ARIA labels, keyboard navigation, screen reader support for filters
19. **Permission Checks** - Hide/disable buttons based on user permissions from tableMetaData

### Out of Scope (explicitly NOT in this package)

- **Record View / CRUD** (Package 3): Creating/editing individual records, field validation forms
- **Process Execution** (Package 4): Running batch operations, process result display
- **Widgets** (Package 5): Dashboard widgets, KPI cards
- **Storybook / E2E Testing** (Package 6): Component isolation, automated UI tests
- **Advanced Export** (Excel, PDF, XML): CSV only; extensible architecture for future formats
- **Real-time Updates**: No WebSocket subscriptions for live grid updates
- **Full-text Search Integration**: Use basic filter/advanced filter only
- **Joins Visualization**: Joins passed in request but not UI for join builder
- **Custom Calculated Columns**: Only fields from metadata
- **Gantt/Calendar/Map Views**: Grid view only

---

## 5. Detailed Implementation Steps

### Step 1: Page Setup & Metadata Loading

**Objective:** Create the main Record Query page component with state machine and metadata loading.

**Files to create:**

1. **`/src/app/(dashboard)/app/[tableName]/page.tsx`** (600+ lines)
   - Main page component, replaces placeholder
   - State machine: initial → loadingMetaData → loadedMetaData → ready → error
   - Metadata loading via useQuery(queryKeys.tableMetaData(tableName))
   - Permission checks (insertPermission, processPermission, updatePermission, deletePermission)
   - Table variant detection and selection
   - Breadcrumb population via useQContext

2. **`/src/lib/hooks/useRecordQuery.ts`** (400+ lines)
   - Custom hook managing entire query page state
   - State interface: `RecordQueryPageState`
   - Actions: setFilter, setPagination, setSort, setDensity, setColumnConfig, setSavedView, etc.
   - Redux-like reducer pattern or Zustand store

3. **`/src/lib/hooks/useLocalStoragePersistence.ts`** (150+ lines)
   - Generic hook for localStorage serialization/deserialization
   - Tracks: density, columnWidths, columnVisibility, columnOrder, savedViews
   - localStorage keys: `qrun-{tableName}-density`, `qrun-{tableName}-columns`, etc.

**Key implementation details:**

- **State machine flow:**
  ```
  initial
    → loading (loadTableMetaData via TanStack Query)
    → loaded (check permissions, detect variants, initialize filter/sort/pagination)
    → ready (render grid)
    OR error (display error message with retry button)
  ```

- **Metadata access:**
  ```typescript
  const { data: tableMetaData, isLoading, error } = useQuery({
    queryKey: queryKeys.tableMetaData(tableName),
    queryFn: () => loadTableMetaData(tableName),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  ```

- **Permission checks** (from tableMetaData):
  - `tableMetaData.insertPermission` → Show "Create" button
  - `tableMetaData.updatePermission` → Enable row click navigation
  - `tableMetaData.processPermission` → Show process launcher
  - `tableMetaData.deletePermission` → Show delete actions (later in Package 3)

- **Table variant selection:**
  - If `tableMetaData.usesVariants === true`, fetch variants and show selector
  - Default to first variant or user's last selected variant (from localStorage)
  - Pass `tableVariant` param to all /query and /count requests

- **Error handling:**
  - 401 Unauthorized → redirect to login (auth interceptor handles)
  - 403 Forbidden → display "Access Denied" message
  - 500 Server Error → display "Failed to load table" with retry button
  - Network timeout → exponential backoff (3 retries)

**API integration:**
- GET endpoint to retrieve QTableMetaData (via loadTableMetaData from Package 1)
- Response shape: QTableMetaData with fields[], processes[], permissions object
- Cache in TanStack Query with 5-minute staleTime

**Reference implementation:**
- Current RecordQuery.tsx state machine initialization (lines 1-60)
- Metadata loading pattern in useTableMetaData hook

---

### Step 2: API Query & Count Functions

**Objective:** Create reusable API client functions for /query and /count endpoints with TanStack Query integration.

**Files to create:**

1. **`/src/lib/api/query-service.ts`** (300+ lines)
   - Query function: `executeTableQuery(tableName, filter, joins?, tableVariant?, latestQueryId?)`
   - Count function: `countTableRecords(tableName, filter, joins?, tableVariant?)`
   - Deduplication helper: `createLatestQueryId()`
   - Request/response transformation

2. **`/src/lib/query-client.ts`** enhancement
   - Add queryKeys for table query: `queryKeys.tableQuery(tableName, filter, pageSize, pageNum)`
   - Add queryKeys for table count: `queryKeys.tableCount(tableName, filter)`
   - Add queryKeys for possible values: `queryKeys.possibleValues(tableName, fieldName)`

**Key implementation details:**

- **Query function signature:**
  ```typescript
  export async function executeTableQuery(
    tableName: string,
    filter: QQueryFilter,
    joins?: QJoin[],
    tableVariant?: string,
    latestQueryId?: string
  ): Promise<{ records: QRecord[]; latestQueryId: string }> {
    const payload = {
      filter,
      joins,
      tableVariant,
      latestQueryId,
    }
    const response = await apiClient.post(
      `/qqq/v1/table/${tableName}/query`,
      payload
    )
    // Discard response if latestQueryId doesn't match (stale result)
    return response.data
  }
  ```

- **Count function signature:**
  ```typescript
  export async function countTableRecords(
    tableName: string,
    filter: QQueryFilter,
    joins?: QJoin[],
    tableVariant?: string
  ): Promise<number> {
    const payload = { filter, joins, tableVariant }
    const response = await apiClient.post(
      `/qqq/v1/table/${tableName}/count`,
      payload
    )
    return response.data.count
  }
  ```

- **Query deduplication:**
  - Generate UUID on each query request: `latestQueryId = crypto.randomUUID()`
  - Pass to /query endpoint
  - Server returns latestQueryId in response
  - In reducer, only apply results if returned latestQueryId matches current latestQueryId
  - Prevents out-of-order results when user rapidly changes filters

- **TanStack Query integration:**
  ```typescript
  const queryResult = useQuery({
    queryKey: queryKeys.tableQuery(tableName, filter, pageSize, pageNum),
    queryFn: () => executeTableQuery(tableName, filter, undefined, tableVariant, latestQueryId),
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true, // Show old data while loading new
    enabled: !!tableMetaData, // Don't fetch until metadata loads
  })

  const countResult = useQuery({
    queryKey: queryKeys.tableCount(tableName, filter),
    queryFn: () => countTableRecords(tableName, filter, undefined, tableVariant),
    staleTime: 30 * 1000,
    keepPreviousData: true,
    enabled: !!tableMetaData,
  })
  ```

- **Error handling:**
  - Network error → Retry with exponential backoff (initial 500ms, max 10s)
  - 400 Bad Request → Display "Invalid filter" (validation error in UI)
  - 404 Not Found → Display "Table not found"
  - 500 Server Error → Retry once, then display "Server error"
  - Timeout (>30s) → Abort and show "Request timeout"

- **Request payload construction:**
  ```typescript
  interface QueryRequest {
    filter: QQueryFilter // Recursive filter with criteria, subFilters, booleanOperator
    joins?: Array<{
      joinTable: string
      select: string[]
      type: 'INNER' | 'LEFT' | 'RIGHT'
      baseTableOrAlias: string
      alias: string
      joinName?: string
    }>
    tableVariant?: string
  }
  ```

- **Response payload structure:**
  ```typescript
  interface QueryResponse {
    records: Array<{
      tableName: string
      recordLabel: string
      values: Record<string, any> // Raw values
      displayValues: Record<string, string> // Formatted for display
      errors?: string[]
      warnings?: string[]
    }>
    latestQueryId?: string // For deduplication
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx queryData state (lines 140-200)
- API integration pattern in useTableQuery hook

---

### Step 3: Data Grid Implementation with TanStack Table v8

**Objective:** Build the core data grid with dynamic columns, sorting, selection, and row navigation.

**Files to create:**

1. **`/src/components/RecordQuery/DataGrid.tsx`** (400+ lines)
   - TanStack Table v8 with useReactTable hook
   - Dynamic column definitions from tableMetaData.fields
   - Server-side pagination (manually controlled via state)
   - Multi-column sorting
   - Row selection (single/multi with checkbox column)
   - Cell rendering dispatch to field-specific renderers
   - Loading skeleton on data load
   - Empty state message

2. **`/src/components/RecordQuery/ColumnHeader.tsx`** (150+ lines)
   - Sortable header with visual indicator (↑ ↓)
   - Column visibility toggle context menu
   - Column width resize handle (for future enhancement)

3. **`/src/components/RecordQuery/DataCell.tsx`** (100+ lines)
   - Dispatcher component that renders appropriate cell type
   - Calls cell renderer based on field.type + field.adornmentType

4. **`/src/components/RecordQuery/RowSelectionCheckbox.tsx`** (80+ lines)
   - Checkbox with indeterminate state for "select all on current page"

**Key implementation details:**

- **Dynamic column definition generation:**
  ```typescript
  const columns: ColumnDef<QRecord>[] = useMemo(() => {
    return tableMetaData.fields
      .filter(field => !columnHidden[field.name])
      .sort((a, b) => (columnOrder[a.name] ?? 0) - (columnOrder[b.name] ?? 0))
      .map(field => ({
        id: field.name,
        header: ({ column }) => (
          <ColumnHeader
            field={field}
            column={column}
            onSort={(desc) => setSort([{ fieldName: field.name, isAscending: !desc }])}
          />
        ),
        cell: ({ row }) => (
          <DataCell
            field={field}
            value={row.original.values[field.name]}
            displayValue={row.original.displayValues[field.name]}
            record={row.original}
          />
        ),
        size: columnWidths[field.name] ?? 150,
      }))
  }, [tableMetaData, columnHidden, columnOrder, columnWidths])
  ```

- **Row selection setup:**
  ```typescript
  const table = useReactTable({
    data: records,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    enableMultiRowSelection: true,
    getRowCanBeSelected: () => updatePermission, // Only if user can update
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    // Manual pagination (server-side)
    manualPagination: true,
    rowCount: totalCount,
  })

  // Checkbox column definition (prepended)
  const selectColumn: ColumnDef<QRecord> = {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={table.getToggleAllRowsSelectedHandler()}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        aria-label={`Select ${row.original.recordLabel}`}
      />
    ),
  }
  ```

- **Row click navigation:**
  ```typescript
  const handleRowClick = (record: QRecord) => {
    if (updatePermission) {
      router.push(`/app/${tableName}/${record.id}`) // recordId from values or recordLabel
    }
  }

  <tbody>
    {table.getRowModel().rows.map(row => (
      <tr
        key={row.id}
        onClick={() => handleRowClick(row.original)}
        className={updatePermission ? 'cursor-pointer hover:bg-gray-50' : ''}
      >
        {row.getVisibleCells().map(cell => (
          <td key={cell.id} style={{ width: `${cell.column.getSize()}px` }}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
  ```

- **Sorting state management:**
  - Store in `sort: Array<{ fieldName: string; isAscending: boolean }>`
  - Pass to /query as `filter.orderBys`
  - Sync with URL query params for shareable filtered views (future)

- **Server-side pagination:**
  ```typescript
  const table = useReactTable({
    data: records,
    columns,
    manualPagination: true,
    getPaginationRowModel: getPaginationRowModel(),
    rowCount: totalCount,
    state: {
      pagination: {
        pageIndex: pageNum - 1,
        pageSize: pageSize,
      },
    },
    onPaginationChange: (updater) => {
      const newPagination = updater instanceof Function
        ? updater({ pageIndex: pageNum - 1, pageSize })
        : updater
      setPagination({
        pageNum: newPagination.pageIndex + 1,
        pageSize: newPagination.pageSize,
      })
    },
  })
  ```

- **Loading skeleton:**
  ```typescript
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array(pageSize).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }
  ```

- **Empty state:**
  ```typescript
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Icon name="inbox" className="h-12 w-12 text-gray-300" />
        <p className="mt-4 text-gray-500">No records found</p>
        <button onClick={() => setFilter(emptyFilter)} className="mt-2 text-blue-600">
          Clear filters
        </button>
      </div>
    )
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx DataGrid component (lines 350-550)
- TanStack Table v8 documentation: https://tanstack.com/table/v8/docs/framework/react/start/examples

---

### Step 4: Filter Components - Basic & Advanced

**Objective:** Implement filter UI with quick-search mode and full filter builder for advanced queries.

**Files to create:**

1. **`/src/components/RecordQuery/FilterBar.tsx`** (250+ lines)
   - Toggle between basic and advanced filter modes
   - Basic mode: Text input, debounced search across visible columns
   - Advanced mode: Full filter builder with visual editor
   - Clear filters button
   - Save/load view integration

2. **`/src/components/RecordQuery/BasicFilter.tsx`** (120+ lines)
   - Single text input with debounce (400ms)
   - Generates `QQueryFilter` with CONTAINS operator across all visible string fields
   - Shows active filter count badge

3. **`/src/components/RecordQuery/AdvancedFilterBuilder.tsx`** (500+ lines)
   - Recursive filter group editor
   - Boolean operator selector (AND / OR)
   - Add/remove criteria buttons
   - Add/remove sub-filter buttons
   - Criteria component for each filter row

4. **`/src/components/RecordQuery/FilterCriteria.tsx`** (400+ lines)
   - Field selector dropdown (auto-complete)
   - Operator selector (20 operators, context-sensitive based on field type)
   - Value input(s) with type-appropriate UI
   - Expression type selector (FilterVariableExpression, NowExpression, etc.)

5. **`/src/components/RecordQuery/FilterSubGroup.tsx`** (150+ lines)
   - Nested filter group with visual indentation
   - Drag-to-reorder sub-filters (optional for v1)

**Key implementation details:**

- **Basic filter logic:**
  ```typescript
  const generateBasicFilter = (searchTerm: string): QQueryFilter => {
    if (!searchTerm.trim()) return emptyFilter()

    const visibleStringFields = tableMetaData.fields
      .filter(f => !columnHidden[f.name] && isStringType(f.type))

    return {
      criteria: visibleStringFields.map(field => ({
        fieldName: field.name,
        operator: 'CONTAINS',
        values: [searchTerm],
      })),
      booleanOperator: 'OR',
      subFilters: [],
    }
  }
  ```

- **All 20 QCriteriaOperator values with descriptions:**
  ```typescript
  const OPERATOR_CONFIG: Record<QCriteriaOperator, {
    label: string
    valueCount: 'single' | 'multiple' | 'range' | 'expression' | 'none'
    applicableTypes: QFieldType[]
    description: string
  }> = {
    EQUALS: {
      label: 'Equals',
      valueCount: 'single',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Exact match',
    },
    NOT_EQUALS: {
      label: 'Not equals',
      valueCount: 'single',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Excludes exact match',
    },
    NOT_EQUALS_OR_IS_NULL: {
      label: 'Not equals or is null',
      valueCount: 'single',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Excludes match or is empty',
    },
    IN: {
      label: 'In',
      valueCount: 'multiple',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'One of multiple values',
    },
    NOT_IN: {
      label: 'Not in',
      valueCount: 'multiple',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'None of multiple values',
    },
    STARTS_WITH: {
      label: 'Starts with',
      valueCount: 'single',
      applicableTypes: ['STRING', 'TEXT', 'HTML'],
      description: 'String begins with value',
    },
    ENDS_WITH: {
      label: 'Ends with',
      valueCount: 'single',
      applicableTypes: ['STRING', 'TEXT', 'HTML'],
      description: 'String ends with value',
    },
    CONTAINS: {
      label: 'Contains',
      valueCount: 'single',
      applicableTypes: ['STRING', 'TEXT', 'HTML'],
      description: 'String contains value',
    },
    NOT_STARTS_WITH: {
      label: 'Not starts with',
      valueCount: 'single',
      applicableTypes: ['STRING', 'TEXT', 'HTML'],
      description: 'String does not begin with value',
    },
    NOT_ENDS_WITH: {
      label: 'Not ends with',
      valueCount: 'single',
      applicableTypes: ['STRING', 'TEXT', 'HTML'],
      description: 'String does not end with value',
    },
    NOT_CONTAINS: {
      label: 'Not contains',
      valueCount: 'single',
      applicableTypes: ['STRING', 'TEXT', 'HTML'],
      description: 'String does not contain value',
    },
    LESS_THAN: {
      label: 'Less than',
      valueCount: 'single',
      applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Value is less than',
    },
    LESS_THAN_OR_EQUALS: {
      label: 'Less than or equals',
      valueCount: 'single',
      applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Value is less than or equal',
    },
    GREATER_THAN: {
      label: 'Greater than',
      valueCount: 'single',
      applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Value is greater than',
    },
    GREATER_THAN_OR_EQUALS: {
      label: 'Greater than or equals',
      valueCount: 'single',
      applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Value is greater than or equal',
    },
    IS_BLANK: {
      label: 'Is blank',
      valueCount: 'none',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME', 'TEXT', 'HTML'],
      description: 'Field is empty',
    },
    IS_NOT_BLANK: {
      label: 'Is not blank',
      valueCount: 'none',
      applicableTypes: ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME', 'TEXT', 'HTML'],
      description: 'Field is not empty',
    },
    BETWEEN: {
      label: 'Between',
      valueCount: 'range',
      applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Value is between two values (inclusive)',
    },
    NOT_BETWEEN: {
      label: 'Not between',
      valueCount: 'range',
      applicableTypes: ['INTEGER', 'LONG', 'DECIMAL', 'DATE', 'TIME', 'DATE_TIME'],
      description: 'Value is not between two values',
    },
  }
  ```

- **Expression types (for advanced filter):**
  ```typescript
  type FilterExpression =
    | { type: 'FilterVariableExpression'; value: any } // Literal value
    | { type: 'NowExpression' } // Current datetime
    | { type: 'NowWithOffsetExpression'; offset: string } // e.g., "-1 DAY"
    | { type: 'ThisOrLastPeriodExpression'; period: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' }

  // In FilterCriteria component:
  const [expressionType, setExpressionType] = useState<'literal' | 'now' | 'nowWithOffset' | 'period'>('literal')
  ```

- **Field selector with auto-complete:**
  ```typescript
  <Combobox
    options={tableMetaData.fields.map(f => ({
      value: f.name,
      label: f.label || f.name,
    }))}
    onValueChange={setFieldName}
    value={fieldName}
  />
  ```

- **Value input with type-specific UI:**
  ```typescript
  const renderValueInput = (field: QFieldMetaData, operator: QCriteriaOperator) => {
    if (operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK') {
      return null // No input needed
    }

    if (operator === 'IN' || operator === 'NOT_IN') {
      return <TagInput values={values} onChange={setValues} /> // Multiple values
    }

    if (operator === 'BETWEEN' || operator === 'NOT_BETWEEN') {
      return (
        <>
          <Input value={values[0]} onChange={e => setValues([e.target.value, values[1]])} />
          <span>and</span>
          <Input value={values[1]} onChange={e => setValues([values[0], e.target.value])} />
        </>
      ) // Range
    }

    if (field.type === 'INTEGER' || field.type === 'LONG') {
      return <Input type="number" value={values[0]} onChange={e => setValues([e.target.value])} />
    }

    if (field.type === 'DATE' || field.type === 'DATE_TIME') {
      return <DatePicker value={values[0]} onChange={v => setValues([v])} />
    }

    if (field.type === 'BOOLEAN') {
      return (
        <Select value={values[0]} onValueChange={v => setValues([v])}>
          <option value="true">True</option>
          <option value="false">False</option>
        </Select>
      )
    }

    // String/Text/HTML
    return <Input value={values[0]} onChange={e => setValues([e.target.value])} />
  }
  ```

- **Recursive filter group structure:**
  ```typescript
  interface QQueryFilter {
    criteria: QFilterCriteria[]
    booleanOperator: 'AND' | 'OR'
    subFilters: QQueryFilter[]
  }

  interface QFilterCriteria {
    fieldName: string
    operator: QCriteriaOperator
    values: any[] // Can be empty for IS_BLANK, one for EQUALS, two for BETWEEN, many for IN
    expression?: FilterExpression
  }

  // In AdvancedFilterBuilder:
  const addSubFilter = (parentPath: number[]) => {
    // Create nested filter at path: filter.subFilters[parentPath[0]].subFilters[parentPath[1]]...
  }

  const removeSubFilter = (parentPath: number[], index: number) => {
    // Remove from parent's subFilters array
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx FilterBuilder component (lines 700-900)
- Operator configuration in qfmd-current-recordquery.tsx

---

### Step 5: Filter Operators & Possible Values Integration

**Objective:** Implement value input dropdowns using /possibleValues API for reference fields.

**Files to create:**

1. **`/src/lib/api/lookup-service.ts`** (150+ lines)
   - Function: `fetchPossibleValues(tableName, fieldName, searchTerm?, ids?, useCase?)`
   - TanStack Query integration with debounced search

2. **`/src/components/RecordQuery/ValueInput.tsx`** (200+ lines)
   - Component that determines value input type based on field metadata
   - For reference fields, fetch and display possible values
   - Support single select, multi-select, searchable combobox

**Key implementation details:**

- **Possible values function:**
  ```typescript
  export async function fetchPossibleValues(
    tableName: string,
    fieldName: string,
    searchTerm?: string,
    ids?: string[],
    useCase?: string
  ): Promise<Array<{ id: string | number; label: string }>> {
    const response = await apiClient.post(
      `/qqq/v1/table/${tableName}/possibleValues/${fieldName}`,
      { searchTerm, ids, useCase }
    )
    return response.data
  }

  // TanStack Query hook:
  export function usePossibleValues(
    tableName: string,
    fieldName: string,
    searchTerm?: string,
    enabled: boolean = true
  ) {
    return useQuery({
      queryKey: queryKeys.possibleValues(tableName, fieldName, searchTerm),
      queryFn: () => fetchPossibleValues(tableName, fieldName, searchTerm),
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: enabled && !!searchTerm,
      keepPreviousData: true,
    })
  }
  ```

- **ValueInput component:**
  ```typescript
  interface ValueInputProps {
    field: QFieldMetaData
    operator: QCriteriaOperator
    values: any[]
    onValuesChange: (values: any[]) => void
  }

  export function ValueInput({
    field,
    operator,
    values,
    onValuesChange,
  }: ValueInputProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const { data: possibleValues = [], isLoading } = usePossibleValues(
      field.referencedTable,
      field.name,
      searchTerm,
      field.adornmentType === 'LINK' // Only if it's a reference field
    )

    // For reference fields with LINK adornment:
    if (field.adornmentType === 'LINK') {
      if (operator === 'IN' || operator === 'NOT_IN') {
        return (
          <MultiSelect
            options={possibleValues}
            values={values}
            onChange={onValuesChange}
            onSearch={setSearchTerm}
            isLoading={isLoading}
            searchTerm={searchTerm}
          />
        )
      } else {
        return (
          <Combobox
            options={possibleValues}
            value={values[0]}
            onChange={v => onValuesChange([v])}
            onSearch={setSearchTerm}
            isLoading={isLoading}
          />
        )
      }
    }

    // For non-reference fields:
    return <StandardValueInput field={field} operator={operator} values={values} onValuesChange={onValuesChange} />
  }
  ```

- **Smart value input based on field type:**
  ```typescript
  function StandardValueInput({ field, operator, values, onValuesChange }) {
    if (operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK') {
      return null
    }

    switch (field.type) {
      case 'BOOLEAN':
        return (
          <Select value={values[0] ?? ''} onValueChange={v => onValuesChange([v])}>
            <option value="">Select...</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </Select>
        )

      case 'DATE':
        if (operator === 'BETWEEN' || operator === 'NOT_BETWEEN') {
          return (
            <div className="flex gap-2">
              <DatePicker value={values[0]} onChange={v => onValuesChange([v, values[1]])} />
              <DatePicker value={values[1]} onChange={v => onValuesChange([values[0], v])} />
            </div>
          )
        }
        return <DatePicker value={values[0]} onChange={v => onValuesChange([v])} />

      case 'DATE_TIME':
        return <DateTimePicker value={values[0]} onChange={v => onValuesChange([v])} />

      case 'TIME':
        return <TimePicker value={values[0]} onChange={v => onValuesChange([v])} />

      case 'INTEGER':
      case 'LONG':
      case 'DECIMAL':
        if (operator === 'BETWEEN' || operator === 'NOT_BETWEEN') {
          return (
            <div className="flex gap-2">
              <Input type="number" value={values[0] ?? ''} onChange={e => onValuesChange([e.target.value, values[1]])} />
              <Input type="number" value={values[1] ?? ''} onChange={e => onValuesChange([values[0], e.target.value])} />
            </div>
          )
        }
        if (operator === 'IN' || operator === 'NOT_IN') {
          return <TagInput type="number" values={values} onChange={onValuesChange} />
        }
        return <Input type="number" value={values[0] ?? ''} onChange={e => onValuesChange([e.target.value])} />

      default: // STRING, TEXT, HTML
        if (operator === 'IN' || operator === 'NOT_IN') {
          return <TagInput values={values} onChange={onValuesChange} />
        }
        return <Input value={values[0] ?? ''} onChange={e => onValuesChange([e.target.value])} />
    }
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx PossibleValuesInput component (lines 1100-1200)

---

### Step 6: Pagination Controls

**Objective:** Build pagination UI and logic for server-side offset/limit pagination.

**Files to create:**

1. **`/src/components/RecordQuery/PaginationControls.tsx`** (200+ lines)
   - Page size selector (10, 25, 50, 100 options)
   - Previous/Next buttons
   - Page number display
   - "Go to page" input
   - Total record count display
   - Records per page indicator

**Key implementation details:**

- **Pagination state structure:**
  ```typescript
  interface PaginationState {
    pageNum: number // 1-indexed
    pageSize: number // 10, 25, 50, or 100
  }
  ```

- **Offset calculation:**
  ```typescript
  const skip = (pageNum - 1) * pageSize
  // Pass to /query endpoint
  ```

- **Total pages calculation:**
  ```typescript
  const totalPages = Math.ceil(totalCount / pageSize)
  ```

- **Component JSX structure:**
  ```typescript
  <div className="flex items-center justify-between gap-4 p-4 border-t">
    {/* Left: Record count info */}
    <div className="text-sm text-gray-600">
      Showing {(pageNum - 1) * pageSize + 1} to {Math.min(pageNum * pageSize, totalCount)}
      of {totalCount} records
    </div>

    {/* Center: Pagination buttons */}
    <div className="flex items-center gap-2">
      <Button
        onClick={() => handlePageChange(pageNum - 1)}
        disabled={pageNum === 1}
        variant="outline"
        size="sm"
      >
        Previous
      </Button>

      <Input
        type="number"
        value={pageNum}
        onChange={e => handlePageChange(parseInt(e.target.value))}
        min="1"
        max={totalPages}
        className="w-16 text-center"
      />

      <span className="text-sm">of {totalPages}</span>

      <Button
        onClick={() => handlePageChange(pageNum + 1)}
        disabled={pageNum === totalPages}
        variant="outline"
        size="sm"
      >
        Next
      </Button>
    </div>

    {/* Right: Page size selector */}
    <Select value={pageSize} onValueChange={v => handlePageSizeChange(parseInt(v))}>
      <option value="10">10 per page</option>
      <option value="25">25 per page</option>
      <option value="50">50 per page</option>
      <option value="100">100 per page</option>
    </Select>
  </div>
  ```

- **Page change handlers:**
  ```typescript
  const handlePageChange = (newPageNum: number) => {
    const maxPage = Math.ceil(totalCount / pageSize)
    if (newPageNum >= 1 && newPageNum <= maxPage) {
      setPagination({ pageNum: newPageNum, pageSize })
      // Trigger query refetch with new skip/limit
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    // Reset to page 1 when changing page size
    setPagination({ pageNum: 1, pageSize: newPageSize })
    // Store preference in localStorage
    localStorage.setItem(`qrun-${tableName}-pageSize`, newPageSize.toString())
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx PaginationBar component (lines 1250-1350)

---

### Step 7: Toolbar Components

**Objective:** Build toolbar with create button, process launcher, column config toggle, density control, and saved views menu.

**Files to create:**

1. **`/src/components/RecordQuery/Toolbar.tsx`** (300+ lines)
   - Create button (conditional on insertPermission)
   - Process launcher dropdown (conditional on processPermission)
   - Column configuration toggle button
   - Density selector (compact/standard/comfortable)
   - Saved views dropdown menu
   - Filter mode toggle (basic/advanced)

2. **`/src/components/RecordQuery/ProcessLauncher.tsx`** (200+ lines)
   - Dropdown menu with available processes for table
   - Process selection → open modal or navigate to process execution page

3. **`/src/components/RecordQuery/DensitySelector.tsx`** (100+ lines)
   - Radio group for compact/standard/comfortable
   - Persist selection to localStorage
   - Apply CSS classes to DataGrid

**Key implementation details:**

- **Toolbar JSX structure:**
  ```typescript
  <div className="flex items-center justify-between gap-2 p-4 border-b bg-gray-50">
    {/* Left group: Actions */}
    <div className="flex items-center gap-2">
      {insertPermission && (
        <Button
          onClick={() => router.push(`/app/${tableName}/new`)}
          variant="default"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Create
        </Button>
      )}

      {tableMetaData.processes && tableMetaData.processes.length > 0 && (
        <ProcessLauncher
          processes={tableMetaData.processes}
          selectedRecordIds={Object.keys(rowSelection).filter(k => rowSelection[k])}
          tableName={tableName}
        />
      )}
    </div>

    {/* Center group: View controls */}
    <div className="flex items-center gap-2">
      <Button
        onClick={() => setShowColumnConfig(!showColumnConfig)}
        variant="outline"
        size="sm"
      >
        <SettingsIcon className="w-4 h-4" />
      </Button>

      <DensitySelector value={density} onChange={setDensity} />

      <SavedViewsMenu
        savedViews={savedViews}
        onLoadView={handleLoadView}
        onSaveView={handleSaveView}
        onDeleteView={handleDeleteView}
      />
    </div>

    {/* Right group: Filter mode */}
    <div className="flex items-center gap-2">
      <Button
        onClick={() => setFilterMode(filterMode === 'basic' ? 'advanced' : 'basic')}
        variant={filterMode === 'advanced' ? 'default' : 'outline'}
        size="sm"
      >
        {filterMode === 'basic' ? 'Advanced' : 'Basic'}
      </Button>
    </div>
  </div>
  ```

- **Create button action:**
  ```typescript
  const handleCreate = () => {
    router.push(`/app/${tableName}/new`) // Package 3: Record View
  }
  ```

- **Density control:**
  ```typescript
  type DensityType = 'compact' | 'standard' | 'comfortable'

  const DENSITY_CLASSES = {
    compact: 'text-xs px-2 py-1', // Row height ~32px
    standard: 'text-sm px-3 py-2', // Row height ~40px
    comfortable: 'text-base px-4 py-3', // Row height ~48px
  }

  const handleDensityChange = (newDensity: DensityType) => {
    setDensity(newDensity)
    localStorage.setItem(`qrun-${tableName}-density`, newDensity)
  }
  ```

- **Process launcher integration:**
  ```typescript
  const handleProcessLaunch = (processName: string) => {
    const selectedIds = Object.keys(rowSelection)
      .filter(k => rowSelection[k])
      .map(k => records[parseInt(k)].id)

    // Package 4: Process Execution
    router.push(`/app/${tableName}/process/${processName}?selectedIds=${selectedIds.join(',')}`)
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx Toolbar component (lines 550-650)

---

### Step 8: Column Configuration Panel

**Objective:** Implement UI for showing/hiding columns, reordering, and persisting configuration.

**Files to create:**

1. **`/src/components/RecordQuery/ColumnConfigPanel.tsx`** (300+ lines)
   - List of all columns with visibility checkboxes
   - Drag-to-reorder (react-beautiful-dnd or native HTML5 drag-drop)
   - Reset to defaults button
   - Column width slider (optional for v1)
   - Persist to localStorage

2. **`/src/components/RecordQuery/ColumnConfigItem.tsx`** (100+ lines)
   - Individual column row with checkbox, drag handle, label

**Key implementation details:**

- **Column config state:**
  ```typescript
  interface ColumnConfig {
    [fieldName: string]: {
      visible: boolean
      order: number
      width: number // pixels
    }
  }
  ```

- **localStorage persistence:**
  ```typescript
  const loadColumnConfig = (tableName: string): ColumnConfig => {
    const stored = localStorage.getItem(`qrun-${tableName}-columnConfig`)
    return stored ? JSON.parse(stored) : getDefaultColumnConfig()
  }

  const saveColumnConfig = (tableName: string, config: ColumnConfig) => {
    localStorage.setItem(`qrun-${tableName}-columnConfig`, JSON.stringify(config))
  }

  const getDefaultColumnConfig = (): ColumnConfig => {
    const config: ColumnConfig = {}
    tableMetaData.fields.forEach((field, idx) => {
      config[field.name] = {
        visible: true,
        order: idx,
        width: 150,
      }
    })
    return config
  }
  ```

- **Column config panel JSX:**
  ```typescript
  <div className="bg-white rounded-lg border p-4 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold">Column Configuration</h3>
      <Button
        onClick={handleResetToDefaults}
        variant="outline"
        size="sm"
      >
        Reset
      </Button>
    </div>

    <div className="space-y-2 max-h-96 overflow-y-auto">
      {tableMetaData.fields.map((field, idx) => (
        <ColumnConfigItem
          key={field.name}
          field={field}
          visible={columnConfig[field.name]?.visible ?? true}
          onVisibilityChange={visible => handleVisibilityChange(field.name, visible)}
          draggable
          onDragStart={() => setDraggedField(field.name)}
          onDrop={() => handleReorder(field.name)}
        />
      ))}
    </div>

    <Button onClick={handleSaveConfig} className="w-full">
      Apply Changes
    </Button>
  </div>
  ```

- **Drag-and-drop reordering (using native HTML5):**
  ```typescript
  const handleDragStart = (e: React.DragEvent, fieldName: string) => {
    setDraggedField(fieldName)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetFieldName: string) => {
    e.preventDefault()
    if (!draggedField) return

    const newColumnConfig = { ...columnConfig }
    const draggedOrder = newColumnConfig[draggedField]?.order ?? 0
    const targetOrder = newColumnConfig[targetFieldName]?.order ?? 0

    // Swap order values
    newColumnConfig[draggedField].order = targetOrder
    newColumnConfig[targetFieldName].order = draggedOrder

    handleSaveConfig(newColumnConfig)
    setDraggedField(null)
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx ColumnConfigPanel component (lines 1400-1550)

---

### Step 9: Responsive Design

**Objective:** Ensure grid, filters, and toolbar work on mobile and tablet screens.

**Key implementation details:**

- **Breakpoint strategy:**
  - **Mobile (< 640px):** Single column layout, filters in modal, grid horizontal scroll
  - **Tablet (640px - 1024px):** Two-column layout for filter + grid side-by-side
  - **Desktop (> 1024px):** Three-column: filter panel + grid + detail panel (future)

- **DataGrid responsiveness:**
  ```typescript
  const gridContainer = (
    <div className="overflow-x-auto md:overflow-hidden">
      {/* Use TanStack Table's built-in responsive column sizing */}
      <table className="w-full text-sm">
        {/* Headers and rows */}
      </table>
    </div>
  )
  ```

- **Filter panel responsiveness:**
  ```typescript
  const filterPanel = (
    <>
      {/* Mobile: Filter in modal triggered by button */}
      <div className="md:hidden">
        <Button onClick={() => setShowFilter(true)}>Filters</Button>
        <Dialog open={showFilter} onOpenChange={setShowFilter}>
          <FilterBar {...props} />
        </Dialog>
      </div>

      {/* Tablet+: Filter in sidebar */}
      <div className="hidden md:block w-64 border-r p-4">
        <FilterBar {...props} />
      </div>
    </>
  )
  ```

- **Toolbar button grouping on mobile:**
  ```typescript
  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
    {/* Actions collapse to icon-only on small screens */}
    <Button className="hidden sm:flex" variant="default">
      <PlusIcon className="w-4 h-4 mr-2" />
      Create
    </Button>
    <Button className="sm:hidden p-2" variant="default" title="Create">
      <PlusIcon className="w-4 h-4" />
    </Button>
  </div>
  ```

- **Pagination controls on mobile:**
  ```typescript
  <div className="flex flex-col sm:flex-row gap-2 text-xs sm:text-sm">
    {/* Stack vertically on mobile, horizontally on desktop */}
    <span>Page {pageNum}</span>
    <Select value={pageSize} onValueChange={handlePageSizeChange}>
      <option value="10">10</option>
      <option value="25">25</option>
    </Select>
  </div>
  ```

**Testing approach:**
- Chrome DevTools device emulation
- Test at 320px, 768px, 1024px, 1440px breakpoints
- Verify touch targets are ≥ 44px × 44px

---

### Step 10: Saved Views

**Objective:** Implement save/load/delete functionality for filter + column + sort configurations.

**Files to create:**

1. **`/src/lib/hooks/useSavedViews.ts`** (250+ lines)
   - Custom hook managing saved views state
   - Save view: capture current filter, columnConfig, sort
   - Load view: apply filter, columnConfig, sort
   - Delete view: remove from storage
   - localStorage vs process-backed storage

2. **`/src/components/RecordQuery/SavedViewsMenu.tsx`** (200+ lines)
   - Dropdown menu of saved views
   - "Save current view as..." button with name input
   - Load/Delete buttons per view

**Key implementation details:**

- **Saved view structure:**
  ```typescript
  interface SavedView {
    id: string // UUID
    name: string
    tableName: string
    createdAt: Date
    filter: QQueryFilter
    columnConfig: ColumnConfig
    sort: Array<{ fieldName: string; isAscending: boolean }>
    pageSize: number
    tableVariant?: string
  }
  ```

- **localStorage persistence:**
  ```typescript
  const savView = (tableName: string, viewName: string, state: PageState) => {
    const views: SavedView[] = JSON.parse(
      localStorage.getItem(`qrun-${tableName}-savedViews`) || '[]'
    )

    const newView: SavedView = {
      id: crypto.randomUUID(),
      name: viewName,
      tableName,
      createdAt: new Date(),
      filter: state.filter,
      columnConfig: state.columnConfig,
      sort: state.sort,
      pageSize: state.pagination.pageSize,
      tableVariant: state.tableVariant,
    }

    views.push(newView)
    localStorage.setItem(`qrun-${tableName}-savedViews`, JSON.stringify(views))
    return newView
  }

  const loadView = (tableName: string, viewId: string): SavedView | null => {
    const views: SavedView[] = JSON.parse(
      localStorage.getItem(`qrun-${tableName}-savedViews`) || '[]'
    )
    return views.find(v => v.id === viewId) || null
  }

  const deleteView = (tableName: string, viewId: string) => {
    const views: SavedView[] = JSON.parse(
      localStorage.getItem(`qrun-${tableName}-savedViews`) || '[]'
    )
    const filtered = views.filter(v => v.id !== viewId)
    localStorage.setItem(`qrun-${tableName}-savedViews`, JSON.stringify(filtered))
  }
  ```

- **SavedViewsMenu JSX:**
  ```typescript
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <BookmarkIcon className="w-4 h-4 mr-2" />
        Views
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
      <DropdownMenuSeparator />

      {savedViews.length === 0 ? (
        <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
      ) : (
        savedViews.map(view => (
          <div key={view.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100">
            <button
              onClick={() => onLoadView(view.id)}
              className="flex-1 text-left text-sm"
            >
              {view.name}
            </button>
            <button
              onClick={() => onDeleteView(view.id)}
              title="Delete view"
              className="text-gray-400 hover:text-red-600"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))
      )}

      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
        Save current view...
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  {/* Save view dialog */}
  <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Save Current View</DialogTitle>
      </DialogHeader>
      <Input
        placeholder="View name (e.g., 'High Priority')"
        value={viewName}
        onChange={e => setViewName(e.target.value)}
      />
      <DialogFooter>
        <Button onClick={() => onSaveView(viewName)}>Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  ```

**Reference implementation:**
- Current RecordQuery.tsx SavedViewsMenu component (lines 1600-1700)

---

### Step 11: Export Functionality

**Objective:** Implement CSV export of filtered/sorted grid data.

**Files to create:**

1. **`/src/lib/utils/csv-export.ts`** (200+ lines)
   - Function: `exportToCSV(records, fields, filename)`
   - Handles special characters, escaping, encoding

2. **`/src/components/RecordQuery/ExportDropdown.tsx`** (150+ lines)
   - Dropdown menu with export format options
   - CSV export button
   - (Future: Excel, PDF options)

**Key implementation details:**

- **CSV export function:**
  ```typescript
  export function exportToCSV(
    records: QRecord[],
    fields: QFieldMetaData[],
    filename: string = 'export.csv'
  ) {
    // Build CSV header
    const headers = fields.map(f => `"${(f.label || f.name).replace(/"/g, '""')}"`).join(',')

    // Build CSV rows
    const rows = records.map(record =>
      fields
        .map(f => {
          const value = record.displayValues[f.name] ?? ''
          // Escape quotes and wrap in quotes if contains comma/newline
          if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(',')
    )

    const csv = [headers, ...rows].join('\n')

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  ```

- **Export dropdown in toolbar:**
  ```typescript
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <DownloadIcon className="w-4 h-4 mr-2" />
        Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => exportToCSV(records, tableMetaData.fields, `${tableName}_${new Date().toISOString()}.csv`)}>
        Export as CSV
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        Export as Excel (coming soon)
      </DropdownMenuItem>
      <DropdownMenuItem disabled>
        Export as PDF (coming soon)
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  ```

**Reference implementation:**
- Current RecordQuery.tsx ExportMenu component (lines 1750-1800)

---

### Step 12: Cell Renderers (120+ combinations)

**Objective:** Implement specialized renderers for each field type × adornment type combination.

**Files to create:**

1. **`/src/components/RecordQuery/CellRenderers/index.ts`** (50+ lines)
   - Export all renderer functions
   - Dispatcher function based on field.type and field.adornmentType

2. **`/src/components/RecordQuery/CellRenderers/StringRenderers.tsx`** (300+ lines)
   - LINK adornment: `<a href>` navigation
   - CHIP adornment: pill-shaped badge
   - TOOLTIP adornment: hover popup
   - REVEAL adornment: expandable/password masking
   - CODE_EDITOR adornment: syntax-highlighted code block
   - Default STRING: plain text truncation

3. **`/src/components/RecordQuery/CellRenderers/NumericRenderers.tsx`** (150+ lines)
   - SIZE adornment: human-readable file sizes (KB, MB, GB)
   - Default INTEGER/LONG/DECIMAL: formatted number (1000 separator)

4. **`/src/components/RecordQuery/CellRenderers/BooleanRenderer.tsx`** (80+ lines)
   - Checkbox display or Yes/No text

5. **`/src/components/RecordQuery/CellRenderers/DateTimeRenderers.tsx`** (150+ lines)
   - DATE: formatted date string
   - TIME: formatted time string
   - DATE_TIME: formatted datetime string
   - Timezone handling (if provided in metadata)

6. **`/src/components/RecordQuery/CellRenderers/HTMLRenderer.tsx`** (100+ lines)
   - RENDER_HTML adornment: sanitized HTML rendering (DOMPurify)
   - Default HTML: plain text or escaped

7. **`/src/components/RecordQuery/CellRenderers/BlobRenderer.tsx`** (120+ lines)
   - FILE_DOWNLOAD adornment: download button
   - FILE_UPLOAD adornment: file input (Package 3)
   - Default BLOB: file icon + size

**Key implementation details:**

- **Renderer dispatcher:**
  ```typescript
  export function getCellRenderer(field: QFieldMetaData) {
    switch (field.type) {
      case 'STRING':
        switch (field.adornmentType) {
          case 'LINK':
            return StringLinkRenderer
          case 'CHIP':
            return StringChipRenderer
          case 'REVEAL':
            return StringRevealRenderer
          case 'TOOLTIP':
            return StringTooltipRenderer
          case 'CODE_EDITOR':
            return CodeEditorRenderer
          default:
            return StringDefaultRenderer
        }

      case 'INTEGER':
      case 'LONG':
      case 'DECIMAL':
        if (field.adornmentType === 'SIZE') {
          return SizeRenderer
        }
        return NumericDefaultRenderer

      case 'BOOLEAN':
        return BooleanRenderer

      case 'DATE':
      case 'TIME':
      case 'DATE_TIME':
        return DateTimeRenderer

      case 'HTML':
        if (field.adornmentType === 'RENDER_HTML') {
          return HTMLRenderer
        }
        return StringDefaultRenderer

      case 'BLOB':
        switch (field.adornmentType) {
          case 'FILE_DOWNLOAD':
            return FileDownloadRenderer
          case 'FILE_UPLOAD':
            return FileUploadRenderer
          default:
            return BlobDefaultRenderer
        }

      case 'PASSWORD':
        return PasswordRenderer

      case 'TEXT':
        return TextRenderer // Multi-line truncation

      default:
        return StringDefaultRenderer
    }
  }
  ```

- **String LINK renderer:**
  ```typescript
  interface StringLinkRendererProps {
    value: string
    field: QFieldMetaData
    record: QRecord
  }

  export function StringLinkRenderer({ value, field, record }: StringLinkRendererProps) {
    const href = field.referencedTable
      ? `/app/${field.referencedTable}/${value}`
      : value // Assume URL if no referencedTable

    return (
      <a href={href} className="text-blue-600 hover:underline truncate">
        {record.displayValues[field.name] || value}
      </a>
    )
  }
  ```

- **STRING CHIP renderer:**
  ```typescript
  export function StringChipRenderer({ value, field, record }: StringLinkRendererProps) {
    return (
      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full">
        {record.displayValues[field.name] || value}
      </span>
    )
  }
  ```

- **REVEAL renderer (e.g., for PASSWORD fields):**
  ```typescript
  export function StringRevealRenderer({ value, field, record }: StringLinkRendererProps) {
    const [revealed, setRevealed] = useState(false)

    return (
      <div className="flex items-center gap-2">
        <span>{revealed ? (record.displayValues[field.name] || value) : '••••••••'}</span>
        <button onClick={() => setRevealed(!revealed)} className="text-xs text-gray-500">
          {revealed ? 'Hide' : 'Show'}
        </button>
      </div>
    )
  }
  ```

- **SIZE renderer:**
  ```typescript
  export function SizeRenderer({ value }: { value: number }) {
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
    }

    return <span>{formatBytes(value)}</span>
  }
  ```

- **Boolean renderer:**
  ```typescript
  export function BooleanRenderer({ value }: { value: boolean | string }) {
    const isTrue = value === true || value === 'true'

    return (
      <div className="flex items-center">
        {isTrue ? (
          <CheckIcon className="w-5 h-5 text-green-600" />
        ) : (
          <XIcon className="w-5 h-5 text-gray-400" />
        )}
      </div>
    )
  }
  ```

- **Date/Time renderer:**
  ```typescript
  export function DateTimeRenderer({ value, field }: { value: string; field: QFieldMetaData }) {
    if (!value) return <span className="text-gray-400">—</span>

    const date = new Date(value)
    let formatted = ''

    if (field.type === 'DATE') {
      formatted = date.toLocaleDateString()
    } else if (field.type === 'TIME') {
      formatted = date.toLocaleTimeString()
    } else {
      formatted = date.toLocaleString()
    }

    return <span>{formatted}</span>
  }
  ```

- **HTML renderer (with DOMPurify):**
  ```typescript
  import DOMPurify from 'dompurify'

  export function HTMLRenderer({ value }: { value: string }) {
    const clean = DOMPurify.sanitize(value)

    return (
      <div
        dangerouslySetInnerHTML={{ __html: clean }}
        className="prose prose-sm max-w-none"
      />
    )
  }
  ```

**Reference implementation:**
- Current RecordQuery.tsx renderer dispatch (lines 1900-2100)

---

## 6. Component Specifications

### RecordQueryPage (Main Page Component)

**File:** `/src/app/(dashboard)/app/[tableName]/page.tsx`

**Props Interface:**
```typescript
interface RecordQueryPageProps {
  params: {
    tableName: string
  }
}
```

**Behavior:**
- **Loading State:** Show skeleton loaders for grid, filter, and toolbar while metadata loads
- **Empty State:** Display "No records found" message with option to clear filters
- **Error State:** Display error message with retry button and error details (in accordion)
- **Populated State:** Show full grid with filters, toolbar, pagination
- **Permission-based UI:**
  - Hide "Create" button if !insertPermission
  - Hide process launcher if !processPermission
  - Disable row click if !updatePermission
  - Show read-only UI if !updatePermission and !deletePermission

**Metadata-driven Aspects:**
- Dynamic column generation from tableMetaData.fields
- Dynamic process launcher from tableMetaData.processes
- Permission checks from tableMetaData (insertPermission, updatePermission, deletePermission, processPermission)
- Table variant support if tableMetaData.usesVariants

**Responsive Behavior:**
- **Mobile:** Filter in modal, grid horizontal scroll, toolbar buttons icon-only
- **Tablet:** Filter sidebar + grid side-by-side
- **Desktop:** Expanded layout with filter panel, grid, and detail panel (future)

---

### DataGrid Component

**File:** `/src/components/RecordQuery/DataGrid.tsx`

**Props Interface:**
```typescript
interface DataGridProps {
  tableName: string
  records: QRecord[]
  tableMetaData: QTableMetaData
  isLoading: boolean
  totalCount: number
  pageNum: number
  pageSize: number
  sort: Array<{ fieldName: string; isAscending: boolean }>
  rowSelection: Record<string, boolean>
  columnConfig: ColumnConfig
  density: 'compact' | 'standard' | 'comfortable'
  updatePermission: boolean
  onRowClick?: (record: QRecord) => void
  onRowSelectionChange?: (selection: Record<string, boolean>) => void
  onSortChange?: (sort: Array<{ fieldName: string; isAscending: boolean }>) => void
  onColumnConfigChange?: (config: ColumnConfig) => void
}
```

**Behavior:**
- Renders TanStack Table v8 with dynamic columns
- Shows skeleton loader during isLoading
- Shows empty state when totalCount === 0
- Supports multi-column sorting with visual indicators
- Supports row selection with checkbox column
- Row click navigation if updatePermission and onRowClick provided
- Applies density classes to rows for compact/standard/comfortable spacing
- Supports column hide/show via columnConfig

**Metadata-driven Aspects:**
- Columns generated from tableMetaData.fields
- Cell renderers selected based on field.type and field.adornmentType
- Row styling based on record.errors and record.warnings (visual indicators)
- Column width from columnConfig or default 150px

**Responsive Behavior:**
- Horizontal scroll for overflow on mobile
- Column visibility adjusted for screen size (hide low-priority columns on mobile)

---

### FilterBar Component

**File:** `/src/components/RecordQuery/FilterBar.tsx`

**Props Interface:**
```typescript
interface FilterBarProps {
  tableName: string
  tableMetaData: QTableMetaData
  mode: 'basic' | 'advanced'
  filter: QQueryFilter
  isLoading: boolean
  onFilterChange: (filter: QQueryFilter) => void
  onModeChange?: (mode: 'basic' | 'advanced') => void
}
```

**Behavior:**
- Renders either BasicFilter or AdvancedFilterBuilder based on mode
- Debounces filter changes (400ms) to avoid excessive re-renders
- Shows "Clear filters" button when filter is active
- Shows active filter count badge
- Allows toggle between basic and advanced modes

**Metadata-driven Aspects:**
- Field options populated from tableMetaData.fields
- Operator availability based on field.type
- Reference field dropdowns populated via /possibleValues API

**Responsive Behavior:**
- Mobile: Filter in modal triggered by button
- Tablet: Filter sidebar with scrollable content
- Desktop: Fixed filter panel

---

### AdvancedFilterBuilder Component

**File:** `/src/components/RecordQuery/AdvancedFilterBuilder.tsx`

**Props Interface:**
```typescript
interface AdvancedFilterBuilderProps {
  tableMetaData: QTableMetaData
  filter: QQueryFilter
  onFilterChange: (filter: QQueryFilter) => void
  isLoading?: boolean
}
```

**Behavior:**
- Renders recursive filter group editor
- Top-level AND/OR selector
- Add/remove criteria buttons
- Add/remove sub-filter buttons
- Persists filter state as user edits

**Metadata-driven Aspects:**
- Field options from tableMetaData.fields
- Operator validation based on field type

**Responsive Behavior:**
- Vertical scroll for long filters on mobile
- Sub-filter indentation visual hierarchy

---

### FilterCriteria Component

**File:** `/src/components/RecordQuery/FilterCriteria.tsx`

**Props Interface:**
```typescript
interface FilterCriteriaProps {
  tableMetaData: QTableMetaData
  criteria: QFilterCriteria
  onCriteriaChange: (criteria: QFilterCriteria) => void
  onRemove?: () => void
}
```

**Behavior:**
- Renders field selector, operator selector, and value input
- Updates value input type based on selected field and operator
- Shows/hides value inputs based on operator (IS_BLANK has no input, BETWEEN has two, etc.)
- Supports expression type selector for advanced filtering (NowExpression, etc.)

**Metadata-driven Aspects:**
- Field selector populated from tableMetaData.fields
- Operator list filtered by field.type
- Value input type determined by field.type and operator

---

### Toolbar Component

**File:** `/src/components/RecordQuery/Toolbar.tsx`

**Props Interface:**
```typescript
interface ToolbarProps {
  tableName: string
  tableMetaData: QTableMetaData
  insertPermission: boolean
  processPermission: boolean
  updatePermission: boolean
  rowSelection: Record<string, boolean>
  density: 'compact' | 'standard' | 'comfortable'
  filterMode: 'basic' | 'advanced'
  savedViews: SavedView[]
  showColumnConfig: boolean
  onCreateClick?: () => void
  onProcessLaunch?: (processName: string, selectedIds: string[]) => void
  onDensityChange?: (density: 'compact' | 'standard' | 'comfortable') => void
  onColumnConfigToggle?: () => void
  onFilterModeChange?: (mode: 'basic' | 'advanced') => void
  onLoadView?: (viewId: string) => void
  onSaveView?: (viewName: string) => void
  onDeleteView?: (viewId: string) => void
  onExport?: (format: 'csv' | 'excel' | 'pdf') => void
}
```

**Behavior:**
- Renders action buttons conditionally based on permissions
- Shows selected row count when rows selected
- Handles density change with immediate visual feedback
- Manages filter mode toggle state
- Manages saved views menu

**Metadata-driven Aspects:**
- Process options from tableMetaData.processes
- Visibility of buttons based on permissions

---

### ColumnConfigPanel Component

**File:** `/src/components/RecordQuery/ColumnConfigPanel.tsx`

**Props Interface:**
```typescript
interface ColumnConfigPanelProps {
  tableMetaData: QTableMetaData
  columnConfig: ColumnConfig
  onColumnConfigChange: (config: ColumnConfig) => void
  onClose?: () => void
}
```

**Behavior:**
- Shows all columns with visibility checkboxes
- Supports drag-to-reorder or up/down buttons
- "Reset to defaults" button
- "Apply changes" button
- Persists to localStorage on apply

**Metadata-driven Aspects:**
- Column list from tableMetaData.fields
- Default order and visibility from metadata

---

### PaginationControls Component

**File:** `/src/components/RecordQuery/PaginationControls.tsx`

**Props Interface:**
```typescript
interface PaginationControlsProps {
  totalCount: number
  pageNum: number
  pageSize: number
  isLoading: boolean
  onPageChange: (pageNum: number) => void
  onPageSizeChange: (pageSize: number) => void
}
```

**Behavior:**
- Shows record count and current page
- Previous/Next buttons with disabled state at boundaries
- "Go to page" input field
- Page size selector (10, 25, 50, 100)
- Persists page size preference to localStorage

---

### SavedViewsMenu Component

**File:** `/src/components/RecordQuery/SavedViewsMenu.tsx`

**Props Interface:**
```typescript
interface SavedViewsMenuProps {
  savedViews: SavedView[]
  onLoadView: (viewId: string) => void
  onSaveView: (viewName: string) => void
  onDeleteView: (viewId: string) => void
}
```

**Behavior:**
- Dropdown menu of saved views
- "Save current view as..." button with name input dialog
- Load and delete buttons for each view
- Shows "No saved views" when empty

---

## 7. API Client Functions

### executeTableQuery

**File:** `/src/lib/api/query-service.ts`

**Signature:**
```typescript
export async function executeTableQuery(
  tableName: string,
  filter: QQueryFilter,
  joins?: QJoin[],
  tableVariant?: string,
  latestQueryId?: string
): Promise<{ records: QRecord[]; latestQueryId: string }>
```

**Endpoint:** `POST /qqq/v1/table/{tableName}/query`

**Request Payload:**
```typescript
{
  filter: QQueryFilter
  joins?: QJoin[]
  tableVariant?: string
  latestQueryId?: string // For deduplication
}
```

**Response Payload:**
```typescript
{
  records: Array<{
    tableName: string
    recordLabel: string
    values: Record<string, any>
    displayValues: Record<string, string>
    errors?: string[]
    warnings?: string[]
  }>
  latestQueryId?: string
}
```

**TanStack Query Key:**
```typescript
queryKeys.tableQuery(tableName, filter, pageSize, pageNum)
```

**Cache Strategy:**
- staleTime: 30 seconds
- cacheTime: 5 minutes
- keepPreviousData: true (show old data while loading new)

**Error Handling:**
- 400: Invalid filter → Display "Invalid filter criteria" error
- 404: Table not found → Display "Table not found" error
- 500: Server error → Retry with exponential backoff
- Network timeout: Retry up to 3 times, then show error

---

### countTableRecords

**File:** `/src/lib/api/query-service.ts`

**Signature:**
```typescript
export async function countTableRecords(
  tableName: string,
  filter: QQueryFilter,
  joins?: QJoin[],
  tableVariant?: string
): Promise<number>
```

**Endpoint:** `POST /qqq/v1/table/{tableName}/count`

**Request Payload:**
```typescript
{
  filter: QQueryFilter
  joins?: QJoin[]
  tableVariant?: string
}
```

**Response Payload:**
```typescript
{
  count: number
  distinctCount?: number
}
```

**TanStack Query Key:**
```typescript
queryKeys.tableCount(tableName, filter)
```

**Cache Strategy:**
- staleTime: 30 seconds
- cacheTime: 5 minutes
- keepPreviousData: true

**Error Handling:**
- Same as executeTableQuery

---

### fetchPossibleValues

**File:** `/src/lib/api/lookup-service.ts`

**Signature:**
```typescript
export async function fetchPossibleValues(
  tableName: string,
  fieldName: string,
  searchTerm?: string,
  ids?: string[],
  useCase?: string
): Promise<Array<{ id: string | number; label: string }>>
```

**Endpoint:** `POST /qqq/v1/table/{tableName}/possibleValues/{fieldName}`

**Request Payload:**
```typescript
{
  searchTerm?: string
  ids?: string[]
  labels?: string[]
  values?: any[]
  useCase?: string
}
```

**Response Payload:**
```typescript
Array<{
  id: string | number
  label: string
}>
```

**TanStack Query Key:**
```typescript
queryKeys.possibleValues(tableName, fieldName, searchTerm)
```

**Cache Strategy:**
- staleTime: 5 minutes
- cacheTime: 10 minutes
- enabled: only when searching (debounce 400ms)

**Error Handling:**
- 400: Invalid field → Show "Field not found" error
- Network: Retry with backoff

---

## 8. Testing Requirements

### Unit Tests

**Test Files to Create:**

1. **`/src/lib/api/query-service.test.ts`** (200+ lines)
   - Test executeTableQuery with valid filter
   - Test query deduplication (latestQueryId filtering)
   - Test countTableRecords
   - Test error handling (400, 404, 500)
   - Test network timeout retry logic

2. **`/src/lib/hooks/useRecordQuery.test.ts`** (250+ lines)
   - Test state machine transitions (initial → ready)
   - Test filter updates trigger query refetch
   - Test pagination state updates
   - Test sort state updates
   - Test column config persistence to localStorage

3. **`/src/lib/utils/csv-export.test.ts`** (100+ lines)
   - Test CSV generation with proper escaping
   - Test special characters in field names
   - Test newlines and commas in values
   - Test quoted field handling

4. **`/src/components/RecordQuery/FilterCriteria.test.ts`** (150+ lines)
   - Test operator list filters by field type
   - Test value input type changes based on operator
   - Test expression type selector for NowExpression, etc.
   - Test IS_BLANK operator hides value input

5. **`/src/components/RecordQuery/AdvancedFilterBuilder.test.ts`** (200+ lines)
   - Test adding/removing criteria
   - Test adding/removing sub-filters
   - Test boolean operator toggle (AND/OR)
   - Test recursive filter group rendering
   - Test filter validation

6. **`/src/components/RecordQuery/CellRenderers.test.ts`** (200+ lines)
   - Test each renderer function with various inputs
   - Test STRING + LINK renderer generates correct href
   - Test BOOLEAN renderer shows correct icon
   - Test DateTime renderer formats correctly
   - Test SIZE renderer formats bytes correctly
   - Test HTML renderer sanitizes with DOMPurify

### Component Tests (React Testing Library)

**Test Files to Create:**

1. **`/src/app/(dashboard)/app/[tableName]/page.test.tsx`** (300+ lines)
   - Test page renders with loading state
   - Test metadata loading and error handling
   - Test DataGrid renders with records
   - Test empty state when totalCount === 0
   - Test permission-based UI visibility
   - Test table variant selection

2. **`/src/components/RecordQuery/DataGrid.test.tsx`** (250+ lines)
   - Test renders TanStack Table correctly
   - Test row click navigation
   - Test row selection checkbox
   - Test sorting column headers
   - Test cell renderer dispatch
   - Test skeleton loader during loading

3. **`/src/components/RecordQuery/FilterBar.test.tsx`** (200+ lines)
   - Test basic filter mode search
   - Test advanced filter mode builder
   - Test filter mode toggle
   - Test clear filters button
   - Test filter count badge

4. **`/src/components/RecordQuery/Toolbar.test.tsx`** (150+ lines)
   - Test create button shows/hides based on insertPermission
   - Test process launcher shows/hides based on processPermission
   - Test density selector updates grid class
   - Test column config toggle opens/closes panel
   - Test saved views menu

5. **`/src/components/RecordQuery/PaginationControls.test.tsx`** (150+ lines)
   - Test previous/next button disabled states
   - Test page size selector
   - Test "go to page" input validation
   - Test total count display

6. **`/src/components/RecordQuery/ColumnConfigPanel.test.tsx`** (150+ lines)
   - Test visibility checkbox toggle
   - Test drag-to-reorder (or button-based reorder)
   - Test reset to defaults
   - Test apply changes saves to localStorage

### E2E Tests (Playwright or Cypress)

**Test Files to Create:**

1. **`/e2e/record-query.spec.ts`** (500+ lines)
   - Scenario 1: Load record query page
     - ✅ Page loads with table data
     - ✅ Metadata is fetched
     - ✅ Grid renders with correct column count
     - ✅ Pagination controls appear

   - Scenario 2: Filter and search
     - ✅ Enter search term in basic filter
     - ✅ Grid updates with filtered results
     - ✅ Record count updates
     - ✅ Switch to advanced filter mode
     - ✅ Add filter criteria with operator
     - ✅ Add sub-filter with AND/OR logic

   - Scenario 3: Pagination
     - ✅ Change page size from 10 to 25
     - ✅ Click next page button
     - ✅ Navigate to specific page via input
     - ✅ Verify previous/next disabled at boundaries

   - Scenario 4: Sorting
     - ✅ Click column header to sort ascending
     - ✅ Click again to sort descending
     - ✅ Sort indicator shows direction
     - ✅ Click another column for multi-sort

   - Scenario 5: Row selection
     - ✅ Select individual row
     - ✅ Select/deselect all rows
     - ✅ Show selected count in toolbar
     - ✅ Disable create button when rows selected (for bulk ops)

   - Scenario 6: Column configuration
     - ✅ Open column config panel
     - ✅ Hide a column
     - ✅ Reorder columns via drag-drop
     - ✅ Reset to defaults
     - ✅ Apply and verify column visibility persisted

   - Scenario 7: Row navigation
     - ✅ Click a row to navigate to record view
     - ✅ URL contains correct tableName and recordId
     - ✅ Back button returns to list

   - Scenario 8: Saved views
     - ✅ Apply filter and set column order
     - ✅ Save view with name
     - ✅ Load saved view (filter and columns restore)
     - ✅ Delete saved view

   - Scenario 9: Export
     - ✅ Click export and select CSV
     - ✅ CSV file downloads with correct headers
     - ✅ CSV file contains correct number of rows
     - ✅ CSV properly escapes special characters

   - Scenario 10: Density
     - ✅ Change density to compact
     - ✅ Grid rows appear smaller
     - ✅ Change to comfortable
     - ✅ Grid rows appear larger
     - ✅ Density persists on page reload

### Accessibility Tests

**Test Files to Create:**

1. **`/e2e/record-query-a11y.spec.ts`** (200+ lines)
   - ✅ All buttons have aria-label or visible text
   - ✅ Form inputs have associated labels
   - ✅ Table headers have proper <th> scope
   - ✅ Sortable columns announce direction via aria-sort
   - ✅ Row selection checkbox has aria-label
   - ✅ Filter criteria can be navigated via keyboard Tab
   - ✅ Filter value inputs are keyboard accessible
   - ✅ Pagination controls are keyboard accessible
   - ✅ Modal dialogs have focus trap
   - ✅ Dropdown menus announce expanded state
   - ✅ Color alone is not used to convey status (icons + text)
   - ✅ Text contrast meets WCAG AA standard

**Testing Tools:**
- jest / vitest for unit tests
- @testing-library/react for component tests
- axe-core / jest-axe for accessibility tests
- Playwright or Cypress for E2E tests

---

## 9. Acceptance Criteria

**30+ Binary Pass/Fail Criteria:**

### Data Loading & Display
- [ ] Page loads metadata for selected table via TanStack Query
- [ ] DataGrid renders with all columns from tableMetaData.fields
- [ ] Records display in table rows with correct values
- [ ] displayValues are used for cell rendering (not raw values)
- [ ] Column visibility respects columnConfig
- [ ] Column order respects columnConfig
- [ ] Column width respects columnConfig

### Filtering
- [ ] Basic filter mode generates CONTAINS filter across visible columns
- [ ] Basic filter debounces search input (400ms)
- [ ] Advanced filter builder renders filter criteria correctly
- [ ] Filter operator list respects field type (e.g., only date operators for DATE fields)
- [ ] Value input type changes based on operator (single/multiple/range/none)
- [ ] IS_BLANK and IS_NOT_BLANK operators have no value input
- [ ] BETWEEN operator shows two value inputs
- [ ] IN and NOT_IN operators support multiple values
- [ ] Sub-filters can be added and removed
- [ ] AND/OR boolean operator toggles between criteria
- [ ] Filter is applied to /query and /count requests
- [ ] Clear filters button resets filter to empty state

### Pagination
- [ ] /count endpoint is called to get total record count
- [ ] Page size selector (10, 25, 50, 100) works
- [ ] Changing page size resets to page 1
- [ ] Previous button disabled on page 1
- [ ] Next button disabled on last page
- [ ] Page navigation input accepts 1-N (where N = total pages)
- [ ] offset/skip calculated correctly: skip = (pageNum - 1) * pageSize

### Sorting
- [ ] Column headers are clickable and trigger sort
- [ ] First click sorts ascending
- [ ] Second click sorts descending
- [ ] Sort indicator shows direction (↑ or ↓)
- [ ] Multiple column sort is supported (orderBys array)
- [ ] Sort is applied to /query request

### Row Selection
- [ ] Checkbox column renders for each row
- [ ] Individual row selection toggles
- [ ] Select all checkbox selects/deselects all rows on current page
- [ ] Selected row count displays in toolbar
- [ ] Row selection state persists across pagination

### Row Navigation
- [ ] Clicking row navigates to `/app/{tableName}/{recordId}`
- [ ] Navigation is disabled if !updatePermission
- [ ] Cursor changes to pointer on hover (if updatePermission)

### Toolbar Actions
- [ ] Create button shows if insertPermission
- [ ] Create button hides if !insertPermission
- [ ] Create button navigates to `/app/{tableName}/new`
- [ ] Process launcher shows if processPermission
- [ ] Process launcher hides if !processPermission
- [ ] Column config toggle opens/closes panel
- [ ] Density selector changes row height classes
- [ ] Density selection persists to localStorage

### Cell Renderers
- [ ] STRING field renders plain text
- [ ] STRING + LINK adornment renders as clickable link
- [ ] STRING + CHIP adornment renders as pill badge
- [ ] STRING + REVEAL adornment has show/hide toggle
- [ ] INTEGER/LONG/DECIMAL field renders formatted number
- [ ] INTEGER + SIZE adornment renders as human-readable file size (KB, MB, GB)
- [ ] BOOLEAN field renders with icon (✓ or ✗)
- [ ] DATE field renders formatted date
- [ ] DATE_TIME field renders formatted datetime
- [ ] HTML field renders sanitized HTML (no XSS)
- [ ] PASSWORD field masks value or shows reveal button
- [ ] BLOB + FILE_DOWNLOAD adornment shows download button

### Export
- [ ] Export dropdown menu renders
- [ ] CSV export downloads file with correct filename
- [ ] CSV file contains column headers
- [ ] CSV file contains all visible rows
- [ ] CSV properly escapes quotes and newlines
- [ ] CSV values match displayValues (not raw values)

### Saved Views
- [ ] Save view button opens dialog with name input
- [ ] Save view captures current filter + columns + sort
- [ ] Load view applies saved filter + columns + sort
- [ ] Delete view removes from saved views list
- [ ] Saved views persist to localStorage
- [ ] Saved views menu shows list of views

### Column Configuration
- [ ] Column config panel shows all columns
- [ ] Visibility checkbox toggles column visibility
- [ ] Apply changes saves to localStorage
- [ ] Drag-to-reorder changes column order
- [ ] Reset to defaults restores original config
- [ ] Column widths persist to localStorage

### Permissions
- [ ] insertPermission controls Create button visibility
- [ ] updatePermission controls row click navigation
- [ ] processPermission controls process launcher visibility
- [ ] Error message shows "Access Denied" for 403 responses

### Responsive Design
- [ ] Grid scrolls horizontally on mobile (< 640px)
- [ ] Filter opens in modal on mobile
- [ ] Toolbar buttons show icon-only on mobile (< 640px)
- [ ] Pagination controls stack vertically on mobile
- [ ] Tablet layout (640px-1024px) shows filter + grid side-by-side
- [ ] Touch targets are ≥ 44px × 44px on mobile

### Query Optimization
- [ ] latestQueryId prevents stale result application
- [ ] Query is not refetched when unrelated state changes
- [ ] TanStack Query caching reduces API calls
- [ ] staleTime: 30 seconds, cacheTime: 5 minutes

### Error Handling
- [ ] 400 Bad Request shows "Invalid filter" error
- [ ] 401 Unauthorized redirects to login
- [ ] 403 Forbidden shows "Access Denied" error
- [ ] 404 Not Found shows "Table not found" error
- [ ] 500 Server Error shows error message with retry button
- [ ] Network timeout retries with exponential backoff (max 3 attempts)

### Loading States
- [ ] Skeleton loaders display while metadata loads
- [ ] Skeleton loaders display while query executes
- [ ] Empty state message shows when totalCount === 0
- [ ] Empty state has "Clear filters" button
- [ ] Error state displays error message and retry button

### localStorage Persistence
- [ ] Density persists: `qrun-{tableName}-density`
- [ ] Column visibility persists: `qrun-{tableName}-columnConfig`
- [ ] Column order persists: `qrun-{tableName}-columnConfig`
- [ ] Column widths persist: `qrun-{tableName}-columnConfig`
- [ ] Saved views persist: `qrun-{tableName}-savedViews`
- [ ] Page size preference persists: `qrun-{tableName}-pageSize`

### Accessibility
- [ ] All buttons have aria-label or visible text
- [ ] Filter inputs are keyboard accessible (Tab navigation)
- [ ] Table headers announce column name and sort direction
- [ ] Row selection checkbox has aria-label
- [ ] Error messages are announced to screen readers
- [ ] Color contrast meets WCAG AA standard

---

## 10. Implementation Order & Dependencies

**Phase 1 (Week 1):** API & Hooks
1. Step 2: API Query & Count Functions
2. Step 2: Possible Values API
3. Step 1: useRecordQuery hook
4. Step 1: useLocalStoragePersistence hook

**Phase 2 (Week 2):** Page & Grid
1. Step 1: Page Setup & Metadata Loading
2. Step 3: DataGrid Implementation
3. Step 6: Pagination Controls
4. Step 7: Toolbar (basic)

**Phase 3 (Week 3):** Filtering
1. Step 4: Filter Components (Basic & Advanced)
2. Step 5: Filter Operators & Value Inputs
3. Step 4: FilterCriteria Component

**Phase 4 (Week 4):** Renderers & Column Config
1. Step 12: Cell Renderers (all types)
2. Step 8: Column Configuration Panel
3. Step 7: Density Selector

**Phase 5 (Week 5):** Advanced Features
1. Step 10: Saved Views
2. Step 11: Export Functionality
3. Step 7: Process Launcher
4. Step 9: Responsive Design

**Phase 6 (Week 6):** Testing & Polish
1. Unit Tests (query-service, useRecordQuery, csv-export)
2. Component Tests (DataGrid, FilterBar, Toolbar, etc.)
3. E2E Tests (full user journeys)
4. Accessibility Tests
5. Bug fixes & refinements

---

## 11. Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| /query endpoint slow with large datasets | Timeout, poor UX | Medium | Implement request timeout (30s), show progress indicator, warn on >10k records |
| Filter builder complexity confuses users | Support tickets | Medium | Provide filter templates, context help, inline operator descriptions |
| Column reordering via drag-drop | Browser incompatibility | Low | Test across Chrome, Firefox, Safari; fallback to button-based reorder |
| localStorage quota exceeded | Data loss | Low | Check quota before save, warn user, implement cleanup of old views |
| BLOB/FILE rendering unsupported in grid | Feature gap | Low | Fall back to download button, icon + file size display |
| Permission checks inconsistent | Security issue | Low | Centralize permission check utility, test all scenarios |
| Cell renderer infinite loops | Performance | Low | Memoize renderers, add max recursion depth for HTML rendering |
| Query deduplication race condition | Incorrect results | Low | Use UUID for latestQueryId, test with rapid filter changes |

---

## 12. Dependencies & Version Constraints

**Required Libraries:**
- Next.js 15+ (from Package 1)
- React 19+ (from Package 1)
- TypeScript 5.3+ (from Package 1)
- Tailwind CSS 4.0+ (from Package 1)
- shadcn/ui 1.0+ (from Package 1)
- TanStack Table v8.0+
- TanStack Query v5.0+
- axios 1.4+
- DOMPurify 3.0+ (for HTML rendering)
- date-fns 2.30+ (for date formatting)
- lucide-react 0.263+ (for icons)

---

## 13. Future Enhancements (Out of Scope for Package 2)

1. **Real-time Updates:** WebSocket subscriptions for live grid updates
2. **Advanced Export:** Excel, PDF, JSON formats
3. **Gantt/Calendar Views:** Alternative data visualizations
4. **Calculated Columns:** Server-side computed fields
5. **Master-Detail:** Expandable rows showing related records
6. **Bulk Edit:** Edit multiple records at once
7. **Full-text Search:** Integration with search API
8. **Custom Formatting:** Per-table CSS themes
9. **Scheduled Reports:** Email grid snapshots
10. **Audit Trail:** View history of record changes (Package 3+)

---

## 14. Sign-Off & Deployment

**Code Review Checklist:**
- [ ] All TypeScript types are strict (no `any`)
- [ ] All API calls have error handling
- [ ] All localStorage keys are namespaced
- [ ] All accessibility requirements met
- [ ] All 30+ acceptance criteria pass
- [ ] All unit, component, E2E tests pass
- [ ] Performance: DataGrid scrolls smoothly with 1000+ rows
- [ ] Performance: Filter builder responds in <500ms
- [ ] No console errors or warnings
- [ ] Mobile responsive tested on iOS and Android

**Deployment Checklist:**
- [ ] Package 1 components available in codebase
- [ ] Environment variables set (API baseURL, etc.)
- [ ] Feature flag for Record Query (if rolling out)
- [ ] Staging environment tested
- [ ] Rollback plan documented
- [ ] Monitoring/analytics configured

---

**Document Version:** 1.0
**Last Updated:** 2026-02-25
**Next Review:** After Package 2 completion

