# Next UI developer guide

This guide describes the `feature/next-1.0` release worktree as of 2026-09-28. It explains the current frontend and backend metadata contract. The source is versioned `1.0.0` for release preparation; check the published Maven artifact and image before treating that version as available. For behavior proven against a real server use the [feature matrix](../acceptance/feature-matrix.md); for the full Material inventory use the [parity ledger](../acceptance/material-parity.md). Some ledger rows predate recent work, so verify an individual status against current source and acceptance results before making a release claim.

The visual baseline is the September 25 Next UI design (`e42ad2b2`). Material remains the reference for backend contracts and functional behavior. The layout defaults below describe current source; they do not certify a completed visual review.

## 1. What an application supplies

QQQ supplies an instance metadata document with `apps`, ordered `appTree`, `tables`, `processes`, `reports`, `widgets`, and `branding`; help content, environment values, supplemental metadata, and redirect rules may also be present. The UI renders those objects for the signed-in user's permissions. A table, widget, or route name is an internal identifier; its `label` is the text users see. Define names and behavior on the backend, then verify the versioned metadata response. Do not edit the frontend to add an application-specific table or menu item.

The source of truth for the frontend shape is [`src/types/metadata.ts`](../../src/types/metadata.ts). A small, **partial response fragment** illustrates the relationships; it is not a complete `QInstance` response:

```json
{
  "appTree": [{ "name": "operations", "label": "Operations", "type": "APP", "children": [{ "name": "orders", "label": "Orders", "type": "TABLE" }] }],
  "apps": { "operations": { "name": "operations", "label": "Operations", "widgets": ["ordersToday"], "sections": [{ "name": "work", "label": "Work", "tables": ["orders"] }] } },
  "widgets": { "ordersToday": { "name": "ordersToday", "label": "Orders today", "type": "statistics", "hasPermission": true, "gridColumns": 4 } },
  "branding": { "appName": "Operations", "accentColor": "#1d4ed8" }
}
```

`appTree` controls the sidebar; `apps[name].widgets` controls ordered dashboard widgets; `apps[name].sections` controls the app home cards. The server may omit denied objects or send disabled permission flags; the frontend also checks flags before requesting data. The server must still enforce authorization. A widget can also be placed in a table section through `QTableSection.widgetName`, or embedded in a process step of type `WIDGET`. `QInstance.redirects` can map old exact or wildcard Material paths to new targets. `supplementalInstanceMetaData.materialDashboardTheme` supplies the application theme, and `environmentValues` can configure analytics.

## 2. Install and run

The preferred QQQ-hosted distribution is the `com.kingsrook.qqq:qqq-frontend-next` Maven jar. A QQQ 4.1+ application's `QApplicationJavalinServer` serves its static export from `next-dashboard/` at `/` on the same origin as `/qqq/v1`. The [repository README](../../README.md) and [jar README](../maven-artifact/README.md) describe this packaging. The QQQ [sample quickstart](https://github.com/QRun-IO/qqq/blob/main/qqq-sample-project/README.md#quickstart-with-next) exercises the packaged path. Material can be selected with `withServeFrontendMaterialDashboard(true)` or `-Dqqq.javalin.frontend=material`; do not assume Material and Next use the same URL layout.

```xml
<dependency>
    <groupId>com.kingsrook.qqq</groupId>
    <artifactId>qqq-frontend-next</artifactId>
</dependency>
```

For frontend development, use a compatible Node.js version (the README specifies 20.19+ or 22.12+) and pnpm 9.15.9:

```bash
pnpm install
NEXT_PUBLIC_MOCK_API=true pnpm dev
pnpm build:export
pnpm build:jar
```

The mock setting is for isolated development. Set `NEXT_PUBLIC_MOCK_API=false` and connect a real QQQ backend for integration. `build:export` writes `out/`; `build:jar` packages it with Maven. The Maven POM enforces the presence of static placeholder pages. The default `pnpm build` instead creates a standalone Node server, whose `QQQ_BACKEND_URL` build setting adds same-origin rewrites. For the container path see [`docker/quickstart/Dockerfile`](../../docker/quickstart/Dockerfile). Source version `1.0.0` is a release candidate until the Maven artifact is published and verified.

| Setting | Behavior in this checkout |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Defaults to `/qqq/v1`; baked into browser requests. Keep the UI and API on the same origin where possible. |
| `NEXT_PUBLIC_MOCK_API` | `true` enables MSW development fixtures; `build:export` forces `false`. |
| `QQQ_NEXT_OUTPUT` | `export` selects the Javalin-hosted static export; otherwise standalone build. |
| `QQQ_BACKEND_URL` | Standalone build only: backend origin for Next rewrites; fixed at build time. |
| `NEXT_PUBLIC_APP_VERSION` | Optional version reported to the backend; defaults to `package.json` version. |

The static export is built for `/`, with `trailingSlash: true`. QQQ serves placeholder HTML for dynamic route shapes; [`useRouteParams`](../../src/lib/hooks/use-route-params.ts) reads real path segments from the browser. Keep that behavior intact when adding routes. The [parity ledger](../acceptance/material-parity.md) currently lists sub-path hosting as unsupported. A plain file server without the QQQ route fallback is not a valid deep-link test.

## 3. Authentication and security

`GET /qqq/v1/metaData/authentication` selects `AUTH_0`, `OAUTH2`, `FULLY_ANONYMOUS`, `MOCK`, or `TABLE_BASED` (see [`QAuthenticationMetaData`](../../src/types/metadata.ts) and [`auth-provider.tsx`](../../src/lib/auth/auth-provider.tsx)). OAuth flows use authorization code and PKCE; table-based sign-in sends credentials to the QQQ session endpoint. The server issues `sessionUUID`/`sessionId` cookies; current Next code resumes an existing session with an empty `manageSession` request, allowing HttpOnly cookies that browser script cannot read. Browser API calls use credentials. A 401 clears session state and returns to sign-in. The pre-login response exposes only limited login branding, not banners or custom CSS. Authentication metadata is cached briefly; `?clearAuthenticationMetaDataLocalStorage` clears that cache.

Existing provider registrations remain usable: OAUTH2 redirects to `{origin}/token`, while AUTH_0 redirects to `{origin}/`. Both use the same state-checked PKCE callback. A state-matched provider denial displays its description once on the login page; a forged callback or direct login link shows only a safe generic error.

Permissions apply to metadata and data: check table capabilities and the corresponding read/insert/edit/delete flags, `process.hasPermission`, `report.hasPermission`, and `widget.hasPermission`. A disabled widget can show a permission message without fetching; omitted metadata cannot be guessed from the UI. Use the backend to prove a forbidden operation is rejected. HTML from metadata or widget payloads is sanitized before display. Treat theme `customCss` and custom component bundles as trusted application configuration with a stricter review boundary. The Javalin dashboard and standalone Next server configure security headers and CSP; embedding an external provider needs an allowed source, not a disabled policy. The [security review](../security/next-ui-review.md) is an earlier audit; compare its follow-ups with current code and the latest acceptance gate before treating them as resolved.

## 4. Navigation and deep links

[`useAppTreeRoutes`](../../src/lib/hooks/use-routes.ts) recursively walks `appTree` to build sidebar links, labels, ancestor breadcrumbs, and the first accessible app. `APP` nodes nest; visible `TABLE`, `PROCESS`, and `REPORT` nodes navigate to `/app/{name}`. Hidden objects are omitted from navigation but can still have direct routes when authorized. An app home uses its `widgets` and `sections`; a table slug opens its query page; a process slug opens its wizard; a report slug opens its runner. The unified route resolves name collisions in that order: app, table, process, report. Use unique names across these maps.

| URL | Screen |
|---|---|
| `/` | Opens `/app`, or handles an Auth0 authorization callback. |
| `/login`, `/callback`, `/token` | Sign-in and supported authorization callback routes. |
| `/app` | Instance dashboard / app entry point. |
| `/app/{appName}` | App home and its ordered widgets/sections. |
| `/app/{tableName}` | Query or key lookup, according to table capability. |
| `/app/{tableName}/create` | Create record. |
| `/app/{tableOrProcessName}/dev` | Table or process developer view; table takes precedence. |
| `/app/{tableName}/{recordId}` | Record view; `/edit`, `/copy`, and `/dev` are subroutes. |
| `/app/{tableName}/{recordId}/createChild/{childTable}` | Child create form with parent association values. |
| `/app/{tableName}/{recordId}/{processName}` | Resolves a permitted table process and redirects to its runner with record and return context. |
| `/app/{tableName}/key?...` | Unique-key lookup. |
| `/app/{tableName}/savedView/{viewId}` | Server-backed saved query view. |
| `/app/{processName}` | Process run. |
| `/app/{reportName}` | Report run and download. |
| `/app/search?q=...` | Navigation, recent-record, and available record search results. |
| `/app/developer` | Developer information available to permitted users. |

The header search and `/` dialog locate navigation targets and recent records; record search is offered when the backend supports it. The command palette opens with `.` or Cmd/Ctrl+K and has a header button; `?` opens keyboard help. Keyboard shortcuts on query and record pages are listed in the [feature matrix](../acceptance/feature-matrix.md). The sidebar has a phone drawer, nested app groups, banners, and a user menu. Branding can add a company footer and a themed bar above the shell. `?helpHelp` reveals help-slot keys for content authors.

Material's nested `/{app}/{table}/{id}` URLs are not the native Next route. A not-found page now checks the signed-in instance metadata, applies exact or `/*` redirect rules, and resolves nested Material app paths to `/app/...` while preserving query/hash ([`legacy-paths.ts`](../../src/lib/utils/legacy-paths.ts), [`LegacyPathRedirect.tsx`](../../src/components/layout/LegacyPathRedirect.tsx)). Verify a specific old bookmark rather than assuming arbitrary legacy URLs match. For links generated by widgets use [`material-links.ts`](../../src/lib/utils/material-links.ts), which normalizes supported legacy links and preserves a trailing slash for static-export routes.

## 5. Tables, queries, records, and forms

Tables are described by [`QTableMetaData`](../../src/types/metadata.ts): `primaryKeyField`, `fields`, `sections`, `associations`, `exposedJoins`, capabilities, and permission flags. A field supplies `name`, `label`, `type`, `isRequired`, `isEditable`, `isHeavy`, `isHidden`, and `adornments`; possible values, bounds, formats, and help are optional. The supported primitive field types are `STRING`, `INTEGER`, `LONG`, `DECIMAL`, `BOOLEAN`, `DATE`, `TIME`, `DATE_TIME`, `TEXT`, `HTML`, `PASSWORD`, and `BLOB`. [`DynamicFormField`](../../src/components/forms/DynamicFormField.tsx) chooses editors, while [`zod-from-metadata.ts`](../../src/lib/utils/zod-from-metadata.ts) builds validation. Configure fields in QQQ metadata, not in a per-table React component.

Table dashboard settings are read from `supplementalMetaData.materialDashboard` in the v1 response, with `supplementalTableMetaData.materialDashboard` accepted as a legacy fallback. The v1 object takes precedence when both are present. These settings include `defaultQuickFilterFieldNames`, `gotoFieldNames`, `showRecordSidebar`, and `recordViewActionsPlacement`. Quick-filter defaults use the configured nonempty field list, otherwise T1 section fields; unresolved names and duplicates are removed. Query-selectable `virtualFields` also become columns, but only virtual fields with `isQueryCriteria` can be filtered or sorted.

For a fixed choice list, put `inlinePossibleValueSource` on the QQQ field with `type: ENUM`, an `idType` matching the field, and ordered `enumValues` containing `id` and `label`. Do not also set `possibleValueSourceName`: QQQ rejects both sources on one field. Next filters inline labels by prefix without a possible-values request and stores the selected `id`. A `CHIP` field adornment with keys such as `color.HIGH` and `icon.HIGH` styles both record values and form options. The v1 table metadata response must include the inline source; [REC-062](../acceptance/feature-matrix.md) verifies its rendering, persistence, and reload against the sample server.

The query page supports basic quick-filter chips and an advanced nested filter builder, quick search, sort, column visibility/order/width/pinning, density, pagination, CSV export, row selection, bulk process launch, column statistics, and table variants where declared. On desktop, Filter opens a panel containing the Basic/Advanced switch, sort controls, quick-filter chips, and advanced builder. On phones, Filter opens a sheet containing the same mode, sort, and quick-filter controls; Advanced shows the nested builder inside that sheet. Opening Filter preserves the selected mode. Advanced mode uses a single editable condition list with per-row removal and one confirmed Clear action in the footer. Complex criteria remain in Advanced mode; the basic chips expose metadata-selected fields and let the user add more. Query columns start at 150 px unless a `SIZE` adornment or a saved/resized width supplies another value. `TABLE_QUERY`, `TABLE_GET`, `TABLE_COUNT`, `TABLE_INSERT`, `TABLE_UPDATE`, `TABLE_DELETE`, `TABLE_EXPORT`, and `QUERY_STATS` gate operations alongside permissions. For tables with `usesVariants`, choose a backend-provided variant before querying; it is stored under `qqq.tableVariant.<table>` and sent to query, process and record view/edit/copy GET requests. Backend field-download URLs carry the same variant; inline BLOB data comes from the variant-specific record response. [REC-063](../acceptance/feature-matrix.md) verifies view/edit/copy against duplicate record IDs in two variants. URL parameters `page`, `pageSize`, `filter`, and `q` carry shareable query state ([`use-record-query.ts`](../../src/lib/hooks/use-record-query.ts)). Saved views have backend persistence, quick-view shortcuts and counts, modified-state comparison, and their own routes when the backend capabilities exist ([`use-saved-views.ts`](../../src/lib/hooks/use-saved-views.ts)). Browser local storage holds personal display preferences and last view state, not authoritative records or permissions.

Record pages render sections, field values, associated records, widgets, metadata-defined actions, help, and audit history. `QTableSection.alternatives.RECORD_VIEW` replaces the base section for this screen. Visible sections appear in metadata order; fields, sections and widget cards use `gridColumns` as twelfths on large screens and stack on narrow screens. A collapsible section uses `collapsible.isCollapsible` and `initiallyOpen`, then remembers the choice under `qqq.recordView.collapsibleSectionOpenStates.<table>.<section>`; a section's rule overrides its widget's rule. The sticky desktop section sidebar is off by default; only `showRecordSidebar: true` in the table dashboard settings enables it. `recordViewActionsPlacement` can be set on the table or `supplementalInstanceMetaData.materialDashboard`, with the instance winning; `INLINE_WITH_PAGE_TITLE` places desktop actions beside the local record title, while the default `IN_IDENTITY_SECTION` keeps them in the identity controls. The identity card omits the primary-key T1 field and T1 values already contained in the record label; display values take precedence over raw values for that comparison. Desktop Copy and Delete buttons are omitted when the Actions menu already contains the corresponding enabled action, including in a submenu. An absent or disabled menu action preserves its available direct button. The Audit action reads through `GetAuditsForRecord` when permitted, otherwise through the `audit` table; its dialog groups entries by the viewer's local date, supports oldest/newest sort saved under `audit.sortDirection`, and reports when the 1,000-detail cap truncates results. Create/edit/copy forms use a centered container capped at `max-w-4xl` and follow field metadata, section layout, adjusters, possible-value choices, and server validation; `FILE_UPLOAD` width `full` spans the form grid, while `half` uses the default half width. Copy defaults to Base Copy, which duplicates editable fields; choose Full Copy to edit and submit loaded named associations with the new record. A widget section can edit association rows or form values through `WidgetFormContext` when its type and defaults allow it. Process launch actions can receive selected record IDs or a filter. `gotoFieldNames` in Material supplemental table metadata enables a Go To dialog for the primary key or configured unique keys. Developer views are capability and permission dependent. Consult [record and query acceptance rows](../acceptance/feature-matrix.md) for exact supported cases; do not infer coverage from the existence of a component alone.

Query changes replace the current URL immediately, preserving unrelated parameters and the hash. Reload and browser back/forward restore the visible filter, sort, search and pagination state; changing those controls does not add a separate history entry.

Record section tabs support Left/Right, Home and End to move focus. Enter or Space opens the focused section; Tab moves into the named content panel. Moving focus alone does not load section widgets. Phone sections use accordion buttons with Enter/Space activation. The selected tab remains reflected in the URL.

Query header labels can wrap to two lines when their text and sort indicator do not fit, including with wider system or configured fonts. Configured column widths and 44px touch menu targets remain effective. Active sorts display their direction arrow; unsorted headings remain labeled sort buttons. Relative-date preset menus scroll within the space available beside their trigger.

Selection and display-density menus support arrow-key navigation, Enter to choose, and Escape to close and return focus to the trigger. They stay within the viewport on phone and tablet. Density choices expose radio-menu semantics; the selected option uses the theme primary/foreground color pair.

Record action menus come from `QTableMetaData.menus`. The first `VIEW_SCREEN_ACTIONS` menu replaces the default Actions menu; `VIEW_SCREEN_ADDITIONAL` menus add ordered menu buttons. Item types are `BUILT_IN`, `RUN_PROCESS`, `DOWNLOAD_FILE`, `SUB_MENU`, `SUB_LIST`, and `DIVIDER`. Their `values` supply `option`, `processName`, `fieldName`, or nested `items`, respectively. Built-in options are `NEW`, `COPY`, `EDIT`, `DELETE`, `DEVELOPER_MODE`, `AUDIT`, `THIS_TABLE_PROCESS_LIST`, and `ALL_TABLES_PROCESS_LIST`; permissions filter available operations. See [`record-menu-utils.ts`](../../src/lib/utils/record-menu-utils.ts) for resolution and process deduplication.

For a joined field in a record section, list its qualified name (`person.firstName`) in `QTableSection.fieldNames` and expose a readable join through `QTableMetaData.exposedJoins`. Next asks for that join on the record GET and uses the joined table's field metadata to render the qualified response value. Join paths through tables without read permission are omitted. [REC-064](../acceptance/feature-matrix.md) checks the real sample server in five browser profiles.

## 6. Processes and reports

`QProcessMetaData` declares the process name, label, table association, permission, limits on input records, and ordered `frontendSteps`. The wizard initializes a run, submits each step, polls asynchronous jobs, handles validation results, and cancels or retries as appropriate ([`ProcessRun.tsx`](../../src/components/process/ProcessRun.tsx), [`processes.ts`](../../src/lib/api/processes.ts)). It preserves return navigation to its caller. `QFrontendComponent.type` selects a process component. The currently registered types are:

| Type | Purpose |
|---|---|
| `HELP_TEXT`, `HTML` | Guidance and sanitized markup. |
| `EDIT_FORM`, `VIEW_FORM` | Metadata-driven writable and read-only fields. |
| `RECORD_LIST`, `PROCESS_SUMMARY_RESULTS` | Input/output records and completion summary. |
| `BULK_EDIT_FORM` | Changes applied to selected records. |
| `BULK_LOAD_FILE_MAPPING_FORM`, `BULK_LOAD_VALUE_MAPPING_FORM`, `BULK_LOAD_PROFILE_FORM` | File preview; flat/tall/wide layout and header-row choices; field-to-column/default mappings; per-value translations; saved load/edit profiles. |
| `VALIDATION_REVIEW_SCREEN` | Review validation findings before commit. |
| `DOWNLOAD_FORM` | Download parameters and result. |
| `GOOGLE_DRIVE_SELECT_FOLDER` | Google folder picker step currently shows a disabled placeholder. The approved matrix exclusion covers testing with a real Google OAuth account; the picker UI remains parity work. |
| `WIDGET` | Embedded connected widget. |

Do not invent `values` keys for these components: their shapes vary by backend process implementation. Start with the QQQ producer and a [real fixture](../../tests/acceptance/fixture), then verify the versioned response and end-to-end step submission. A `WIDGET` step uses the named widget's full dashboard controls; an editable `childRecordList` contributes `frontendRecords`, while an editable `rowBuilder` writes its configured output field. Ad hoc composite blocks share the dashboard block renderer, including modal control codes, typed inputs and layouts. A dashboard widget of type `process` embeds the wizard without its stepper or Cancel action; Return starts a fresh run in place. For bulk load, test duplicate headers, required fields, saved profiles, value mappings, validation review, and the committed records. Reports appear in `QInstance.reports`. [`ReportRun.tsx`](../../src/components/reports/ReportRun.tsx) offers CSV, XLSX, and JSON, handles required inputs and asynchronous process-backed reports, and provides a download. A report without a backing process uses the versioned streaming report route. Saved and scheduled report behavior is covered by the report rows of the acceptance matrix.

For bulk load, the mapping screen derives required fields, child associations, layout and suggested mappings from the backend's table structure and process values. Its Add Fields menu searches the main and child-table groups; WIDE layouts may repeat a child field. A mapped field can read a file column or a typed default, including possible values, dates and booleans. Header-row changes remap by name and warn about duplicates. File and value mapping show the current profile in a bordered Saved Bulk Load Profiles section; the final review shows that status in its profile summary. Saved bulk-load profiles are grouped by owner; owners can save, rename and delete, while shared profiles can be selected but not modified. Open the profile menu with Enter or Arrow Down; use arrow keys or Home/End to move, Enter to choose, and Escape to close. Long lists scroll within the viewport. New, Save As and Rename open an inline Profile Name field inside the profile section. Save Profile or Enter saves the name without advancing the process; Cancel or Escape closes it. Duplicate-name errors stay beside the editor. Closing returns focus to the opening control, or the profile-menu button if that control was replaced after saving. Updates and deletion retain their confirmations. New, Empty Mapping, Suggested Mapping and Reset All Changes affect only the draft until the process step is submitted. The validation preview can show the associated child grids declared by `previewRecordAssociated*` values.

Report output formats come from the backend's `reportFormat` possible values unless a process screen declares its own `reportFormat` field. Report input screens use the same dynamic form renderer as other processes, so declared possible values, Booleans, dates and validation rules apply. Intermediate report process screens render before the download; the completed file can be a server path or storage reference.

Standard report processes with an input form followed by a download use the original compact input card and **Generate Report** action. Cancel remains available beside it. Ordinary fields stack at a 384px maximum width; explicitly configured grid widths and rich editors keep their layout. These inputs retain the shared dynamic form, required validation, possible values and typed submission. Longer or custom report processes retain their step headings and navigation.

## 7. Widgets: placement, configuration, and data

Each app dashboard lists widget **names** in order. The matching `QWidgetMetaData` supplies `name`, `label`, optional `type`, and `hasPermission`. The UI posts to `/qqq/v1/widget/{name}` with current dropdown and record parameters ([`ConnectedWidget.tsx`](../../src/components/widgets/ConnectedWidget.tsx), [`widgets.ts`](../../src/lib/api/widgets.ts)). The widget response contains its data and sometimes its type. [`WidgetRenderer.tsx`](../../src/components/widgets/WidgetRenderer.tsx) uses `metadata.type` first, falling back to `payload.type`; it contains errors and unknown types within the widget.

A valid TypeScript metadata example, suitable for an instance metadata fixture (the backend should produce the equivalent JSON), is:

```ts
import type { QWidgetMetaData } from '@/types'

const ordersToday = {
  name: 'ordersToday',
  label: 'Orders today',
  type: 'statistics',
  hasPermission: true,
  gridColumns: 4,
  isCard: true,
  showReloadButton: true,
  showExportButton: true,
  tooltip: 'Orders created since midnight',
  icon: 'inventory_2',
  collapsible: { isCollapsible: true, initiallyOpen: true },
  dropdowns: [{ name: 'region', label: 'Region', possibleValueSourceName: 'regions', type: 'POSSIBLE_VALUE_SOURCE' }],
  storeDropdownSelections: true,
} satisfies QWidgetMetaData
```

`gridColumns` spans 1–12 twelfths on large screens (default 12); smaller screens stack widgets. `isCard: false` removes card chrome. `icon` adds the main icon tile. `collapsible.isCollapsible` enables a header toggle, starts according to `initiallyOpen`, and remembers state under `qqq.widget.collapsibleOpenState.<name>`. `minHeight`, `footerHTML`, help content, `icons.topLeftInsideCard`/`topRightInsideCard`, tooltip, reload, and export customize the frame. Payload `label`, `sublabel`, and `footerHTML` can override or add frame text; a parent payload's `isLabelPageTitle` promotes the label to a page title. HTML is sanitized. For export, provide `csvData` as rows of cells; a table payload may also export `columns` and `rows`. The dropdown controls are declared in metadata **and populated by parallel payload lists** (`dropdownNameList`, `dropdownLabelList`, `dropdownDataList`, `dropdownDefaultValueList`). Controls offer searchable choices or a native date input; metadata can set `width`, `startIconName`, `allowBackAndForth`, `backAndForthInverted`, and `disableClearable`. The selected ID becomes a request parameter; a possible-value source uses its source name. Required selection can delay content, and `storeDropdownSelections` persists choices at `qqq.widgets.dropdownData.<widget>.<param>`. See [WID-040–WID-050](../acceptance/feature-matrix.md) for the tested contract.

Choice dropdowns support search and keyboard selection. A `DATE_PICKER` uses the platform calendar and a Today action; set `allowBackAndForth` for previous/next day buttons. If the `timeframe` dropdown offers `custom`, selecting it opens start and end inputs; after both are entered, the UI sends `custom,<UTC start>,<UTC end>`.

For example, a canonical QQQ statistics response uses `count`, not the demo fixture's `value`:

```json
{ "type": "statistics", "count": 42, "countContext": "open orders", "percentageAmount": 12.5, "percentageLabel": "vs previous week", "increaseIsGood": true }
```

The catalog below lists **every explicit dispatch type** in `WidgetRenderer.tsx`. Payload fields are from the corresponding renderer; they are examples of what the backend emits, not a replacement for the QQQ Java renderer API. When `type` is `chart` or a chart variant, canonical `chartData.labels` and `chartData.datasets` select the QQQ chart path. A payload with `chartType`, `seriesData`, or demo `data` instead uses the legacy/demo chart path.

### Canonical QQQ display widgets

| `type` | Use and important response fields |
|---|---|
| `alert` | Status message: `html`, `alertType`, optional `bulletList` and `hideWidget`. A demo `message` payload uses the demo alert renderer. |
| `divider` | Horizontal separator, optionally `label`; rendered without normal card chrome. |
| `fieldValueList` | Labeled record fields: `fields`, `record.values`, optional `record.displayValues`, prefix icon maps, indentation map. Display values win. |
| `generic` | Common widget frame fields, especially `sublabel` and sanitized `footerHTML`; optional `html` payload. |
| `html` | Sanitized `html` string. A demo payload with `blocks` uses the demo block renderer. |
| `location` | `imageUrl`, `title`, `description`, `location`, `footerText`. |
| `quickSightChart` | Provider embed `url` in an iframe; supply a server-authorized URL and appropriate CSP. Real AWS account coverage is an approved external exclusion. |
| `stepper` | `steps` with labels and optional links/icons, plus zero-based `activeStep` and optional `title`. |
| `usaMap` | `mapMarkerList` of names and latitude/longitude; optional CSS `height`. |

### Canonical QQQ charts, statistics, and tables

| `type` | Use and important response fields |
|---|---|
| `barChart` | Vertical bars from `chartData.labels` and `chartData.datasets`; dataset `data`, colors, and URLs. |
| `horizontalBarChart` | Horizontal bars; supports negative values relative to zero. |
| `stackedBarChart` | Multiple datasets stacked for each label. |
| `lineChart` | Line points from labels and datasets. |
| `smallLineChart` | Compact line presentation with `title` and optional sanitized `description`. |
| `pieChart` | Colored slices and legend; optional `chartSubheaderData`. |
| `chart` | Generic canonical chart, displayed as a bar variant when `chartData` is used; can be inferred from payload type. |
| `statistics` | Headline `count`, optional `countContext`, `percentageAmount`, `increaseIsGood`, and count/percentage links. Demo `value` payload uses the demo statistic renderer. |
| `multiStatistics` | `statisticsGroupData`: groups with `header`, `subheader`, icon, and statistic list. |
| `table` | `columns` (`header`, `accessor`, alignment, optional help/width) and `rows`; typed number, HTML, tooltip, image, composite/block cells; hidden helper columns, expandable subrows, optional `noRowsFoundHTML`, entries-per-page, sticky header and last-row behavior. |
| `multiTable` | `tableDataList` of table payloads, each with its own label, rows and export action. |

### Composite and interactive widgets

| `type` | Use and important response fields |
|---|---|
| `composite` | QQQ block tree: `blocks`/`blockTypeName`, layout, values, links, tooltips and styles. Without those fields, demo `childWidgets` uses `CompositeWidget`. |
| `parentWidget` | Server response `childWidgetNameList`; renders permitted registered children in a 12-column grid or `layoutType: "TABS"`. Children fetch their own data. |
| `process` | Inline wizard using `processMetaData`, optional `defaultValues` and selected record IDs. Server permission still applies. |
| `childRecordList` | Joined child records from `queryOutput.records` and `childFrontendTableMetaData`/`childTableMetaData`; `includeExposedJoinTables` adds readable join columns, and `defaultValuesForNewChildRecords` hides parent-key columns on screen. Optional `viewAllLink`, add-child defaults, row limits, `disableRowClick`, and CSV export via `showExportButton`. On a record form, `defaultValues.manageAssociationName` enables association editing. |
| `customComponent` | Loads a trusted bundle from metadata `defaultValues.componentSourceUrl` and `componentName`, then resolves `window[componentName][componentName]`. The component receives widget metadata/data/record, `qContext`, and `qfmdBridge`; `window.React`/`window.ReactDOM` are exposed. Check CSP and test the actual older bundle before claiming compatibility. |
| `cronUI` | Record view displays the expression, time zone and backend `cronDescription`. Put the widget in a table section and set `defaultValues.includeOnRecordEditScreen: true`, `cronExpressionFieldName`, and `timeZoneFieldName` to edit the named record fields on create/edit forms. The expression editor offers Basic days/hours/minutes, Advanced Quartz input, Clear, live description and validation. Give the time-zone field a possible-value source to render a select. |
| `dynamicForm` | Labeled `fieldList` and `recordOfFieldValues`, including merged JSON field values. Editable in a form/process host when `defaultValues.isEditable` allows it; fields join host validation and submission. In a record form, `mergedDynamicFormValuesIntoFieldName` names the declared JSON table field that stores the values. Put that field in a hidden section, so QQQ still returns it to the widget renderer; a field marked `isHidden` is omitted from normal record reads. The renderer should return current values in `recordOfFieldValues` for reloads. |
| `dataBagViewer` | Data bag/version browser with raw/preview tabs and version editor when `storeDataBagVersion` is available; uses `queryParams.id` or record ID and the built-in `dataBag` and `dataBagVersion` tables. |
| `pivotTableSetup` | Record view summarizes saved `pivotTableJson` (`rows`, `columns`, `values`). In a form, a switch and modal edit its definition after table/`columnsJson` fields are available. |
| `filterAndColumnsSetup` | Record view summarizes saved filter, sort and columns JSON and shows a paged, sortable, resizable preview unless `hidePreview` is set. A host form offers Edit, + Add Filters and + Add Columns controls, then opens an editor for nested filters, multiple sort levels, visible/ordered columns and a draft preview; `OK` writes JSON into the host form, `Cancel` discards the draft. When payload `allowVariables` is true, a criterion value can become a `FilterVariableExpression`; its `${VARIABLE}` chip is saved in `queryFilterJson`, and preview and the opened query page wait for a value. Saving the host record or advancing a process persists the JSON. A `WIDGET` field adornment can host the setup in a process or row-builder field; its `widgetName` names the widget and only that field receives its output. `overrideIsEditable: false` keeps it read-only. |
| `rowBuilder` | Payload `records`, with columns from `defaultValues.frontendFields` or `fields`. Record view/dashboard is read-only; a form/process host can add, edit, delete and reorder rows when the metadata's edit flags allow it. |
| `scriptViewer` | Script revisions, files, logs, test runner, docs and editor; uses `queryParams.id` or record ID and the built-in script tables. |
| `ESB_OVERVIEW` | ESB destination/trigger overview; fetches its own ESB API data and does not use the ordinary widget payload for content. Requires the ESB backend module. |

For `scriptViewer`, pass a script ID through `queryParams.id` or host it on that script's record. The built-in script and script-type tables supply revisions, schema-ordered files, docs and logs. Register `storeScriptRevision` to expose editing and `testScript` to expose the test panel. The editor supports per-file syntax coloring, split panes, API name/version selection when those fields exist, and a guard for unsaved changes. It does not yet offer Ace-style autocomplete.

QQQ composite block types rendered by [`QqqBlocks.tsx`](../../src/components/widgets/blocks/QqqBlocks.tsx) include `TEXT`, `BIG_NUMBER`, `UP_OR_DOWN_NUMBER`, `NUMBER_ICON_BADGE`, `ICON`, `TABLE_SUB_ROW_DETAIL_ROW`, `PROGRESS_BAR`, `DIVIDER`, `IMAGE`, `AUDIO`, `INPUT_FIELD`, and `BUTTON`. Supported layouts include `FLEX_COLUMN`, `FLEX_ROW`, `FLEX_ROW_WRAPPED`, `FLEX_ROW_SPACE_BETWEEN`, `FLEX_ROW_CENTER`, `TABLE_SUB_ROW_DETAILS`, and `BADGES_WRAPPER`. Interactive buttons/inputs need a process action callback to have an effect. Unknown block types show a contained warning. See [WID-057–WID-059](../acceptance/feature-matrix.md).

`INPUT_FIELD` blocks read `values.fieldMetaData`, optional `value`, `placeholder`, `autoFocus`, and `submitOnEnter`. Ordinary scalar inputs retain the compact block controls; the backend's neutral `%s` display format does not change their presentation. Possible-value sources, explicit formatting/behaviors, and `CODE_EDITOR`, `FILE_UPLOAD`, or `WIDGET` adornments use the shared Next field editors. Hidden fields are omitted and read-only fields cannot be changed. Standalone metadata editors retain a 14rem minimum width so short choice labels do not collapse the control.

In a process, block editors use the screen's form, validation and submission. A BLOB or FILE_UPLOAD field sends the selected `File` as multipart content, and required files block submission until chosen. Named choices on block-only fields search their standalone possible-value source; declared process fields use the process source. WIDGET fields receive surrounding process values (for example `tableName`) merged with current form values; editing writes only the adorned field. Scalar Enter submits only when `submitOnEnter` is true; `->code` submits an action code. Multiline code, choice searches and file controls own their keyboard interactions. Standalone blocks keep their draft locally and send scalar Enter values through their action callback. PRC-062 and WID-074 cover the process and standalone fixture paths.

The filter/column editor reads the payload's `tableName` or the form's `tableName`, then loads that table's metadata. It writes to `queryFilterJson` and `columnsJson` by default; `filterFieldName` and `columnFieldName`/`columnsFieldName` override those keys. Payload flags `hideColumns`, `hideSortBy`, `hidePreview`, `allowVariables`, `isApiVersioned`, `apiName`/`apiPath`/`apiVersion`, `filterDefaultFieldNames`, `filterDefaultFieldNameSourceFieldNames`, `omitExposedJoins`, `editButtonLabel`, and `modalHeader` affect the editor. It waits for a selected table and required default-field values. The preview supports server-side paging, sorting, column resizing, Refresh, column configuration, and column-menu actions (filter, hide, pin, copy page/full-query values, and statistics when permitted). The editor also offers density, Basic quick filters, Advanced conditions, and selection of an existing saved view. Selecting a view imports its filter and columns into the draft; it does not modify that saved view. Column widths and pins survive host Save. Unresolved variables suppress the preview; assign variables in Advanced mode. Interactions in a read-only record preview are temporary and never update the saved report. `OK` updates the host form's values, so the record must still be saved to persist. [WID-030 and WID-070](../acceptance/feature-matrix.md) cover the summary, preview, Cancel, OK, and persisted host save across five browser profiles.

In the report setup dialog, Left/Right Arrow switches between Filters and sort and Columns; Home/End selects the first/last available tab. Tab enters the selected panel's controls. Switching tabs preserves the draft, and metadata that hides Columns leaves only the filter tab. The tab controls expose `filter-editor-tab-<widget>-filters` and `filter-editor-tab-<widget>-columns` CSS hooks.

### Demo and compatibility dispatch labels

The remaining dispatch labels mainly support local mock fixtures. They are implemented UI paths, but are not a promise that the production QQQ backend emits those shapes. Check [`src/mocks/fixtures/widgets`](../../src/mocks/fixtures/widgets) for demo payloads and the real widget fixtures and matrix for QQQ-backed examples.

| `type` | Use and important response fields |
|---|---|
| `recordGrid` | Demo record grid with `tableName`, `records`, and `columns` or full `fields`; optionally `totalCount`. |
| `quickLinks` | Demo list of labeled navigation links; inspect the fixture's `links` payload before using it. |
| `processSummary` | Demo process status/summary cards; inspect the fixture's status and counts before using it. |
| `block` | Chooses QQQ composite blocks when the payload has `blockTypeName` or `blocks`; otherwise falls back to `BlockWidget`. A demo `blocks` list therefore enters the QQQ composite branch. |
| `parent` | Demo `CompositeWidget` alias using `childWidgets`; canonical QQQ parent widgets use `parentWidget` and `childWidgetNameList`. |

Canonical chart types can also fall through to the demo chart components when the response is not a QQQ `chartData` payload.

## 8. Theme, branding, and customization

`QInstance.branding` supplies app/company name, logo/icon, accent colors, banners and optional `gravatarDefault`. A company footer appears when both `companyName` and a safe HTTP(S) `companyUrl` are present. The active application theme is `QInstance.supplementalInstanceMetaData.materialDashboardTheme`, read by [`material-theme.ts`](../../src/lib/theme/material-theme.ts); do not configure `QInstance.theme` and expect these styles to apply. Its optional fields cover palette, fonts, typography, radii, density, logo/icon/favicon, icon style, branded header, app bar, sidebar, table colors, and `customCss`. Invalid theme values are ignored. For example:

```json
{"supplementalInstanceMetaData":{"materialDashboardTheme":{"primaryColor":"#245ca6","fontFamily":"Inter, sans-serif","borderRadiusCard":"12px","brandedHeaderEnabled":true,"brandedHeaderTagline":"Operations","customCss":"[data-qqq-id='sidenav-root'] { border-right: 1px solid #ccc; }"}}}
```

[`apply-branding.ts`](../../src/lib/theme/apply-branding.ts), [`material-theme.ts`](../../src/lib/theme/material-theme.ts), [`tokens.ts`](../../src/lib/theme/tokens.ts), and [`qqq-theme.css`](../../src/styles/qqq-theme.css) define the CSS mapping, including supported Material `--qqq-*` variables. Scope custom CSS to observed `data-qqq-id` attributes, and inspect actual rendering and contrast before migrating a Material stylesheet. A declared application theme sets the app look and keeps light mode active. Without an application theme, the local display-mode preference applies; a fresh profile starts in light mode regardless of the operating system preference. Density is available through theme metadata and local preferences.

See the [Material CSS hook guide](../CSS-HOOKS.md) for the ID sanitizer, selector patterns, named hooks, and phone/tablet visibility rules.

Analytics is configured by the backend's `QInstance.environmentValues` ([`src/lib/analytics`](../../src/lib/analytics)). It stays off when no analytics values are published. `ANALYTICS_PROVIDERS` can name Google, PostHog, or registered plugins; provider-specific IDs and enable flags are also required. The default privacy behavior omits record IDs, labels and query strings and does not identify users. Only publish `ANALYTICS_INCLUDE_RECORD_DATA=true` or `ANALYTICS_IDENTIFY_USERS=true` after deciding those disclosures are appropriate for the application.

## 9. Accessibility, testing, and known boundaries

Components use labeled fields, keyboard navigation, focus-managed dialogs and drawers, inline errors, contained widget failures, and touch layouts. Below 768 px, queries become record cards and filters/actions use sheets; tablet testing uses a touch WebKit project. Test with keyboard and assistive technology in addition to axe. See [browser matrix](../acceptance/browser-matrix.md) and [accessibility rows](../acceptance/feature-matrix.md).

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build:export`, and `pnpm perf:budget` for the relevant change. The release acceptance gate is `QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet pnpm test:acceptance` with `QQQ_SAMPLE_JAR` pointing at a compatible real sample build. It verifies SQL/backend behavior as well as browser behavior; mocked tests are not a substitute. See [test setup](../../tests/acceptance/README.md), [performance budget](../acceptance/performance.md), and [API error handling](../API-ERROR-HANDLING.md).

Current limits to account for: the Material parity ledger has open Partial/Missing rows beyond the narrower feature matrix; the report filter/column editor supports variables and API-versioned metadata but still lacks the embedded full query screen; a built-in QFMD bridge does not prove every third-party Material bundle works; root-path static hosting is the documented deployment; and the Google Picker UI is still a placeholder. Real Auth0 tenant, Google account, and AWS QuickSight service tests have approved external-service exclusions in the feature matrix. Validate any additional feature against the current branch, backend contract, and matrix before describing it as production-compatible.
