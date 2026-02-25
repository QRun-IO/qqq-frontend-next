# Review Checklist: Package 5 — Dashboard and Widgets

### Requirements Coverage
- [ ] Section 5.2.2: App Home page with dashboard layout
- [ ] Section 5.3.6: Widget container (label, reload, export, dropdown, help)
- [ ] Section 5.3.6: All chart types (line, bar, horizontal bar, stacked bar, pie)
- [ ] Section 5.3.6: Statistics cards (mini, multi, standard)
- [ ] Section 5.3.6: All block types (text, bigNumber, upOrDown, progress, button, icon, image, audio, divider, input)
- [ ] Section 5.3.6: Record grid widget with CRUD
- [ ] Section 5.3.6: Composite and parent widgets
- [ ] Section 5.3.6: Widget dropdown selections with possible values
- [ ] Section 5.3.6: Specialized widgets (pivot table, CRON, script viewer, custom component)
- [ ] Section 3.6: GET /widget/{widgetName} with dynamic params

### Integration Check
- [ ] DataGrid reused from Package 2 for record grid widget
- [ ] EntityForm reused from Package 3 for dynamic form widget
- [ ] Widget sections on Record View (Package 3) can render these widgets
- [ ] Process step type WIDGET delegates to widget container
- [ ] App Home accessible via sidebar navigation (Package 1)

### API Contract Compliance
- [ ] GET /qqq/v1/widget/{widgetName} — correct path with dynamic query params
- [ ] Dropdown selection values passed as query params
- [ ] Request deduplication: abort previous request on dropdown change
- [ ] Widget data response handled polymorphically per widget type
- [ ] Error responses show per-widget error (not crash entire page)

### Metadata-Driven Check
- [ ] Widget list from QAppMetaData.widgets (no hardcoded widget names)
- [ ] Widget grid layout from QWidgetMetaData.gridColumns
- [ ] Dropdown options from QWidgetMetaData.dropdowns + possibleValues API
- [ ] Widget label from metadata
- [ ] showReloadButton/showExportButton from metadata
- [ ] Help content from metadata

### Responsive Check
- [ ] Widget grid: 1-column on mobile, 2-column on tablet, N-column on desktop
- [ ] Charts resize responsively (ResponsiveContainer)
- [ ] Statistics cards stack vertically on mobile
- [ ] Record grid widget scrolls horizontally on small screens
- [ ] Widget dropdowns usable on touch devices

### Accessibility Check
- [ ] Charts have aria-label with data summary
- [ ] Statistics cards have descriptive text (not just numbers)
- [ ] Reload/export buttons have aria-label
- [ ] Widget container has role="region" with aria-label
- [ ] Audio player has accessible controls
- [ ] Image blocks have alt text

### Type Safety Check
- [ ] Widget data typed per widget type (no raw `any` for response)
- [ ] Block type discriminated union
- [ ] Chart dataset typed
- [ ] Record grid widget uses QRecord[] type
- [ ] Dropdown values typed as QPossibleValue[]
