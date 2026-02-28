# RecordQuery Feature Gap Analysis
_Generated: 2026-02-28_

## Summary

The new RecordQuery implementation covers the core query-page surface area well: quick search, advanced filter builder with nested AND/OR groups and possible-value comboboxes, server-side pagination, single-column sort, column show/hide/reorder with drag-and-drop, column resize, saved views, CSV export, bulk process launch, row selection, density picker, grid/card view toggle, variant picker, and mobile filter bottom-sheet. The foundation is solid and the hook architecture (`useRecordQuery`) is clean.

The primary gaps fall into three categories: (1) **multi-column sort** — the DataGrid sort handler replaces the entire sort array on every click instead of appending to it, so only one column can be sorted at a time; (2) **join-aware filtering** — the FilterBuilder only lists columns from the primary table; joined-table fields exposed via `exposedJoins` cannot be added as filter criteria even though the backend type (`QFilterCriteria`) has no `joinName` field and uses dot-notation `fieldName` instead; (3) **select-all-across-pages / bulk delete** — the selection affordance is page-scoped (only rows visible on the current page can be checked) and the BulkActionBar's delete button is wired up to an `onDeleteSelected` prop that `RecordQuery` never passes, so bulk delete is dead code.

Several lower-impact features from the legacy implementation are also absent: per-row action buttons (edit/delete inline on each row), inline cell editing, and distinct-count display.

---

## Feature Inventory

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-column sort | ⚠️ Partial | State and API types support multiple `orderBys`, but `handleSortColumn` in `DataGrid.tsx` calls `onSortChange([{ fieldName, isAscending: true }])` — a single-element array — on every click, replacing any prior sort. Shift-click to append a secondary sort is not implemented. |
| Join filters | ⚠️ Partial | `use-record-query.ts` derives `QueryJoin[]` from `exposedJoins` and sends them to the API. However `FilterBuilder.tsx` builds its field list solely from `tableMetaData.fields` and has no awareness of joined-table fields. Users cannot add filter criteria on joined columns. The `QFilterCriteria` type uses dot-notation `fieldName` (e.g. `"joinedTable.fieldName"`) rather than a separate `joinName` property, so the backend contract is compatible — the UI just never produces such criteria. |
| Bulk select across pages | ❌ Not implemented | The select-all checkbox (`grid-select-all`) selects only rows on the current page (TanStack Table `getToggleAllRowsSelectedHandler`). There is no "Select all N matching records" affordance analogous to the legacy "select all" banner. The `BulkActionBar` shows `"{selected} of {total} selected"` but has no way to extend selection beyond the page. |
| Export | ✅ Implemented | `ExportButton.tsx` supports three scopes: all records (up to 10,000), current page, and selected records. CSV is built client-side from visible/ordered fields and downloaded via a temporary `<a>` element. No server-side export endpoint is called; this may diverge from the legacy approach for very large datasets or Excel format support. |
| Inline edit | ❌ Not implemented | `DataCell.tsx` is read-only. There is no double-click-to-edit or pencil-icon affordance on any cell. The legacy implementation offered inline editing on editable fields. |
| Saved views | ✅ Implemented | `SavedViewsMenu.tsx` and the `views` namespace in `use-record-query.ts` fully implement save / load / delete of named views persisted to `localStorage`. Views capture filter, column visibility, column order, and sort order. |
| Quick search | ✅ Implemented | Debounced input in `RecordQueryToolbar.tsx` drives an OR-joined `CONTAINS` search across all visible `STRING`/`TEXT` columns. Mutually exclusive with the advanced filter panel. |
| Column resizing | ✅ Implemented | `DataGrid.tsx` implements mousedown/mousemove/mouseup column resize with a minimum width of 60 px. Widths are persisted to `localStorage` via `useRecordQuery`. Resize listeners are cleaned up on unmount. |
| Column reordering | ✅ Implemented | `ColumnConfig.tsx` supports HTML5 drag-and-drop reordering as well as keyboard Up/Down arrow keys on the grip button. Order is persisted to `localStorage`. Drag-reorder directly in the grid header is not implemented (only via the side panel). |
| Pinned columns | ❌ Not implemented | No sticky/pinned column support. TanStack Table supports column pinning but it is not wired up. |
| Bulk actions | ⚠️ Partial | Process launch from the bulk bar works (`ProcessLauncherMenu` inside `BulkActionBar`). Bulk delete is dead code — `BulkActionBar` renders a Delete button only when `onDeleteSelected` is provided, but `RecordQueryBulkBar.tsx` never passes that prop. There is no "delete selected" handler anywhere in `RecordQuery.tsx`. |
| Row-level actions | ❌ Not implemented | Each row navigates to the record detail view on click but has no per-row action buttons (edit pencil, delete trash, custom process). The legacy implementation rendered per-row action icon buttons in a trailing "actions" column. |
| Pagination | ✅ Implemented | Standard offset-based pagination with first/prev/next/last buttons, a page-size selector (10/25/50/100/250), and a "Go to page" input when `totalPages > 5`. Controlled by `use-record-query.ts`. |
| Distinct count | ⚠️ Partial | `countRecords` in `tables.ts` accepts `includeDistinct = false` as a third parameter and the `CountRecordsResponse` type includes `distinctCount?`. However `use-record-query.ts` always calls `countRecords(tableName, { filter: countFilter, joins }, false)` (or omits the flag, defaulting to `false`) and the UI never reads or displays `distinctCount`. The infrastructure is there; it is just never invoked or surfaced. |

---

## Priority Gaps (implement these next)

Ranked by user-visible impact on day-to-day admin usage:

1. **Multi-column sort** — High impact, low effort. Change `handleSortColumn` in `DataGrid.tsx` to detect a Shift-click and append/toggle the clicked column in the existing `sortOrder` array rather than replacing it. Update the column header button to accept a `shiftKey` event attribute. The `QFilterOrderBy[]` structure and API calls already support multiple entries.

2. **Join filters** — High impact, medium effort. Extend `FilterBuilder.tsx` to accept a `joinedFields` prop (or derive it from `tableMetaData.exposedJoins`). Prefix each joined field's display label with the join table label (e.g. "Order → Customer Name"). Use dot-notation fieldName (e.g. `"customer.name"`) in the emitted `QFilterCriteria`. The backend already expects this format.

3. **Bulk select across pages** — Medium impact, medium effort. Add a "Select all {N} records" banner that appears below the bulk-action bar when the page-scoped selection equals `pageSize` and `totalCount > pageSize`. Store a `selectAllMode: boolean` flag in state. When `true`, submit the current filter as the selection scope to process launches rather than the explicit ID list.

4. **Bulk delete** — Medium impact, low effort. Wire up `onDeleteSelected` in `RecordQuery.tsx` (and pass it through `RecordQueryBulkBar`). Implement a confirmation dialog, call `deleteRecord` in a loop (or a future bulk-delete endpoint), then invalidate the records query.

5. **Row-level actions** — Medium impact, medium effort. Add an "actions" column to `DataGrid.tsx` as the last column. Render icon buttons for Edit (navigate to `/{tableName}/{id}/edit`), Delete (single-record confirmation modal), and optionally a per-row process dropdown if the table's `processes` array contains single-record processes. Guard each button on the respective permission flag from `tableMetaData`.

6. **Pinned columns** — Low-to-medium impact, medium effort. Enable TanStack Table's `columnPinning` feature. Add a "Pin left" option to the `ColumnConfig` panel or a column header context menu. Apply `position: sticky; left: 0` styling to pinned headers and cells. Persist the pinned set to `localStorage` alongside visibility and order.

7. **Distinct count display** — Low impact, low effort. Pass `includeDistinct = true` in `countRecords` when `tableMetaData.usesVariants` is true or when the query includes a join with `type: 'LEFT'`. Read `countQuery.data?.distinctCount` and display it alongside or instead of the plain count in the `Pagination` component.

8. **Inline edit** — Low impact (admin use case), high effort. On double-click of an editable cell, swap `DataCell` for a `DataCellEditor` component that renders an appropriate input (text, number, date, possible-value combobox). On blur or Enter, call `updateRecord` and invalidate the query cache. Requires a new `DataCellEditor` component, field-type-aware input selection, and optimistic update handling.

---

## Reference Implementation Notes

The following patterns from the legacy `RecordQuery.tsx` (MUI + React) are worth preserving or adapting as the new implementation matures:

- **Multi-column sort via Shift-click:** The legacy grid accumulates `orderBys` entries when the user holds Shift while clicking a column header. This is the industry-standard UX (matching MUI DataGrid Pro) and should be replicated exactly.

- **Join filter field grouping:** The legacy FilterBuilder groups fields under their parent table heading in the field selector dropdown (e.g. a separator "— Order fields —" followed by "— Customer fields —"). This makes joined fields discoverable rather than mixed into a flat list.

- **Select-all banner:** When the user selects all rows on the current page, a blue banner appears: "All 25 records on this page are selected. Select all 1,247 records matching your filter." Clicking the link sets a `filterOnlyMode` flag that replaces the ID list with the filter in process invocations.

- **Per-row action icons:** The legacy grid renders three small icon buttons at the end of every row (view, edit, delete) that are hidden until hover. They are absolutely positioned so they do not affect column widths. The new DataGrid's trailing-column approach is acceptable but should use `opacity-0 group-hover:opacity-100` CSS to avoid visual noise.

- **Export via server endpoint (Excel):** The legacy implementation calls a dedicated server-side export endpoint (`POST /table/{name}/export`) that returns an Excel file stream. The current implementation builds a CSV client-side from the raw query results. This has a hard limit of 10,000 rows and produces only CSV. For parity, a server-side export endpoint call should be added; the client-side fallback can remain for smaller datasets.

- **Distinct count in count query:** The legacy implementation passes `includeDistinctCount=true` for tables that use joins, and displays "N (M distinct)" in the pagination footer when `distinctCount < count`. This helps users understand that a LEFT join is inflating the row count.

- **Filter variable expressions (NOW, NOW\_WITH\_OFFSET):** The legacy FilterBuilder renders dedicated UI controls for dynamic date expressions so users can save filters like "created in the last 7 days" that remain accurate over time. The types (`NowExpression`, `NowWithOffsetExpression`, `ThisOrLastPeriodExpression`) are already defined in `src/types/query.ts` and `filter-utils.ts` includes type guards and display formatting for them, but the `FilterBuilder` UI never offers these expressions as selectable value options — only static scalar inputs are rendered.
