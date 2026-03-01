# Component Patterns

This guide describes the recurring patterns used throughout the QQQ Frontend Next codebase. Understanding these patterns is essential before adding new components or modifying existing ones.

---

## Pattern 1: Metadata-Driven Rendering

QQQ is a metadata-driven framework. The backend declares all structure — table names, field lists, widget layouts, and navigation items — and the frontend renders from it dynamically. No table names, field names, or navigation entries are hardcoded anywhere in the component tree.

### How it works

**Server-side (or near-server) layers** fetch metadata and pass it down as props. **Client Components** never fetch metadata themselves — they receive it through their props and render from it.

The routing entry point is `src/app/(dashboard)/app/[slug]/page.tsx`. It is a Client Component that fetches the full QQQ instance metadata from the server, resolves the slug against the metadata, and dispatches to the appropriate page component:

```tsx
// src/app/(dashboard)/app/[slug]/page.tsx (simplified)
export default function SlugPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const { data: metaData } = useQuery({
    queryKey: queryKeys.metadataAll(),
    queryFn: loadMetaData,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })

  // Resolve slug against apps, tables, processes, reports in priority order
  const isTable = Boolean(metaData?.tables?.[slug])
  const table = metaData?.tables?.[slug]

  // Pass resolved metadata as props — the child component never fetches
  if (isTable && table) {
    const tableProcesses = getProcessesForTable(metaData, slug)
    return <RecordQuery tableName={slug} tableMetaData={table} processes={tableProcesses} />
  }
  // ... other cases
}
```

`RecordQuery` receives `tableMetaData` as a prop. It does not know or care how that data arrived — it renders from it:

```tsx
// src/components/query/RecordQuery.tsx
interface RecordQueryProps {
  tableName: string
  tableMetaData: QTableMetaData   // always passed in, never fetched internally
  processes?: QProcessMetaData[]
}

export function RecordQuery({ tableName, tableMetaData, processes }: RecordQueryProps) {
  // tableMetaData is already resolved — no fetching here
  const canCreate = tableMetaData.insertPermission
  // ...
}
```

### Key rules

- `tableMetaData` (and any other metadata object) is `undefined` until TanStack Query resolves it. Every component must handle the loading state. The slug page renders a spinner until metadata is ready; it never passes `undefined` to its child components.
- User-facing text always uses `label` from metadata, never `name`. For example, the page header is set to `table?.label ?? slug`, not the raw slug.
- The `resolveSlugTarget` function in `SlugPage` is extracted as a pure function precisely so it can be tested in isolation without any rendering.

### Resolution priority

The slug page resolves in this order: **app** → **table** → **process** → **report**. The first match wins.

---

## Pattern 2: data-qqq-id Attributes

Every significant or interactive element carries a `data-qqq-id` attribute. This attribute serves two purposes:

1. **CSS customization hook** — deployers can write `[data-qqq-id="button-save"] { ... }` in their own stylesheets to override the default styling without touching source code.
2. **Test selector** — Playwright E2E tests and unit tests target elements by `data-qqq-id` rather than by class name (which is an implementation detail subject to change).

### Naming convention

The format is `{component-type}-{identifier}`:

| Pattern | Example |
|---|---|
| `record-query-{tableName}` | `record-query-orders` |
| `widget-{name}` | `widget-ordersSummary` |
| `widget-label-{name}` | `widget-label-ordersSummary` |
| `widget-content-{name}` | `widget-content-ordersSummary` |
| `button-widget-reload-{name}` | `button-widget-reload-ordersSummary` |
| `button-widget-export-{name}` | `button-widget-export-ordersSummary` |
| `button-widget-help-{name}` | `button-widget-help-ordersSummary` |
| `button-save` | `button-save` |
| `button-cancel` | `button-cancel` |
| `field-value-{fieldName}` | `field-value-status` |
| `filter-panel-close` | `filter-panel-close` |
| `link-back-to-source` | `link-back-to-source` |
| `unknown-slug-{slug}` | `unknown-slug-foo` |

### Examples from the actual code

`WidgetBlock.tsx` — the outer card, its label, and its icon buttons:
```tsx
<section
  data-qqq-id={`widget-${name}`}
  aria-label={label}
>
  <h3 data-qqq-id={`widget-label-${name}`}>{label}</h3>
  <button data-qqq-id={`button-widget-help-${name}`}>...</button>
  <button data-qqq-id={`button-widget-export-${name}`}>...</button>
  <button data-qqq-id={`button-widget-reload-${name}`}>...</button>
  <div data-qqq-id={`widget-content-${name}`}>...</div>
</section>
```

`RecordQuery.tsx` — the outer container, the filter close button, and the back link:
```tsx
<div data-qqq-id={`record-query-${tableName}`}>
  <Link data-qqq-id="link-back-to-source">...</Link>
  <button data-qqq-id="filter-panel-close">...</button>
</div>
```

`EntityForm.tsx` — the form itself and its action buttons:
```tsx
<form data-qqq-id={`entity-form-${tableMetaData.name}`}>
  <button data-qqq-id="button-cancel">Cancel</button>
  <button data-qqq-id="button-save">Save</button>
</form>
```

`FieldValue.tsx` — every field value element is tagged with its field name:
```tsx
<span data-qqq-id={`field-value-${field.name}`}>...</span>
```

### Rules

- Do not use Tailwind class names as test selectors. If a test needs to click a button, it should use `page.getByTestId` or `[data-qqq-id="..."]` selectors, not `.bg-primary` or `.rounded-md`.
- Identifier segments use the backend `name` field (e.g., `orders`), not the `label` (e.g., `"Customer Orders"`). Labels can contain spaces and special characters; names are safe identifiers.

---

## Pattern 3: Async Combobox (`useAsyncCombobox`)

Any dropdown that loads its options from the API with user-typed search uses the `useAsyncCombobox` hook (`src/lib/hooks/use-async-combobox.ts`). The hook encapsulates fetch, debounce, AbortController cancellation, and click-outside-to-close logic that would otherwise be duplicated in every combobox component.

### When to use it

Use `useAsyncCombobox` when:
- The options come from a QQQ possible-value source (table-backed lookup).
- The user can type to search and the list is fetched on demand.
- The option list is too large to load all at once (more than ~50 items).

Use a plain `<select>` or a static shadcn/ui `<Select>` when:
- The options are a small static list (e.g., sort direction: "Ascending / Descending").
- The options are already available in memory (e.g., column names from `tableMetaData.fields`).

### Usage

```tsx
import { useAsyncCombobox } from '@/lib/hooks/use-async-combobox'

function MyPossibleValueInput({ tableName, fieldName, onChange }) {
  const {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    options,           // QPossibleValue[] — the fetched options to display
    isLoading,
    containerRef,      // attach to outermost wrapper for click-outside close
    inputRef,          // attach to the <input> for focus management
    debouncedFetch,    // call in onChange handler to trigger debounced fetch
  } = useAsyncCombobox({
    tableName,
    fieldName,
    onOptionsFetched: (results) => {
      // optional: update a label map or other derived state
    },
  })

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value)
          debouncedFetch(e.target.value)
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && (
        <ul role="listbox">
          {isLoading && <li>Loading...</li>}
          {options.map((opt) => (
            <li
              key={opt.id}
              role="option"
              onClick={() => {
                onChange(opt.id)
                setIsOpen(false)
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### What the hook manages internally

| Concern | Mechanism |
|---|---|
| Debouncing | `setTimeout` cleared on each call; fires after `COMBOBOX_DEBOUNCE_MS` (200 ms) |
| Request cancellation | `AbortController` — aborts the previous fetch before starting a new one |
| Click-outside close | `document.addEventListener('mousedown', handler)` attached to `containerRef` |
| Auto-fetch on open | `useEffect` on `isOpen` — fetches the full list when the dropdown opens |
| Cleanup on unmount | Clears pending timer and aborts any in-flight request |

### Return values

| Field | Type | Purpose |
|---|---|---|
| `isOpen` | `boolean` | Drive conditional rendering of the dropdown list |
| `setIsOpen` | `Dispatch` | Programmatically open/close (e.g., on focus, on select) |
| `searchTerm` | `string` | Controlled value for the text input |
| `setSearchTerm` | `Dispatch` | Update the text input value |
| `options` | `QPossibleValue[]` | The fetched options — map these to `<li>` elements |
| `isLoading` | `boolean` | Show a spinner or loading state while the fetch is in-flight |
| `containerRef` | `RefObject<HTMLDivElement>` | Attach to the outermost wrapper element |
| `inputRef` | `RefObject<HTMLInputElement>` | Attach to the text `<input>` element |
| `fetchOptions` | `(term: string) => Promise<void>` | Immediate fetch (bypasses debounce) |
| `debouncedFetch` | `(term: string) => void` | Debounced fetch — use this in `onChange` |

---

## Pattern 4: Widget Rendering Pipeline

All dashboard widgets flow through a three-layer pipeline:

```
ConnectedWidget
  └─ WidgetBlock          (card chrome, loading, error, dropdown selects)
       └─ WidgetRenderer  (type dispatcher)
            └─ StatisticsWidget | BarChartWidget | BlockWidget | ...
```

### Layer 1: ConnectedWidget

`src/components/widgets/ConnectedWidget.tsx` is the primary entrypoint. It:

1. Reads `widgetMetaData.dropdowns` and initializes dropdown state.
2. Fetches dropdown option lists from the possible-value API.
3. Calls `useWidget(widgetMetaData.name, mergedParams)` to fetch the widget's data payload.
4. Returns `null` immediately when `widgetMetaData.hasPermission === false`.
5. Renders `<WidgetBlock>` with loading/error props and passes the fetched `data` to `<WidgetRenderer>`.

```tsx
// ConnectedWidget orchestrates everything
export function ConnectedWidget({ widgetMetaData, params, className }) {
  const { data, isLoading, isError, error, refetch } = useWidget(widgetMetaData.name, mergedParams)

  return (
    <WidgetBlock
      widgetMetaData={widgetMetaData}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onReload={refetch}
      // ... dropdown props
    >
      {data && <WidgetRenderer widgetMetaData={widgetMetaData} data={data} />}
    </WidgetBlock>
  )
}
```

### Layer 2: WidgetBlock

`src/components/widgets/WidgetBlock.tsx` provides the standard card shell:
- Header with `label`, optional help tooltip, optional export button, optional reload button, and optional dropdown `<select>` elements.
- Body area that renders a skeleton, an error state, or its `children`.
- A `bare` prop that strips all chrome for use inside composite widgets.

The `WidgetBlock` does not know what type of widget it wraps. It only knows about loading/error state.

### Layer 3: WidgetRenderer

`src/components/widgets/WidgetRenderer.tsx` is the type dispatcher. It receives `widgetMetaData` and the raw `data` payload, reads `widgetMetaData.type`, and renders the appropriate typed component via a `switch` statement.

Supported types:

| `widgetMetaData.type` | Rendered component |
|---|---|
| `'statistics'` | `StatisticsWidget` |
| `'barChart'` | `BarChartWidget` (lazy) |
| `'lineChart'` | `LineChartWidget` (lazy) |
| `'pieChart'` | `PieChartWidget` (lazy) |
| `'recordGrid'` | `RecordGridWidget` |
| `'html'` / `'block'` | `BlockWidget` |
| `'divider'` | `DividerWidget` |
| `'quickLinks'` | `QuickLinksWidget` |
| `'alert'` | `AlertWidget` |
| `'processSummary'` | `ProcessSummaryWidget` |
| `'composite'` / `'parent'` | `CompositeWidget` |
| `'chart'` | `ChartTypeDispatcher` (secondary `chartType` dispatch) |

Chart widgets (`barChart`, `lineChart`, `pieChart`) are loaded with `React.lazy` + `Suspense` to split the Recharts library into a separate bundle chunk. This keeps the initial JS bundle small on pages that contain no charts.

### How to add a new widget type

1. Create a new component file, e.g., `src/components/widgets/HeatmapWidget.tsx`. Export a typed payload interface and the component:

```tsx
// src/components/widgets/HeatmapWidget.tsx
export interface HeatmapWidgetPayload {
  rows: Array<{ label: string; cells: number[] }>
  columnLabels: string[]
}

export function HeatmapWidget({ data, widgetName }: { data: HeatmapWidgetPayload; widgetName: string }) {
  // render the heatmap
}
```

2. Add a `case` to the `switch` in `WidgetRenderer.tsx`:

```tsx
import { HeatmapWidget } from './HeatmapWidget'
import type { HeatmapWidgetPayload } from './HeatmapWidget'

// Inside the switch:
case 'heatmap':
  return <HeatmapWidget data={data as HeatmapWidgetPayload} widgetName={name} />
```

3. The backend returns `widgetMetaData.type = 'heatmap'` for this widget. No other changes are needed — `ConnectedWidget` picks it up automatically.

---

## Pattern 5: Field Adornment Priority

`FieldValue` (`src/components/records/FieldValue.tsx`) renders a single QQQ field value in read-only mode. When a field has adornments (decorations declared in `field.adornments[]`), `FieldValue` applies them in strict priority order. The first matching adornment wins; subsequent ones are skipped.

### Priority order

1. **LINK** — renders the value as an `<a>` tag with an external link icon.
2. **FILE_DOWNLOAD** — renders a download anchor using the display value as the URL.
3. **SIZE** — formats the raw number as a human-readable byte size (e.g., `1.5 MB`).
4. **CHIP** — renders the value as a colored badge using a `colorMap` from adornment values.
5. **RENDER_HTML** (or field type `HTML`) — renders sanitized HTML via `DOMPurify.sanitize`.
6. **CODE_EDITOR** — renders the value in a monospace `<pre><code>` block.
7. **TOOLTIP** — wraps the value in a Radix tooltip. Falls through to type-based rendering when no tooltip text is resolved.
8. **ERROR** — renders the value with a destructive icon and styling.
9. Record reference link — when `field.possibleValueSourceName` matches a known table, renders as a Next.js `<Link>` with a `RecordHoverCard` preview.
10. Type-based fallbacks — `BOOLEAN`, `PASSWORD`, `BLOB`, `TEXT` each have dedicated renderers.
11. Default — auto-links bare `http(s)://` URLs and `mailto:` email addresses.

### How adornment detection works

Each adornment is checked with `Array.some()` before its rendering block. The discriminated union type `FieldAdornment` is narrowed inside each block using a type predicate:

```tsx
// Detection
const hasLink = field.adornments?.some((a) => a.type === 'LINK')

// Narrowing within the block
if (hasLink) {
  const linkAdornment = field.adornments?.find(
    (a): a is Extract<FieldAdornment, { type: 'LINK' }> => a.type === 'LINK'
  )
  const href = linkAdornment?.values?.linkURL ?? String(value)
  // ...
}
```

The `Extract<FieldAdornment, { type: 'LINK' }>` predicate gives TypeScript full knowledge of which `values` keys are available for that specific adornment type without a cast.

### TOOLTIP fall-through

The TOOLTIP case has one deliberate exception to the "first match wins" rule: if the `TOOLTIP` adornment is present but none of the `values` keys (`tooltipText`, `text`, `tooltip`) resolve to a non-empty string, the block falls through to type-based rendering. The value is still displayed — only the tooltip wrapper is omitted because there is nothing to show. This is documented with a comment in the source.

### DOMPurify sanitization

HTML values are sanitized once via `useMemo` that only re-runs when `value` changes:

```tsx
const sanitizedHtml = useMemo(
  () => DOMPurify.sanitize(String(value)),
  [value]
)
```

This prevents unnecessary sanitization work on every render while also preventing XSS from backend-provided HTML content.
