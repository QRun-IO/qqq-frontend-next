# State Management Guide

This document explains when to use each state container in the QQQ Frontend Next codebase. Each container has a specific purpose — choosing the wrong one leads to stale data, lost state on navigation, or unnecessary complexity.

## Decision Matrix

| If the state is… | Use… |
|---|---|
| Data fetched from the server (records, metadata, widgets, processes) | TanStack Query |
| Form field values and validation errors | React Hook Form |
| Filters, pagination, sort order — things a user should be able to bookmark or share | URL search params |
| User preferences that survive a session (density, column widths, saved views) | `useLocalStorage` |
| Application-wide UI state (modal stack, page header, accent color, branding) | QContext |
| Ephemeral UI state local to one component (dropdown open, hover, toggle) | `useState` / `useReducer` |

---

## TanStack Query — Server State

**Rule:** Never use `useState` for data that comes from the server. TanStack Query owns all server state.

The query client is configured in `src/lib/query-client.ts` with:
- 5-minute stale time — metadata and record lists stay fresh without excessive refetching
- 10-minute GC time — recently visited pages are snappy when navigating back
- Smart retry: never retries 4xx errors; retries 5xx and network failures up to 3 times with exponential back-off
- Global `QueryCache.onError` and `MutationCache.onError` — most errors are automatically toasted without per-call handling

### Query key factory

All query keys are defined in `queryKeys` in `src/lib/query-client.ts`. Always use the factory, never inline string arrays.

```typescript
import { queryKeys } from '@/lib/query-client'

// Fetch a single record
useQuery({
  queryKey: queryKeys.tableRecord('order', recordId),
  queryFn: () => getRecord('order', recordId),
})

// Invalidate all records for a table after a mutation
queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords('order') })

// Invalidate everything (e.g. after logout)
queryClient.invalidateQueries({ queryKey: queryKeys.all() })
```

### Key hierarchy (broadest → narrowest)

```
['qqq']
  ['qqq', 'metadata', 'all']
  ['qqq', 'metadata', 'table', tableName]
  ['qqq', 'records', tableName]
  ['qqq', 'records', tableName, recordId]
  ['qqq', 'records', tableName, 'count', filterHash]
  ['qqq', 'processes', processName, processUUID, 'status', jobUUID]
  ['qqq', 'widgets', widgetName, params]
  ['qqq', 'possibleValues', 'table', tableName, fieldName, searchTerm]
  ['qqq', 'search', searchTerm]
```

Broad invalidations cascade down. For example, `queryKeys.tableRecords('order')` invalidates both the list query and all individual record queries for that table.

### What belongs in TanStack Query

- Record lists and counts
- Single record fetches
- All metadata (tables, processes, apps)
- Widget data
- Process status polling
- Possible values / enum lookups
- Global search results
- Auth session metadata

### What does NOT belong

Do not use TanStack Query for UI state (modal open/close, form field values, user preferences). Those belong in the containers described below.

---

## React Hook Form — Form Field State

**Rule:** React Hook Form owns field values and validation state for forms only. Do not use it for non-form UI, and do not reach into the form state from outside the form.

Forms are built with Zod schemas derived from field metadata. The schema is constructed by `zodFromMetadata()` in `src/lib/utils/zod-from-metadata.ts`.

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { zodFromMetadata } from '@/lib/utils/zod-from-metadata'

function EntityForm({ tableMetaData, record }: Props) {
  const schema = zodFromMetadata(tableMetaData)
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: record ?? {},
  })

  // Map a 400 validation error back to individual fields
  const onSubmit = async (data: FieldValues) => {
    try {
      await saveRecord('order', data)
    } catch (error) {
      if (getErrorStatusCode(error) === 400) {
        const fieldErrors = extractFieldErrors(error)
        for (const [field, message] of Object.entries(fieldErrors)) {
          form.setError(field, { message })
        }
      }
    }
  }
}
```

### What belongs in React Hook Form

- All form field values
- Validation errors (field-level and form-level)
- Dirty/touched state
- Submit handling

### What does NOT belong

Do not use React Hook Form for filter criteria in the query page — those live in URL params and reducer state managed by `useRecordQuery`.

---

## URL Search Params — Shareable State

**Rule:** Any state a user should be able to bookmark, share, or restore after a page refresh goes in the URL.

Use Next.js `useSearchParams` and `useRouter` to read and write URL state. This is the right home for:
- Active filters and quick search term
- Current page and page size
- Sort column and direction

The `useRecordQuery` hook syncs filter/pagination state to and from the URL automatically. Components should read these values from the hook, not from `useSearchParams` directly.

```typescript
import { useSearchParams, useRouter } from 'next/navigation'

// Reading
const searchParams = useSearchParams()
const page = Number(searchParams.get('page') ?? '1')
const sort = searchParams.get('sort') ?? ''

// Writing — replace so the back button doesn't accumulate filter changes
const router = useRouter()
const params = new URLSearchParams(searchParams)
params.set('page', String(nextPage))
router.replace(`?${params.toString()}`)
```

### Key naming conventions in URL params

| Param | Values | Purpose |
|---|---|---|
| `page` | integer | Current page (1-based) |
| `pageSize` | 10, 25, 50, 100 | Rows per page |
| `sort` | `fieldName:asc` or `fieldName:desc` | Active sort |
| `q` | string | Quick search term |
| `filter` | base64-encoded JSON | Serialized filter criteria |

### What belongs in URL params

- Filters, quick search
- Pagination (page, page size)
- Sort order
- Any state that makes a link shareable

### What does NOT belong

Do not put ephemeral UI state (modal open, panel open) in the URL. Do not put server data in the URL.

---

## localStorage — User Preferences

**Rule:** Preferences that should survive across sessions and browser restarts go in localStorage via the `useLocalStorage` hook.

The hook lives at `src/lib/hooks/use-local-storage.ts`. It is SSR-safe (returns `initialValue` on the server), cross-tab synced (listens to `storage` events), and has a stable setter that accepts a value or an updater function matching the `useState` API.

```typescript
import { useLocalStorage } from '@/lib/hooks/use-local-storage'

const [density, setDensity, removeDensity] = useLocalStorage<'compact' | 'standard' | 'comfortable'>(
  'qqq-order-density',
  'standard'
)
```

### Higher-level hooks built on `useLocalStorage`

| Hook | Key | Contents |
|---|---|---|
| `useUserPreferences` | `qqq-user-preferences` | Default page size, density, view mode |
| `useColumnConfig` | `qqq-{tableName}-columns`, `qqq-{tableName}-column-order`, `qqq-{tableName}-column-widths` | Column visibility, order, pixel widths |
| `useSavedViews` | `qqq-{tableName}-saved-views` | Named filter snapshots |

### Key naming convention

```
qqq-{tableName}-{purpose}        # table-scoped
qqq-user-preferences             # global user preferences
qqq:{scope}:{purpose}            # alternative colon-separated form
```

Always prefix with `qqq-` to avoid collisions with other apps that might share the same origin.

### What belongs in localStorage

- Table density (compact / standard / comfortable)
- Column visibility and order per table
- Column pixel widths per table
- Saved views (named filter snapshots)
- Global user preferences (default page size, default view mode)
- Dismissed banners or one-time notices

### What does NOT belong

Do not store server data in localStorage — use TanStack Query's cache. Do not store state that should be shareable — use URL params.

---

## QContext — Application-Wide UI State

**Rule:** Use QContext for state that must be accessible anywhere in the authenticated app tree and does not fit a more specific container.

The provider is `QContextProvider` in `src/lib/context/q-context.tsx`. Access it with the `useQContext()` hook. The hook throws at runtime if called outside a provider, which catches integration mistakes early.

```typescript
import { useQContext } from '@/lib/context/q-context'

function RecordQueryPage({ tableMetaData }: Props) {
  const { setPageHeader, setTableMetaData } = useQContext()

  useEffect(() => {
    setPageHeader(tableMetaData.label)
    setTableMetaData(tableMetaData)
  }, [tableMetaData])
}
```

### What QContext contains

| Field | Type | Purpose |
|---|---|---|
| `pageHeader` | `string \| ReactNode` | Content rendered in the page header area |
| `accentColor` / `accentColorLight` | `string` | Theme accent colors (hex) |
| `tableMetaData` | `QTableMetaData \| null` | Metadata for the currently viewed table |
| `tableProcesses` | `QProcessMetaData[] \| null` | Processes for the current table |
| `dotMenuOpen` | `boolean` | Whether the ellipsis action menu is open |
| `modalStack` | `string[]` | Ordered list of open modal identifiers for keyboard nav |
| `pushModalOnStack(id)` | function | Called when a modal opens |
| `popModalOffStack(id)` | function | Called when a modal closes; warns if id is not on top |
| `clearModalStack()` | function | Clears all modal identifiers (e.g. on navigation) |
| `keyboardHelpOpen` | `boolean` | Keyboard shortcut overlay visibility |
| `userId` | `string \| undefined` | Current authenticated user identifier |
| `branding` | `QBrandingMetaData \| null` | Company name, app name, URLs from backend |
| `pathToLabelMap` | `Record<string, string>` | URL path segment → human-readable breadcrumb label |

### Modal stack usage

The modal stack ensures that `Escape` closes only the top-most modal and that focus is restored correctly. Every modal or sheet component must push on open and pop on close.

```typescript
const { pushModalOnStack, popModalOffStack, modalStack } = useQContext()
const modalId = 'edit-record-modal'

// On open
pushModalOnStack(modalId)

// On close
popModalOffStack(modalId)

// Check if this modal is on top (for Escape handling)
const isTopModal = modalStack[modalStack.length - 1] === modalId
```

### What belongs in QContext

- Application-wide UI state that has no more specific home
- Page header content (set by each page on mount)
- Modal stack (for coordinated keyboard navigation)
- Accent colors and branding
- The currently active table metadata (consumed by header, breadcrumbs, action menus)

### What does NOT belong

Do not put server data in QContext (use TanStack Query). Do not put form state in QContext (use React Hook Form). Do not put user preferences in QContext (use localStorage).

---

## useState / useReducer — Local Transient State

**Rule:** Use `useState` or `useReducer` only for state that is local to a single component or a small subtree, ephemeral (lost on unmount is acceptable), and neither server data nor shareable state.

```typescript
// Good — ephemeral open/close that doesn't need to survive navigation
const [dropdownOpen, setDropdownOpen] = useState(false)
const [isHovered, setIsHovered] = useState(false)

// Good — complex multi-field local state with clear action types
const [state, dispatch] = useReducer(recordQueryReducer, initialState)
```

### What belongs in useState / useReducer

- Dialog, dropdown, tooltip open/close
- Hover and focus state
- Local form wizard step (if not shareable)
- Complex local state with many fields that transition together (handled by `useReducer`)

### What does NOT belong

- Server data (use TanStack Query)
- State that should survive navigation or page refresh (use URL params or localStorage)
- State needed by distant parts of the tree (use QContext or lift appropriately)

---

## Summary

```
Server data           → TanStack Query (queryKeys factory, automatic toasts on error)
Form fields           → React Hook Form + Zod
Shareable/bookmarkable → URL search params
User preferences      → useLocalStorage (key: qqq-{tableName}-{purpose})
App-wide UI state     → QContext (useQContext hook)
Local/ephemeral UI    → useState / useReducer
```
