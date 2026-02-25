# Review Checklist: Package 3 — Record View and CRUD

### Requirements Coverage
- [ ] Section 5.2.3: Record view at /app/{tableName}/{recordId}
- [ ] Section 5.2.3: Create at /app/{tableName}/create
- [ ] Section 5.2.3: Edit at /app/{tableName}/{recordId}/edit
- [ ] Section 5.2.3: Copy at /app/{tableName}/{recordId}/copy
- [ ] Section 5.3.2: Section-organized field display (T1 and non-T1)
- [ ] Section 5.3.2: Field value rendering for all 12 QFieldTypes
- [ ] Section 5.3.2: All adornment types rendered (LINK, CHIP, SIZE, FILE_DOWNLOAD, etc.)
- [ ] Section 5.3.3: Dynamic form generation from QFieldMetaData
- [ ] Section 5.3.3: Possible values autocomplete with debounced search
- [ ] Section 5.3.3: File upload fields
- [ ] Section 5.3.3: Boolean switch (null/false/true)
- [ ] Section 5.3.3: Date/time pickers
- [ ] Section 5.3.3: Rich text editor for HTML fields
- [ ] Section 5.4.2: Responsive view (single-column mobile, multi-column desktop)
- [ ] Section 5.4.2: Responsive form (single-column mobile, gridColumns tablet+)
- [ ] Section 3.4.3: GET /table/{t}/{id} for single record
- [ ] Section 3.4.4: POST /table/{t} for insert
- [ ] Section 3.4.5: PUT /table/{t}/{id} for update
- [ ] Section 3.4.6: DELETE /table/{t}/{id} for delete
- [ ] Section 3.7: Possible values endpoint integration

### Integration Check
- [ ] Imports from Package 1: types, API client, queryKeys, QContext
- [ ] Record View navigates back to Record Query (Package 2)
- [ ] Action menu can launch processes (Package 4 route)
- [ ] Widget sections delegate to Package 5 components (or stubs)
- [ ] Delete navigates back to query page
- [ ] Unsaved changes prompt before navigation

### API Contract Compliance
- [ ] GET /qqq/v1/table/{tableName}/{primaryKey} — includes associations param
- [ ] POST /qqq/v1/table/{tableName} — multipart/form-data with field values
- [ ] PUT /qqq/v1/table/{tableName}/{primaryKey} — multipart/form-data
- [ ] DELETE /qqq/v1/table/{tableName}/{primaryKey} — returns deletedCount
- [ ] POST .../possibleValues/{fieldName} — searchTerm, debounced 300ms
- [ ] Error responses (403, 404, 500) handled gracefully

### Metadata-Driven Check
- [ ] Form fields generated from QTableMetaData.sections → fieldNames → QFieldMetaData
- [ ] Section layout follows sections metadata (T1 at top)
- [ ] gridColumns from section metadata controls form layout
- [ ] Field labels from metadata (never field names)
- [ ] isEditable respected (read-only fields in edit mode)
- [ ] isRequired reflected in Zod schema and visual indicator
- [ ] isHidden fields excluded from view and form
- [ ] isHeavy fields lazy-loaded or excluded from initial fetch
- [ ] Possible values sourced from possibleValueSourceName metadata

### Responsive Check
- [ ] Record View: single-column stacked sections on mobile
- [ ] Record View: collapsible sections on mobile
- [ ] Entity Form: single-column on mobile, gridColumns on desktop
- [ ] Action menu: bottom sheet on mobile, dropdown on desktop
- [ ] Save/Cancel buttons: sticky at bottom on mobile

### Accessibility Check
- [ ] All form inputs have associated <label> elements
- [ ] Required fields marked with aria-required="true"
- [ ] Invalid fields marked with aria-invalid="true" and aria-describedby
- [ ] Delete confirmation dialog traps focus
- [ ] Keyboard shortcuts documented and displayed (n, e, c, d, a)
- [ ] Help tooltips accessible via keyboard (not just hover)
- [ ] File upload has accessible label and drag-drop instructions

### Type Safety Check
- [ ] Form state typed with Zod schema inference (z.infer<typeof schema>)
- [ ] QRecord type used for all record data
- [ ] Field rendering switches on QFieldType enum (exhaustive)
- [ ] Adornment rendering switches on AdornmentType enum
- [ ] No `any` in form submission handlers
