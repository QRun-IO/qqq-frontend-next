# Review Checklist: Package 2 — Record Query

### Requirements Coverage
- [ ] Section 5.2.3: Record query page at /app/{tableName} renders
- [ ] Section 5.3.2: Data grid with server-side pagination, sorting, filtering
- [ ] Section 5.3.5: Basic filter (quick search) and advanced filter builder
- [ ] Section 5.3.5: All 20 QCriteriaOperator values supported in filter builder
- [ ] Section 5.3.5: AND/OR boolean logic and sub-filters
- [ ] Section 5.3.5: Column configuration (show/hide, reorder)
- [ ] Section 5.3.5: Saved views (save/load/delete)
- [ ] Section 5.3.5: Export to CSV
- [ ] Section 5.3.5: Pagination with page size selector (10/25/50/100)
- [ ] Section 5.3.5: Table variant selection
- [ ] Section 5.4.2: Mobile card view alternative
- [ ] Section 3.4.1: POST /table/{t}/query with correct filter shape
- [ ] Section 3.4.2: POST /table/{t}/count for total count
- [ ] Section 3.7: Possible values for filter field dropdowns
- [ ] Section 3.9: Offset/limit pagination (skip = (page-1) * pageSize)
- [ ] Section 3.10: Tree-structured filters with subFilters

### Integration Check
- [ ] Imports from Package 1 resolve: types, API client, queryKeys, QContext, layout
- [ ] Page renders within dashboard layout with sidebar and breadcrumbs
- [ ] Row click navigates to /app/{tableName}/{recordId} (Package 3 route)
- [ ] Create button navigates to /app/{tableName}/create (Package 3 route)
- [ ] Process launcher invokes process routes (Package 4)
- [ ] Toolbar integrates with QContext (setPageHeader, setTableMetaData)

### API Contract Compliance
- [ ] POST /qqq/v1/table/{tableName}/query — JSON body with filter object
- [ ] POST /qqq/v1/table/{tableName}/count — same filter structure
- [ ] POST /qqq/v1/table/{tableName}/possibleValues/{fieldName} — correct form data
- [ ] Response shapes match: { records: QRecord[] } and { count, distinctCount? }
- [ ] Query deduplication prevents stale results from overwriting fresh
- [ ] Joins passed when exposedJoins present on table metadata

### Metadata-Driven Check
- [ ] Columns generated from QTableMetaData.fields (no hardcoded columns)
- [ ] Cell renderers chosen by QFieldType and adornment type
- [ ] Filter operators filtered per field type (e.g., no CONTAINS on INTEGER)
- [ ] Create button shown only if insertPermission is true
- [ ] Table label used in page header (not table name)
- [ ] Hidden fields (isHidden) excluded from default column set

### Responsive Check
- [ ] Desktop: full data grid with toolbar, filters, pagination
- [ ] Tablet: horizontal scroll data grid, sticky first column
- [ ] Mobile: card-based list view as alternative to grid
- [ ] Filter panel adapts to screen size (bottom sheet on mobile)
- [ ] Pagination controls usable at all breakpoints

### Accessibility Check
- [ ] Data grid has role="grid" or role="table"
- [ ] Column headers have scope="col"
- [ ] Sort buttons have aria-sort attribute
- [ ] Filter inputs have labels
- [ ] Row selection checkboxes have aria-label
- [ ] Keyboard navigation within grid (arrow keys, Tab)
- [ ] Page size selector is a labeled select

### Type Safety Check
- [ ] QQueryFilter type used for all filter construction
- [ ] QRecord[] typed for query results
- [ ] Column definitions typed as ColumnDef<QRecord>[]
- [ ] No `any` in filter builder state
- [ ] Export function parameter typed
