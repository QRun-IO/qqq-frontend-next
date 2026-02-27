# Code Quality Review — QQQ Frontend Next

**Date:** 2026-02-27
**Scope:** DRY, KISS, component design, hooks, TypeScript quality, naming, structure
**Note:** Security/runtime bugs are documented separately in `CODE-REVIEW-2026-02-27.md`

---

## Summary

The codebase demonstrates **strong architectural foundations** with excellent separation of concerns and metadata-driven rendering patterns. However, there are **significant code quality issues** across multiple dimensions: substantial DRY violations in filter/combobox logic, an overengineered god-hook, inconsistent error handling approaches, and TypeScript practices that miss opportunities for stronger typing. The `use-record-query` hook is an anti-pattern — a 540-line hook mixing data fetching, URL synchronization, localStorage persistence, and UI state. FilterBuilder has two combobox implementations that are ~95% identical. Several utilities and constants are defined inline or scattered across files. While the component structure is clean and the metadata-driven approach is correct, the implementation needs targeted refactoring to reduce coupling, eliminate duplication, and simplify abstractions.

---

## CRITICAL Quality Issues (blocks maintainability)

### CQ-CRIT-1: `use-record-query` — God Hook Anti-Pattern (540 lines)
**File:** `src/lib/hooks/use-record-query.ts`

This hook violates SRP catastrophically. It manages:
- Pagination state (pageNum, pageSize)
- Filter state (userFilter, quickSearchTerm, filterMode)
- Column configuration (columnVisibility, columnOrder, columnWidths)
- Row selection state
- UI panel toggles (filterPanelOpen, columnConfigOpen)
- localStorage persistence (5 separate useEffect blocks)
- URL params synchronization (1 useEffect block)
- TanStack Query integration (2 queries)
- Saved views (saveView, loadView, deleteView callbacks)
- 18+ action dispatchers

The hook returns 40+ properties. Components must destructure dozens of items they don't need. The reducer pattern for 24+ action types is overkill for this state complexity.

**Why it's Critical:**
- Testing requires mocking localStorage, URL manipulation, TanStack Query, and multiple state branches simultaneously
- Any change to one concern risks breaking another
- Components using this hook are tightly coupled to its entire API shape
- The localStorage sync fires 5 separate effects independently

**Recommended Fix:**
Split into 3-4 focused hooks:
- `useRecordPagination()` — pageNum, pageSize, totalPages, setPage, setPageSize
- `useRecordFilter()` — userFilter, quickSearchTerm, setFilter, resetFilter
- `useRecordSelection()` — rowSelection, setRowSelection, clearSelection
- `useRecordUIState()` — columnConfigOpen, filterPanelOpen, toggles

Let RecordQuery coordinate these together.

---

### CQ-CRIT-2: FilterBuilder — Two Comboboxes That Are 95% Identical
**File:** `src/components/query/FilterBuilder.tsx`, lines 508-927

`PossibleValueSingleSelect` (lines 508-698) and `PossibleValueMultiSelect` (lines 713-927) are nearly identical. Both:
- Fetch options via `fetchTablePossibleValues()`
- Debounce search input (300ms) — copied at lines 557-563 and 771-777
- Manage AbortController for stale request cancellation — copied at lines 585-590 and 799-804
- Implement click-outside-to-close
- Render search input, loading state, option list

Differences: only selection model (single vs. multi) and tag display.

**Why it's Critical:**
- Bug fix in one requires manual sync to the other
- 400+ lines of duplicated code
- Missing memoization: callbacks re-created on every render

**Recommended Fix:**
Extract a `useAsyncCombobox` hook:
```typescript
function useAsyncCombobox(tableName: string, fieldName: string) {
  // Shared debounce, abort, cleanup logic
  return { options, isLoading, debouncedFetch, abortRef }
}
```
Then SingleSelect and MultiSelect become thin wrappers managing only the selection model.

---

### CQ-CRIT-3: `zod-from-metadata` — Repeated Required/Optional Pattern x10
**File:** `src/lib/utils/zod-from-metadata.ts`, lines 11-114

STRING, TEXT, HTML, and PASSWORD cases (lines 19-60, 99-110) all repeat:
```typescript
let schema = z.string()
if (isRequired) schema = schema.min(1, `${label} is required`)
if (maxLength) schema = schema.max(maxLength, ...)
return isRequired ? schema : schema.optional()
```

The required/optional wrapping pattern is written identically across all 10+ field types.

**Recommended Fix:**
```typescript
function buildStringSchema(isRequired: boolean, maxLength?: number, label?: string) {
  let schema = z.string()
  if (isRequired) schema = schema.min(1, `${label} is required`)
  if (maxLength) schema = schema.max(maxLength, `Must be ${maxLength} characters or fewer`)
  return isRequired ? schema : schema.optional()
}

case 'STRING':
case 'TEXT':
case 'HTML':
case 'PASSWORD':
  return buildStringSchema(isRequired, field.maxLength, field.label)
```

---

### CQ-CRIT-4: Inconsistent Error Status Detection Across Components
**Files:**
- `src/components/records/RecordView.tsx` lines 68-83 — custom `getErrorStatusCode()`, handles 403/404/500
- `src/components/query/RecordQuery.tsx` lines 493-512 — generic "Failed to load records" for all errors

Error handling is implemented differently in the two main page components. If the API changes, fixes are needed in multiple places.

**Recommended Fix:**
```typescript
// src/lib/utils/error-utils.ts
export function getErrorStatusCode(error: unknown): number | undefined { ... }
export function getErrorMessage(error: unknown, context: string): string { ... }
```
Use this in both RecordView and RecordQuery.

---

## HIGH Quality Issues (significant tech debt)

### CQ-HIGH-1: RecordQuery — Too Many Responsibilities (586 lines)
**File:** `src/components/query/RecordQuery.tsx`

This component manages: quick search debounce, view mode toggle, mobile filter sheet state, density selector, and renders: toolbar (150+ lines inline), filter panel (desktop + mobile variants), bulk action bar, error/empty states, DataGrid, RecordCardView, and process launcher coordination.

**Extractable subcomponents:**
- `<RecordQueryToolbar />` — all toolbar state and rendering
- `<DensitySelector />` — the dropdown (lines 291-339)
- `<ViewModeToggle />` — button group (lines 258-288)
- `<QuickSearchInput />` — search field with debounce

---

### CQ-HIGH-2: FilterBuilder — No Memoization on Recursive Components
**File:** `src/components/query/FilterBuilder.tsx`

The recursive chain FilterBuilder → FilterGroup → CriteriaRow → FilterValueInput doesn't memoize callbacks or components. Every filter state change re-renders all sibling rows, and PossibleValueSingleSelect's useEffect (line 566) re-fires unnecessarily — potentially resetting combobox search input during user input.

**Fix:**
```typescript
export const CriteriaRow = React.memo(function CriteriaRow({ ... }) { ... })
export const FilterValueInput = React.memo(function FilterValueInput({ ... }) { ... })
```

---

### CQ-HIGH-3: Field Adornments Typed as `Record<string, unknown>`
**File:** `src/components/records/FieldValue.tsx`, lines 65-66, 119-120

```typescript
const href = (linkAdornment?.values?.['linkURL'] ?? String(value)) as string
const colorMap = (chipAdornment?.values?.['colorMap'] ?? {}) as Record<string, string>
```

These `as` casts are necessary because adornment `values` is `Record<string, unknown>`. The type information exists in the backend but isn't modeled.

**Recommended Fix:** Discriminated union types for adornments:
```typescript
type LinkAdornment = { type: 'LINK'; values: { linkURL: string } }
type ChipAdornment = { type: 'CHIP'; values: { colorMap: Record<string, string> } }
export type FieldAdornment = LinkAdornment | ChipAdornment | IconAdornment | ...
```
Eliminates all `as` casts in FieldValue.

---

### CQ-HIGH-4: Magic Numbers and Strings Scattered Throughout
- `use-record-query.ts:246` — `[10, 25, 50, 100].includes(n)` — hardcoded page sizes
- `RecordQuery.tsx:75` — `400` ms debounce
- `FilterBuilder.tsx:560` — `300` ms debounce
- `DataGrid.tsx:41-51` — density class maps inline
- `FieldValue.tsx:1024` — bytes-per-KB hardcoded

**Fix:**
```typescript
// src/lib/constants.ts
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export const SEARCH_DEBOUNCE_MS = 400
export const COMBOBOX_DEBOUNCE_MS = 300
```

---

### CQ-HIGH-5: `use-process` — Stale Closure via Manual `stateRef`
**File:** `src/lib/hooks/use-process.ts`, lines 105-128

```typescript
const stateRef = useRef(state)
stateRef.current = state
// later: stateRef.current.stepValues
```

Manually syncing a ref to shadow state is a sign that the polling subscription (lines 249-268) is too coupled to mutable state. This pattern is fragile and indicates the state management design needs simplification.

---

### CQ-HIGH-6: Dead Toolbar Button
**File:** `src/components/query/RecordQuery.tsx`, lines 394-401

A "Settings / more" button has an aria-label but no onClick handler — it does nothing. Either wire it up or remove it.

---

## MEDIUM Quality Issues

### CQ-MED-1: `use-record-query` — `effectiveFilter` Depends on Unrelated State
**File:** `src/lib/hooks/use-record-query.ts`, lines 317-332

`effectiveFilter` is recomputed when `state.columnVisibility` changes, but column visibility has nothing to do with filters. The dependency array is over-inclusive.

---

### CQ-MED-2: Boolean Operator Type is Raw String Cast
**File:** `src/components/query/FilterBuilder.tsx`, lines 196-198

```typescript
onChange({ ...filter, booleanOperator: e.target.value as 'AND' | 'OR' })
```

Should use a const assertion or enum to avoid typo risk:
```typescript
const BOOLEAN_OPERATORS = ['AND', 'OR'] as const
type BooleanOperator = typeof BOOLEAN_OPERATORS[number]
```

---

### CQ-MED-3: FieldValue — Repeated URL/Email Pattern Matching
**File:** `src/components/records/FieldValue.tsx`, lines 294, 339, 358

Three separate URL/email regex checks scattered across the file. Extract to:
```typescript
// src/lib/utils/string-utils.ts
export const isUrl = (s: string) => /^https?:\/\//i.test(s) || s.startsWith('/')
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
```

---

### CQ-MED-4: RecordView — Redundant Section Fallback Logic
**File:** `src/components/records/RecordView.tsx`, lines 234-289

```typescript
const primarySections = visibleSections.filter(s => !s.tier || s.tier === 'T1' || s.tier === 'basic')
// ...
const t1Sections = primarySections.length > 0 ? primarySections : visibleSections
```

The fallback `? primarySections : visibleSections` is redundant if all sections without explicit tiers are already included in `primarySections`. Simplify or add a comment explaining when this fallback fires.

---

### CQ-MED-5: Missing Error Boundaries Below Route Level
Only `src/app/error.tsx` provides an error boundary. Forms and record views should have their own boundaries to prevent full-page crashes from single component errors.

---

### CQ-MED-6: `FilterBuilder` — `subs` Variable Name
**File:** `src/components/query/FilterBuilder.tsx`, line 178

```typescript
const subs = filter.subFilters ?? []
```

Should be `subFilters` for clarity.

---

## LOW / Style Issues

- **`data-qqq-id` inconsistency** — Mix of `grid-select-row-${row.index}` (underscores), `filter-field-${depth}-${index}` (hyphens). Standardize to kebab-case throughout.
- **Abbreviations:** `initVals` → `initialValues` (`use-record-query.ts:257`), `ej` → `exposedJoin` (`use-record-query.ts:348`), `pk` → `primaryKey` (DataGrid, RecordView), `subs` → `subFilters`
- **Import ordering:** `FilterBuilder.tsx` imports lucide-react after custom hooks. Project convention is: React → External → Types → Lib → Components.
- **Missing JSDoc:** `buildQuickFilterFromState()` (use-record-query.ts), `getErrorStatusCode()` (RecordView.tsx), `zodFieldFromMetadata()` (zod-from-metadata.ts) — all complex enough to warrant a one-liner doc comment.
- **Unnecessary `useMemo`:** `joins` calculation in `use-record-query.ts:345-354` is a simple object map — too cheap to justify memoization overhead.
- **Unused import:** `SelectField` in `DynamicFormField.tsx` (identified in prior review).
- **`window.innerWidth` in callback** — `RecordQuery.tsx:127-134` — not reactive to resize events.

---

## Positive Patterns Worth Preserving

1. **Metadata-Driven Rendering** — entire UI derived from backend metadata, zero hardcoded field/table names.
2. **Query Key Factory Pattern** — `queryKeys.tableRecords(tableName)` prevents string-based cache bugs.
3. **TanStack Query Usage** — proper staleTime, placeholderData, manual pagination, invalidation. No over-fetching.
4. **Typed API Layer** — all `src/lib/api/` functions properly typed, good use of discriminated unions for responses.
5. **Filter Serialization** — `serializeFilter()` / `deserializeFilter()` correctly handle shareable URLs.
6. **Debouncing** — SearchInput and FilterBuilder correctly debounce and clean up.
7. **Tailwind + CSS Custom Properties** — consistent theming without inline styles.
8. **Accessibility Fundamentals** — ARIA labels, roles, keyboard handling are present throughout.

---

## Recommended Fix Priority

| Priority | Item | Effort |
|----------|------|--------|
| 1 | CQ-CRIT-2: Extract `useAsyncCombobox` hook (FilterBuilder) | Medium |
| 2 | CQ-CRIT-3: `buildStringSchema()` helper in zod-from-metadata | Small |
| 3 | CQ-CRIT-4: Centralize `getErrorStatusCode()` utility | Small |
| 4 | CQ-HIGH-3: Discriminated union types for adornments | Medium |
| 5 | CQ-HIGH-4: Extract constants to `src/lib/constants.ts` | Small |
| 6 | CQ-HIGH-6: Remove or wire dead toolbar button | Trivial |
| 7 | CQ-HIGH-2: `React.memo` on FilterBuilder subcomponents | Small |
| 8 | CQ-MED-3: Extract URL/email utils | Small |
| 9 | CQ-CRIT-1: Split `use-record-query` into focused hooks | Large |
| 10 | CQ-HIGH-1: Extract RecordQuery toolbar subcomponents | Medium |
