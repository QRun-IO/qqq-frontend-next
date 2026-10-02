# Next UI developer guide

> **This checkout targets RC11.** Confirm availability in the [RC11 GitHub release](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11) before installing. [RC11 notes](../releases/1.0.0-RC.11.md) record the preparation checkpoint and verification scope; RC10 was the previously verified public candidate at that checkpoint. Earlier versioned receipts remain historical evidence; final 1.0 remains held.

> **RC9:** application code is unchanged from RC8. See [RC9 notes](../releases/1.0.0-RC.9.md) and [published releases](https://github.com/QRun-IO/qqq-frontend-next/releases) for versioned verification and public delivery status. Earlier RC8 receipts below remain historical evidence.

> **Live roadmap and known issues:** [QRun-IO/qqq#713](https://github.com/QRun-IO/qqq/issues/713). GitHub issues own current status and remaining work. Follow the [issue-tracking policy](../ISSUE-TRACKING.md) when reporting or resolving findings; keep this guide focused on usage and evidence.

This guide describes the `feature/next-1.0` release worktree as of 2026-10-01. It explains the current frontend and backend metadata contract. The previously verified public candidate at the RC11 preparation checkpoint was [1.0.0-RC.10](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.10) (commit `12cf774`); final `1.0.0` remains on hold. Later branch changes are not retroactive changes to that immutable release. For behavior proven against a real server use the [feature matrix](../acceptance/feature-matrix.md); for the full Material inventory use the [parity ledger](../acceptance/material-parity.md). Some ledger rows predate recent work, so verify an individual status against current source and acceptance results before making a release claim.

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
    <version>1.0.0-RC.11</version>
</dependency>
```

For frontend development, use a compatible Node.js version (the README specifies 20.19+ or 22.12+) and pnpm 9.15.9:

```bash
pnpm install
NEXT_PUBLIC_MOCK_API=true pnpm dev
pnpm build:export
pnpm build:jar
```

The mock setting is for isolated development. Set `NEXT_PUBLIC_MOCK_API=false` and connect a real QQQ backend for integration. `build:export` writes `out/`; `build:jar` packages it with Maven. The Maven POM enforces the presence of static placeholder pages. The default `pnpm build` instead creates a standalone Node server, whose `QQQ_BACKEND_URL` build setting adds same-origin rewrites. For the container path see [`docker/quickstart/Dockerfile`](../../docker/quickstart/Dockerfile). This checkout targets `1.0.0-RC.11`, overriding an older BOM-managed frontend; confirm its availability in the [RC11 GitHub release](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11) before installing. It requires the QQQ 4.1.0-SNAPSHOT development backend including PRs #913 and #908; see the release notes for its verified backend commit. Use a matching local backend/frontend build to test later branch changes.

| Setting | Behavior in this checkout |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Defaults to `/qqq/v1`; baked into browser requests. Keep the UI and API on the same origin where possible. |
| `NEXT_PUBLIC_MOCK_API` | `true` enables MSW development fixtures; `build:export` forces `false`. |
| `QQQ_NEXT_OUTPUT` | `export` selects the Javalin-hosted static export; otherwise standalone build. |
| `QQQ_BACKEND_URL` | Standalone build only: backend origin for Next rewrites; fixed at build time. |
| `NEXT_PUBLIC_APP_VERSION` | Optional version reported to the backend; defaults to `package.json` version. |
| `QQQ_DASHBOARD_CSP_SOURCES` | Standalone server runtime setting: additional CSP directives/sources for external services. See Google Drive hosting below. |

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
| `/app/{tableName}/{processName}` | Table-scoped process alias; redirects to the process runner with query parameters and a return path to the table. |
| `/app/{tableName}/{reportName}` | Alias for a report whose `tableName` matches; redirects to its runner. |
| `/app/{tableName}/{recordId}/createChild/{childTable}` | Child create form with parent association values. |
| `/app/{tableName}/{recordId}/{processName}` | Resolves a registered process and redirects to its runner with record and return context; execution still checks permission. |
| `/app/{tableName}/key?...` | Unique-key lookup. |
| `/app/{tableName}/savedView/{viewId}` | Server-backed saved query view. |
| `/app/{processName}` | Process run. |
| `/app/{reportName}` | Report run and download. |
| `/app/search?q=...` | Navigation, recent-record, and available record search results. |
| `/app/developer` | Developer information available to permitted users. |

The header search and `/` dialog locate navigation targets and recent records; record search is offered when the backend supports it. RC8 includes the search-focus correction: Tab/Shift+Tab remain within the search dialog, Clear returns focus to the search input, and Escape or backdrop dismissal restores focus to the opener. A pointer-opened phone search restores focus to its actual button in verified Chromium/mobile cases. RC8 tablet WebKit has two open Clear-search focus failures; see the release notes for remaining browser issues. RC7 does not include this correction. The command palette opens with `.` or Cmd/Ctrl+K and has a header button; `?` opens keyboard help. Keyboard shortcuts on query and record pages are listed in the [feature matrix](../acceptance/feature-matrix.md). The sidebar has a phone drawer, nested app groups, banners, and a user menu. Branding can add a company footer and a themed bar above the shell. `?helpHelp` reveals help-slot keys for content authors.

Material's nested `/{app}/{table}/{id}` URLs are not the native Next route. A not-found page now checks the signed-in instance metadata, applies exact or `/*` redirect rules, and resolves nested Material app paths to `/app/...` while preserving query/hash ([`legacy-paths.ts`](../../src/lib/utils/legacy-paths.ts), [`LegacyPathRedirect.tsx`](../../src/components/layout/LegacyPathRedirect.tsx)). Verify a specific old bookmark rather than assuming arbitrary legacy URLs match. For links generated by widgets use [`material-links.ts`](../../src/lib/utils/material-links.ts), which normalizes supported legacy links and preserves a trailing slash for static-export routes.

### Link parameters and launch examples

The table-scoped process/report aliases are resolved before a record GET, so avoid record IDs that collide with those names. Process resolution checks an exact table process, then an instance process; the record-scoped route also accepts a table process name suffix. A matching process takes precedence over a report. Use full process names for unambiguous new links. See [`material-links.ts`](../../src/lib/utils/material-links.ts).

| Link context | Supported parameters and behavior |
|---|---|
| Record view query | `tab` selects a section; `view=tabs` or `view=list` selects the layout. `from` is a safe local return path and `fromLabel` labels it. The default view comes from Preferences. |
| Record view hash | `#audit` opens audits when available; `#/launchProcess=<name>` launches a process; `#<sectionName>` selects a section. `#/createChild=<table>` starts child creation and accepts the presets below. |
| Create/child-create hash | `#/defaultValues=<encoded JSON object>/disabledFields=<encoded JSON array>` seeds and locks fields. `disabledFields` also accepts a JSON object whose truthy entries name locked fields. These are UI presets; backend validation and authorization still apply. |
| Process query | `recordsParam=recordIds&recordIds=1,2` selects IDs; `recordsParam=filterJSON&filterJSON=<encoded QQueryFilter>` selects by filter. The legacy selector `queryFilter` uses the same `filterJSON` value. |
| Process context | `defaultProcessValues=<encoded JSON object>` presets inputs; `returnTo=<encoded local path>` supplies the return destination. `tableName` supplies launch context only for a process without its own table and only when that table exists in metadata. |
| Dashboard hash | `#<widgetName>` targets a widget anchor. An embedded `process` widget also reads the page's `recordIds` query parameter. |

Build encoded links instead of concatenating raw JSON. For example, where metadata declares the supplied process/table names:

```ts
const params = new URLSearchParams({
  recordsParam: 'recordIds',
  recordIds: selectedIds.join(','),
  defaultProcessValues: JSON.stringify({ sendNotification: true }),
  returnTo: `/app/${encodeURIComponent(tableName)}`,
})
const processHref = `/app/${encodeURIComponent(processName)}/?${params}`
const createHref = `/app/${encodeURIComponent(tableName)}/create/#/defaultValues=${encodeURIComponent(JSON.stringify(defaultValues))}/disabledFields=${encodeURIComponent(JSON.stringify(disabledFieldNames))}`
```

Only preset fields actually declared by the application's metadata. Record/form hash decoding is implemented by [`formPresetsFromHash`](../../src/lib/utils/material-links.ts); process query decoding lives in the [slug page](../../src/app/%28dashboard%29/app/%5Bslug%5D/page.tsx). Test a generated link on the static-export host and after refresh.

## 5. Tables, queries, records, and forms

A failed query displays its backend error with Retry and Dismiss controls. Retry repeats the request; Dismiss closes the panel without changing the filter. Correct or reset an invalid filter to load records again. Query and pivot error text use theme-derived shades for readability; the top error notification also uses the configured error palette.

Tables are described by [`QTableMetaData`](../../src/types/metadata.ts): `primaryKeyField`, `fields`, `sections`, `associations`, `exposedJoins`, capabilities, and permission flags. A field supplies `name`, `label`, `type`, `isRequired`, `isEditable`, `isHeavy`, `isHidden`, and `adornments`; possible values, bounds, formats, and help are optional. The supported primitive field types are `STRING`, `INTEGER`, `LONG`, `DECIMAL`, `BOOLEAN`, `DATE`, `TIME`, `DATE_TIME`, `TEXT`, `HTML`, `PASSWORD`, and `BLOB`. [`DynamicFormField`](../../src/components/forms/DynamicFormField.tsx) chooses editors, while [`zod-from-metadata.ts`](../../src/lib/utils/zod-from-metadata.ts) builds validation. Configure fields in QQQ metadata, not in a per-table React component.

Table dashboard settings are read from `supplementalMetaData.materialDashboard` in the v1 response, with `supplementalTableMetaData.materialDashboard` accepted as a legacy fallback. The v1 object takes precedence when both are present. These settings include `defaultQuickFilterFieldNames`, `gotoFieldNames`, `showRecordSidebar`, and `recordViewActionsPlacement`. Quick-filter defaults use the configured nonempty field list, otherwise T1 section fields; unresolved names and duplicates are removed. Query-selectable `virtualFields` also become columns, but only virtual fields with `isQueryCriteria` can be filtered or sorted.

For a fixed choice list, put `inlinePossibleValueSource` on the QQQ field with `type: ENUM`, an `idType` matching the field, and ordered `enumValues` containing `id` and `label`. Do not also set `possibleValueSourceName`: QQQ rejects both sources on one field. Next filters inline labels by prefix without a possible-values request and stores the selected `id`. A `CHIP` field adornment with keys such as `color.HIGH` and `icon.HIGH` styles both record values and form options. The v1 table metadata response must include the inline source; [REC-062](../acceptance/feature-matrix.md) verifies its rendering, persistence, and reload against the sample server.

The query page supports basic quick-filter chips and an advanced nested filter builder, quick search, sort, column visibility/order/width/pinning, density, pagination, CSV export, row selection, bulk process launch, column statistics, and table variants where declared. On desktop, Filter opens a panel containing the Basic/Advanced switch, sort controls, quick-filter chips, and advanced builder. On phones, Filter opens a sheet containing the same mode, sort, and quick-filter controls; Advanced shows the nested builder inside that sheet. Opening Filter preserves the selected mode. Advanced mode uses a single editable condition list with per-row removal and one confirmed Clear action in the footer. Complex criteria remain in Advanced mode; the basic chips expose metadata-selected fields and let the user add more. The Columns popup supports keyboard entry, search, reordering and focus return on close; embedded report column editors keep the surrounding editor focus. Query columns start at 150 px unless a `SIZE` adornment or a saved/resized width supplies another value. `TABLE_QUERY`, `TABLE_GET`, `TABLE_COUNT`, `TABLE_INSERT`, `TABLE_UPDATE`, `TABLE_DELETE`, `TABLE_EXPORT`, and `QUERY_STATS` gate operations alongside permissions. For tables with `usesVariants`, choose a backend-provided variant before querying; it is stored under `qqq.tableVariant.<table>` and sent to query, process and record view/edit/copy GET requests. Backend field-download URLs carry the same variant; inline BLOB data comes from the variant-specific record response. [REC-063](../acceptance/feature-matrix.md) verifies view/edit/copy against duplicate record IDs in two variants. URL parameters `page`, `pageSize`, `filter`, and `q` carry shareable query state ([`use-record-query.ts`](../../src/lib/hooks/use-record-query.ts)). Saved views have backend persistence, quick-view shortcuts and counts, modified-state comparison, and their own routes when the backend capabilities exist ([`use-saved-views.ts`](../../src/lib/hooks/use-saved-views.ts)). Browser local storage holds personal display preferences and last view state, not authoritative records or permissions.

Record pages render sections, field values, associated records, widgets, metadata-defined actions, help, and audit history. `QTableSection.alternatives.RECORD_VIEW` replaces the base section for this screen. Visible sections appear in metadata order; fields, sections and widget cards use `gridColumns` as twelfths on large screens and stack on narrow screens. When widths are not configured, Overview uses half-width cards on large screens; a selected section uses a full-width card with two field columns from the small breakpoint, stacking fields on phones. Explicit field, section, or widget widths take precedence over those presentation defaults. A collapsible section uses `collapsible.isCollapsible` and `initiallyOpen`, then remembers the choice under `qqq.recordView.collapsibleSectionOpenStates.<table>.<section>`; a section's rule overrides its widget's rule. The sticky desktop section sidebar is off by default; only `showRecordSidebar: true` in the table dashboard settings enables it. `recordViewActionsPlacement` can be set on the table or `supplementalInstanceMetaData.materialDashboard`, with the instance winning; `INLINE_WITH_PAGE_TITLE` places desktop actions beside the local record title, while the default `IN_IDENTITY_SECTION` keeps them in the identity controls. The identity card omits the primary-key T1 field and T1 values already contained in the record label; display values take precedence over raw values for that comparison. Desktop Copy and Delete buttons are omitted when the Actions menu already contains the corresponding enabled action, including in a submenu. An absent or disabled menu action preserves its available direct button. The Audit action reads through `GetAuditsForRecord` when permitted, otherwise through the `audit` table; its dialog groups entries by the viewer's local date, supports oldest/newest sort saved under `audit.sortDirection`, and reports when the 1,000-detail cap truncates results. Create/edit/copy forms use a centered container capped at `max-w-4xl` and follow field metadata, section layout, adjusters, possible-value choices, and server validation; `FILE_UPLOAD` width `full` spans the form grid, while `half` uses the default half width. Copy defaults to Base Copy, which duplicates editable fields; choose Full Copy to edit and submit loaded named associations with the new record. A widget section can edit association rows or form values through `WidgetFormContext` when its type and defaults allow it. Process launch actions can receive selected record IDs or a filter. `gotoFieldNames` in Material supplemental table metadata enables a Go To dialog for the primary key or configured unique keys. Developer views are capability and permission dependent. Consult [record and query acceptance rows](../acceptance/feature-matrix.md) for exact supported cases; do not infer coverage from the existence of a component alone.

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
| `GOOGLE_DRIVE_SELECT_FOLDER` | Selects one folder from a shared drive using Google OAuth. Requires `GOOGLE_APP_CLIENT_ID` and `GOOGLE_APP_API_KEY` in instance environment values. Submits `googleDriveAccessToken`, `googleDriveFolderId`, and `googleDriveFolderName`; cancellation clears them. |
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

`gridColumns` spans 1–12 twelfths on large screens (default 12); smaller screens stack widgets unless explicit breakpoint overrides are supplied in `defaultValues` (see the configuration recipes below). `isCard: false` removes card chrome. `icon` supplies the main header glyph using the Next outline presentation. `collapsible.isCollapsible` enables a header toggle, starts according to `initiallyOpen`, and remembers state under `qqq.widget.collapsibleOpenState.<name>`. `minHeight`, `footerHTML`, help content, `icons.topLeftInsideCard`/`topRightInsideCard`, tooltip, reload, and export customize the frame. Payload `label`, `sublabel`, and `footerHTML` can override or add frame text; a parent payload's `isLabelPageTitle` promotes the label to a page title. HTML is sanitized. For export, provide `csvData` as rows of cells; a table payload may also export `columns` and `rows`. The dropdown controls are declared in metadata **and populated by parallel payload lists** (`dropdownNameList`, `dropdownLabelList`, `dropdownDataList`, `dropdownDefaultValueList`). Controls offer searchable choices or a native date input; metadata can set `width`, `startIconName`, `allowBackAndForth`, `backAndForthInverted`, and `disableClearable`. The selected ID becomes a request parameter; a possible-value source uses its source name. Required selection can delay content, and `storeDropdownSelections` persists choices at `qqq.widgets.dropdownData.<widget>.<param>`. See [WID-040–WID-050](../acceptance/feature-matrix.md) for the tested contract.

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
| `pivotTableSetup` | Record view summarizes saved `pivotTableJson` (`rows`, `columns`, `values`). In a form, a switch and modal edit its definition after table/`columnsJson` fields are available. OK changes the form draft; Save persists it. Turning the switch off clears the stored definition when the host form is saved. |
| `filterAndColumnsSetup` | Record view summarizes saved filter, sort and columns JSON and shows a paged, sortable, resizable preview unless `hidePreview` is set. A host form offers Edit, + Add Filters and + Add Columns controls, then opens an editor for nested filters, multiple sort levels, visible/ordered columns and a draft preview; `OK` writes JSON into the host form, `Cancel` discards the draft. When payload `allowVariables` is true, a criterion value can become a `FilterVariableExpression`; its `${VARIABLE}` chip is saved in `queryFilterJson`, and preview and the opened query page wait for a value. Saving the host record or advancing a process persists the JSON. A `WIDGET` field adornment can host the setup in a process or row-builder field; its `widgetName` names the widget and only that field receives its output. `overrideIsEditable: false` keeps it read-only. |
| `rowBuilder` | Payload `records`, with columns from `defaultValues.frontendFields` or `fields`. Record view/dashboard is read-only; a form/process host can add, edit, delete and reorder rows when the metadata's edit flags allow it. |
| `scriptViewer` | Script revisions, files, logs, test runner, docs and editor; uses `queryParams.id` or record ID and the built-in script tables. |
| `ESB_OVERVIEW` | ESB destination/trigger overview; fetches its own ESB API data and does not use the ordinary widget payload for content. Requires the ESB backend module. |

For `scriptViewer`, pass a script ID through `queryParams.id` or host it on that script's record. The built-in script and script-type tables supply revisions, schema-ordered files, docs and logs. Register `storeScriptRevision` to expose editing and `testScript` to expose the test panel. The editor supports per-file syntax coloring, split panes, API name/version selection when those fields exist, and a guard for unsaved changes. Local suggestions include QQQ API/logger helpers, language keywords and identifiers in the current file. Type a prefix or press Ctrl+Space, use arrows to choose and Enter/Tab to insert, or click/tap a suggestion. Escape dismisses the list; Escape followed by Tab leaves the editor. Completion supports native undo/redo; the browser controls how consecutive edits are grouped. Suggestions do not validate or execute code.

QQQ composite block types rendered by [`QqqBlocks.tsx`](../../src/components/widgets/blocks/QqqBlocks.tsx) include `TEXT`, `BIG_NUMBER`, `UP_OR_DOWN_NUMBER`, `NUMBER_ICON_BADGE`, `ICON`, `TABLE_SUB_ROW_DETAIL_ROW`, `PROGRESS_BAR`, `DIVIDER`, `IMAGE`, `AUDIO`, `INPUT_FIELD`, and `BUTTON`. Supported layouts include `FLEX_COLUMN`, `FLEX_ROW`, `FLEX_ROW_WRAPPED`, `FLEX_ROW_SPACE_BETWEEN`, `FLEX_ROW_CENTER`, `TABLE_SUB_ROW_DETAILS`, and `BADGES_WRAPPER`. Buttons that submit process actions and standalone input submissions need a host callback. Modal control codes also work locally on dashboard composites. Unknown block types show a contained warning. See [WID-057–WID-059](../acceptance/feature-matrix.md).

`INPUT_FIELD` blocks read `values.fieldMetaData`, optional `value`, `placeholder`, `autoFocus`, and `submitOnEnter`. Ordinary scalar inputs retain the compact block controls; the backend's neutral `%s` display format does not change their presentation. Possible-value sources, explicit formatting/behaviors, and `CODE_EDITOR`, `FILE_UPLOAD`, or `WIDGET` adornments use the shared Next field editors. Hidden fields are omitted and read-only fields cannot be changed. Standalone metadata editors retain a 14rem minimum width so short choice labels do not collapse the control. For `STRING`, `TEXT`, and explicitly configured `PASSWORD` blocks, `fieldMetaData.behaviors` accepts `TO_UPPER_CASE` or `TO_LOWER_CASE`: text changes case while typing and the caret remains at the edit position, including conversions that expand characters such as `ß` to `SS`. Selection boundaries and direction are preserved. For single-line inputs, process Enter and Submit both send the transformed value; standalone Enter requires `submitOnEnter` and a host callback. Multiline `TEXT` fields preserve newlines: Enter edits the text even when `submitOnEnter` is true, and the process Submit button sends the transformed value. Password inputs remain masked by default; showing or hiding the value does not change it. Passwords without a case behavior retain their entered case. The behavior names come from backend metadata, so do not apply a second conversion in an action callback.

Numeric block controls in RC4 blur on mouse-wheel scrolling to preserve the entered value, matching shared numeric form fields. Clicking back into the control allows normal typing and arrow-key edits. Text controls keep focus when scrolling. This correction is included in published RC4 (`3c409f9`); RC3 does not contain it.

In a process, block editors use the screen's form, validation and submission. A BLOB or FILE_UPLOAD field sends the selected `File` as multipart content, and required files block submission until chosen. Named choices on block-only fields search their standalone possible-value source; declared process fields use the process source. WIDGET fields receive surrounding process values (for example `tableName`) merged with current form values; editing writes only the adorned field. Scalar Enter submits only when `submitOnEnter` is true; `->code` submits an action code. Multiline code, choice searches and file controls own their keyboard interactions. Standalone blocks keep their draft locally and send scalar Enter values through their action callback. PRC-062 and WID-074 cover the process and standalone fixture paths. Enter trims text before form validation and submission; required whitespace cannot advance. Process initial values come from the process state, while standalone values come from the block. Configured autofocus takes precedence over heading focus on subsequent process screens, and the first blur does not display a premature required error. PRC-063 verifies this configuration across screen transitions and checks the actual stored text.

Ordinary record edits omit unchanged timestamps. Base Copy and both child-row editor hosts resubmit complete values, so they retain each unchanged timestamp's source instant and fractional seconds. REC-065 verifies copy persistence during the repeated daylight-saving hour; component regressions cover association and in-process child rows.

`DATE_TIME` process fields and input blocks display instants in the browser's local timezone, retain seconds, and send edited times as zoned UTC values. Unchanged values retain their original instant and subsecond precision, including a repeated daylight-saving hour. `DATE` and `TIME` remain calendar and wall-clock values. PRC-064 checks seeded and edited values across plain blocks, metadata editors and regular process forms against backend SQL; WID-075 checks standalone display.

The filter/column editor reads the payload's `tableName` or the form's `tableName`, then loads that table's metadata. It writes to `queryFilterJson` and `columnsJson` by default; `filterFieldName` and `columnFieldName`/`columnsFieldName` override those keys. `hidePreview` controls the read-only summary preview. Starting in RC5, the editing dialog retains its query grid even when that summary is hidden, matching Material behavior; RC4 incorrectly hides both. Payload flags `hideColumns`, `hideSortBy`, `allowVariables`, `isApiVersioned`, `apiName`/`apiPath`/`apiVersion`, `filterDefaultFieldNames`, `filterDefaultFieldNameSourceFieldNames`, `omitExposedJoins`, `editButtonLabel`, and `modalHeader` affect the editor. It waits for a selected table and required default-field values. The preview supports server-side paging, sorting, column resizing, Refresh, column configuration, and column-menu actions (filter, hide, pin, copy page/full-query values, and statistics when permitted). The editor also offers density, Basic quick filters, Advanced conditions, and selection of an existing saved view. Selecting a view imports its filter and columns into the draft; it does not modify that saved view. Column widths and pins survive host Save. Unresolved variables suppress the preview; assign variables in Advanced mode. Interactions in a read-only record preview are temporary and never update the saved report. Starting in RC4, `omitExposedJoins` limits new filter/column choices in both the read-only preview and editor. Existing saved joined columns, criteria and sorts remain usable, and reordering available columns preserves omitted columns in place. Opening the editor and pressing OK preserves those saved fields; Basic/Advanced changes and host Save/reopen retain their values and widths. This is a choice restriction, not a backend permission boundary; existing joined data still uses the normal query permissions. WID-073 checks the configured and unconfigured cases against SQL, including local edits and reload. `OK` updates the host form's values, so the record must still be saved to persist. [WID-030 and WID-070](../acceptance/feature-matrix.md) cover the summary, preview, Cancel, OK, and persisted host save across five browser profiles.

In the report setup dialog, Left/Right Arrow switches between Filters and sort and Columns; Home/End selects the first/last available tab. Tab enters the selected panel's controls. Switching tabs preserves the draft, and metadata that hides Columns leaves only the filter tab. The tab controls expose `filter-editor-tab-<widget>-filters` and `filter-editor-tab-<widget>-columns` CSS hooks.

Selecting a saved view imports it into the report draft. **Reset Changes** reapplies that view; **Reset to New View** clears filters and custom quick fields, restores default columns, and sorts by the primary key descending when present. Both discard an open quick-filter edit. These actions leave the saved view unchanged. OK applies the draft to the host form; saving the form persists it. Cancel discards the dialog draft.

Complete conditions, including nested groups, mark the corresponding preview column header. Use that indicator to open the existing filter. It adds no condition; editing a read-only preview stays local, and editor changes remain a draft until OK and host Save. Very narrow columns retain the shared grid’s compact header treatment.

When a preview table declares `usesVariants`, select its backend variant before querying. The choice uses the same per-table browser storage as Record Query (`qqq.tableVariant.<table>`). Switching variants starts a fresh preview page; query/count, full-column copy and statistics use the selection. It does not alter the saved report definition. Application-API query/count require the backend fix in [QQQ PR #913](https://github.com/QRun-IO/qqq/pull/913), merged to QQQ develop as `cba758507dcc54cf282a6638ab50a7d3a1904c7c`; verification used the middleware JAR built from its reviewed source. This does not require or announce a QQQ 4.1 release.



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

### Widget configuration recipes

These examples are payload fragments emitted by an application's backend renderer, with illustrative names and values. Pair them with matching `QWidgetMetaData`; they are not standalone Java producer definitions. Every dispatch label is listed above; the details below cover the shared and specialized configuration that is easy to miss when copying a basic example.

**Responsive placement.** Metadata `defaultValues` accepts `gridCols:sizeClass:xs`, `sm`, `md`, `lg`, `xl`, and `xxl`. Their minimum viewport widths are 0, 576, 768, 992, 1200, and 1400 px. Values are column counts from 1 to 12; numeric strings are accepted. Once any override is set, `xs` defaults to 12 and `xxl` defaults to `gridColumns` or 12. Other declared spans apply until the next declared breakpoint. This example gives a half-width widget from 768 px upward, including 1400 px:

```json
{"gridColumns":6,"defaultValues":{"gridCols:sizeClass:xs":12,"gridCols:sizeClass:md":6}}
```

See [`widgetColumnClasses`](../../src/components/widgets/widget-utils.ts). Parent grids use the same sizing. A `parentWidget` payload such as `{"childWidgetNameList":["totals","trend"],"layoutType":"TABS"}` resolves those names in the instance widget registry. Children inherit parent request parameters and dropdown selections and fetch their own data; tab selection is remembered locally. A child omitted from permitted metadata cannot be configured into existence by listing its name.

**Dropdown data.** Metadata and response lists are paired by position; keep their lengths and order aligned. For the `region` dropdown example above, a response fragment is:

```json
{"dropdownNameList":["regions"],"dropdownLabelList":["Region"],"dropdownDataList":[[{"id":"east","label":"East"},{"id":"west","label":"West"}]],"dropdownDefaultValueList":["east"]}
```

The request parameter is the payload's `dropdownNameList` entry (`regions` here). The backend convention uses the possible-value source name for choice controls and the declared name for date controls. A valid stored choice wins over the response default; unavailable stored choices are cleared. `labelForNullValue` adds an explicit empty option only when the payload has no default. `disableClearable` removes the clear button. To gate the body, return `dropdownNeedsSelectedText` until the required choice is supplied. Metadata `isRequired` and `defaultValue` alone are not consumed as client-side gating/default rules by [`ConnectedWidget`](../../src/components/widgets/ConnectedWidget.tsx). A date control sends local `YYYY-MM-DD` text; the special custom timeframe sends the UTC range described above.

**Charts and statistics.** All seven chart dispatch labels use the canonical shape below. `backgroundColors` and `urls` are arrays aligned with data points; `color` supplies the series color and `backgroundColor` is the stacked-series fallback. Top-level `chartData.urls` supplies category links. `height` is numeric; `isCurrency` or `isYAxisCurrency` enables the renderer's currency formatting.

```json
{"type":"barChart","height":280,"isCurrency":true,"chartData":{"labels":["Open","Closed"],"datasets":[{"label":"Value","data":[1200,800],"backgroundColors":["info","success"],"urls":["/app/orders/","/app/archive/"]}]}}
```

`chartSubheaderData` accepts `mainNumber`, `vsPreviousPercent`, `vsPreviousNumber`, `isUpVsPrevious`, `isGoodVsPrevious`, `vsDescription`, `mainNumberUrl`, and `previousNumberUrl`; use it for the optional comparison summary. See [`QqqChartPayload`](../../src/components/widgets/widget-types.ts). Statistics adds `countFontSize`, `countURL`, `percentageURL`, and `isCurrency` to the basic example; numeric currency counts format as USD, while string counts pass through. A zero or absent percentage hides the change row. Multi-statistics uses this nested shape:

```json
{"type":"multiStatistics","statisticsGroupData":[{"header":"Orders","subheader":"Today","icon":"inventory_2","iconColor":"#0062ff","statisticList":[{"label":"Open","value":7,"url":"/app/orders/"}]}]}
```

**Tables.** Each `table` payload (and each member of `multiTable.tableDataList`) uses the same configuration. `rowsPerPage` defaults to 10; `hidePaginationDropdown` hides its size selector, `fixedHeight` constrains the scroll area, and `fixedStickyLastRow` fixes the final row. `linkText`/`linkURL` add the table link. Columns accept `type`, `header`, `accessor`, `width`, `align`, and `verticalAlign`; widths can be fixed CSS lengths or `fr` shares.

```json
{"type":"table","rowsPerPage":5,"columns":[{"header":"Name","accessor":"name","width":"2fr"},{"header":"Count","accessor":"count","width":"1fr"},{"accessor":"tooltip","type":"hidden"}],"rows":[{"name":"Open","count":7,"tooltip":"Current backlog","subRows":[{"name":"Priority","count":2}]}]}
```

Cell `type` is `default`, `html`, `htmlAndTooltip`, `composite`, `block`, `image`, or `hidden`. An `htmlAndTooltip` cell reads the row's `tooltip`; `image` reads `imageUrl`, `imageLabel`, `imageTotal`, and `imageTotalType`. Composite/block cells read a block payload at the column accessor. Hidden helper columns do not display but remain available to cells and export. `subRows` provides expandable rows. See [`QqqTablePayload`](../../src/components/widgets/QqqTableWidget.tsx) and [`TableWidgetColumn`](../../src/components/widgets/table-widget-utils.ts).

**Display and editor details.** These keys supplement each catalog row; they are read by the linked implementations.

| Widget | Additional configuration |
|---|---|
| `stepper` | Each step accepts `label`, `linkText`, `linkURL`, `iconOverride`, and `colorOverride`; only the active step shows its action link. |
| `fieldValueList` | Use `fieldLabelPrefixIconNames`, `fieldLabelPrefixIconColors`, and `fieldIndentLevels`, keyed by field name. Fields use the shared record formatter, including declared formats/adornments and possible-value record links. |
| `alert` | `alertType` supports ERROR, WARNING, SUCCESS and INFO; absent/unknown values use INFO. `bulletList` contains sanitized HTML strings. Empty `html` renders no alert body. |
| `usaMap` | `mapMarkerList` entries use `name`, `latitude`, and `longitude`; the UI includes the US basemap and an accessible location list. |
| `html`, `generic`, `divider`, `location`, `quickSightChart` | Use the fields in the catalog and shared chrome; these types do not expose host-form editing. QuickSight's optional payload `label` names the iframe. |
| `childRecordList` | `omitFieldNames` and `onlyIncludeFieldNames` control columns. `canAddChildRecord` enables Add; `disabledFieldsForNewChildRecords` locks named defaults, and `defaultValuesForNewChildRecordsFromParentFields` maps child field names to parent field names. `totalRows` supplies the total. A process host uses `isInProcess`, `allowRecordEdit`, and `allowRecordDelete` to control in-memory rows. |
| `rowBuilder` | Metadata defaults include `frontendFields` (fallback `fields`), `associationName`/`outputFieldName`, `orderByFieldName`, `mayReorderRows`, `isForRecordViewAndEditScreen`, `isEditable`, `useModalEditor`, `inlineHeading`, `modalTitle`, and `defaultValuesForNewRowsFromParentRecord`; see the [agent editor guide](./next-ui-agent-guide.md#widget-editors-and-host-forms). |
| `process` | `processMetaData.name` selects the process; payload `defaultValues` presets its inputs. Reloading the widget reinitializes the embedded run. |
| `cronUI`, `dynamicForm`, `pivotTableSetup`, `filterAndColumnsSetup` | These edit host fields through their documented bindings above; changing the widget draft alone does not save a record. Use the shared form context and inspect each editor's validation before introducing a new field binding. |
| `dataBagViewer`, `scriptViewer`, `ESB_OVERVIEW`, `customComponent` | These require their respective backend module/process or trusted bundle described above; ordinary display payloads cannot replace those dependencies. |
| `recordGrid`, `quickLinks`, `processSummary`, `parent`, demo `block` | Use the [demo fixtures](../../src/mocks/fixtures/widgets) and matching renderer for the demo contract. These labels do not imply an equivalent canonical Java renderer. |

**Composite blocks.** `link` and `tooltip` apply to the block; `linkMap` and `tooltipMap` apply to named slots, such as `NUMBER`. Links carry `href` and optional `target`; tooltips carry `title`, `placement`, or nested `blockData`. Help slots can provide fallback tooltip text. `styles` configures the leaf block, while composites also accept `styleOverrides`, sanitized `overlayHtml`, and `overlayStyleOverrides`.

| `blockTypeName` | Values and styles to supply |
|---|---|
| `TEXT` | `values.text`, optional `startIcon`/`endIcon`; `styles.color`, `format`, `size`, `weight`. |
| `NUMBER_ICON_BADGE` | `values.number`, `iconName`. |
| `UP_OR_DOWN_NUMBER` | `values.number`, `context`, `isUp`, `isGood`; `styles.colorOverride`, `isStacked`. |
| `TABLE_SUB_ROW_DETAIL_ROW` | `values.label`, `value`; `styles.labelColor`, `valueColor`. |
| `PROGRESS_BAR` | `values.percent`, `heading`, `value`; `styles.barColor`. |
| `BIG_NUMBER` | `values.heading`, `number`, `context`; `styles.width`, `numberColor`. |
| `DIVIDER` | No values required. |
| `IMAGE` | `values.path`, `alt`; `styles.width`, `height`, `bordered`. |
| `AUDIO` | `values.path`, `showControls`, `autoPlay`; playback still follows browser policy. |
| `ICON` | `values.name`; `styles.color`, `fontSize`. |
| `BUTTON` | `values.label`, `actionCode` or `controlCode`, optional `startIcon`/`endIcon`; `styles.format` is filled, outlined or text. |
| `INPUT_FIELD` | `values.fieldMetaData`, `value`, `placeholder`, `autoFocus`, `submitOnEnter`; host behavior is detailed above. |
| `COMPOSITE` | Nested `blocks`, one of the documented `layout` values, and optional `blockId`/`modalMode`. |

A host evaluates `conditional` as the truthiness of the named host value and interpolates `${name}` in text; it is not a JavaScript expression. Dashboard composites without a process host do not evaluate those conditions. Modal buttons use `showModal:<blockId>`, `hideModal:<blockId>`, or `toggleModal:<blockId>` control codes. A nonempty `modalMode` marks the target composite; a host value with that block ID set to literal `true` opens it initially. This local dashboard example needs no process submission callback:

```json
{"type":"composite","blocks":[{"blockTypeName":"BUTTON","values":{"label":"Details","controlCode":"showModal:details"}},{"blockTypeName":"COMPOSITE","blockId":"details","modalMode":"dialog","blocks":[{"blockTypeName":"TEXT","values":{"text":"Details appear here."}}]}]}
```

See [`QqqComposite`](../../src/components/widgets/blocks/QqqComposite.tsx), [`QqqBlocks`](../../src/components/widgets/blocks/QqqBlocks.tsx), and [`BlockSlot`](../../src/components/widgets/blocks/BlockSlot.tsx). RC6 icon compatibility preserves existing Lucide mappings and adds a locally served glyph for valid unmapped names from the pinned 2,234-name legacy Material Icons inventory. Examples include `3d_rotation`, `account_balance_wallet`, `battery_6_bar`, and `60fps`. Unknown names retain their fallback; this does not include every Material Symbols name or distinct outlined/rounded font variants. Metadata image paths still take precedence. The font and Apache license ship with the static export/JAR; no Google Fonts request is needed at runtime. See the [font provenance](../../public/fonts/material-icons/README.md). This behavior first ships in RC6. The parity ledger also retains open INPUT_FIELD configuration and visual review work.

## 8. Theme, branding, and customization

`QInstance.branding` supplies app/company name, logo/icon, accent colors, banners and optional `gravatarDefault`. A company footer appears when both `companyName` and a safe HTTP(S) `companyUrl` are present. The active application theme is `QInstance.supplementalInstanceMetaData.materialDashboardTheme`, read by [`material-theme.ts`](../../src/lib/theme/material-theme.ts); do not configure `QInstance.theme` and expect these styles to apply. Its optional fields cover palette, fonts, typography, radii, density, logo/icon/favicon, icon style, branded header, app bar, sidebar, table colors, and `customCss`. Invalid theme values are ignored. For example:

```json
{"supplementalInstanceMetaData":{"materialDashboardTheme":{"primaryColor":"#245ca6","fontFamily":"Inter, sans-serif","borderRadiusCard":"12px","brandedHeaderEnabled":true,"brandedHeaderTagline":"Operations","customCss":"[data-qqq-id='sidenav-root'] { border-right: 1px solid #ccc; }"}}}
```

[`apply-branding.ts`](../../src/lib/theme/apply-branding.ts), [`material-theme.ts`](../../src/lib/theme/material-theme.ts), [`tokens.ts`](../../src/lib/theme/tokens.ts), and [`qqq-theme.css`](../../src/styles/qqq-theme.css) define the CSS mapping, including supported Material `--qqq-*` variables. Scope custom CSS to observed `data-qqq-id` attributes, and inspect actual rendering and contrast before migrating a Material stylesheet. A declared application theme sets the app look and keeps light mode active. Without an application theme, the local display-mode preference applies; a fresh profile starts in light mode regardless of the operating system preference. Density is available through theme metadata and local preferences. Open the sidebar user menu → Preferences → Appearance to choose Light or Dark. Changes apply immediately and persist in `localStorage` as `qqq-dark-mode` for this browser profile and origin (scheme, host and port), not the signed-in account; there is no cross-device sync or operating-system mode. Clearing site data removes the preference. When an application theme is active, the choices are disabled with an explanation and the saved preference is retained. Reset to Defaults resets appearance to light along with table and record defaults.

See the [Material CSS hook guide](../CSS-HOOKS.md) for the ID sanitizer, selector patterns, named hooks, and phone/tablet visibility rules.

Analytics is configured by the backend's `QInstance.environmentValues` ([`src/lib/analytics`](../../src/lib/analytics)). It stays off when no analytics values are published. `ANALYTICS_PROVIDERS` can name Google, PostHog, or registered plugins; provider-specific IDs and enable flags are also required. The default privacy behavior omits record IDs, labels and query strings and does not identify users. Only publish `ANALYTICS_INCLUDE_RECORD_DATA=true` or `ANALYTICS_IDENTIFY_USERS=true` after deciding those disclosures are appropriate for the application.

### Theme property reference

All keys below belong to `supplementalInstanceMetaData.materialDashboardTheme`. Unset properties retain the Next defaults. The executable allow-list and value validation are [`THEME_PROPERTY_KINDS`](../../src/lib/theme/material-theme.ts); [`QThemeMetaData`](../../src/types/metadata.ts) defines their types.

| Area | Keys or key pattern |
|---|---|
| Palette | `primaryColor`, `secondaryColor`, `backgroundColor`, `surfaceColor`, `textPrimary`, `textSecondary`, `errorColor`, `warningColor`, `successColor`, `infoColor`. |
| Action color | `preferInfoColorToPrimaryColor` chooses the info color for the controls that honor that option. |
| Fonts | `fontFamily`, `headerFontFamily`, `monoFontFamily`, `fontSizeBase`, `fontWeightLight`, `fontWeightRegular`, `fontWeightMedium`, `fontWeightBold`. |
| Typography | `typography{variant}{property}`, where variant is `H1`–`H6`, `Body1`, `Body2`, `Button`, or `Caption`, and property is `FontSize`, `FontWeight`, `LineHeight`, `LetterSpacing`, or `TextTransform`. Example: `typographyH2FontSize: "1.5rem"`. |
| Radii | `borderRadiusGlobal`, `borderRadiusScale`, and `borderRadius{component}` for `Button`, `Card`, `Chip`, `Dialog`, `OutlinedInput`, `LinearProgress`, `MenuPaper`, `PaperRounded`, `PopoverPaper`, and `Tooltip`. A component radius overrides the global radius; the scale applies when no global radius is set. |
| Density and icons | `density`: `compact`, `normal`, `comfortable`; `iconStyle`: `filled`, `outlined`, `rounded`, `sharp`, `two-tone`. Unsupported icon names can still fall back to the default glyph. |
| Images and CSS | `logoPath`, `iconPath`, `faviconPath`, `customCss`. |
| Branded header | `brandedHeaderEnabled`, `brandedHeaderBackgroundColor`, `brandedHeaderTextColor`, `brandedHeaderLogoPath`, `brandedHeaderLogoAltText`, `brandedHeaderHeight`, `brandedHeaderTagline`. |
| App bar | `appBarBackgroundColor`, `appBarTextColor`. |
| Sidebar | `sidebarBackgroundColor`, `sidebarTextColor`, `sidebarIconColor`, `sidebarSelectedBackgroundColor`, `sidebarSelectedTextColor`, `sidebarHoverBackgroundColor`, `sidebarDividerColor`. |
| Tables | `tableHeaderBackgroundColor`, `tableHeaderTextColor`, `tableRowHoverColor`, `tableRowSelectedColor`, `tableBorderColor`. |
| Borders | `dividerColor`, `borderColor`, `cardBorderColor`. |

Lengths use CSS length strings; colors use supported named, hex, RGB or HSL values. Font weights must be integers from 1 through 1000; radius scale is 0 through 10. Text transforms are `none`, `uppercase`, `lowercase`, or `capitalize`. Invalid values are ignored rather than inserted into CSS. Application CSS and external assets remain trusted configuration, and their actual appearance/CSP must be checked on the host.

### Help content configuration

Fields and sections expose `helpContents`; widgets expose a slot map in `helpContent`. Entries supply `content`, `format` (`TEXT`, `HTML`, or `MARKDOWN`), and optional `roles`. The shared selector prefers the first entry matching the most specific screen role, then an entry without roles. View roles are `VIEW_SCREEN`, `READ_SCREENS`, `ALL_SCREENS`; query substitutes `QUERY_SCREEN`; edit uses `EDIT_SCREEN`, `WRITE_SCREENS`, `ALL_SCREENS`; create/copy substitutes `INSERT_SCREEN`; processes use `PROCESS_SCREEN`, `ALL_SCREENS`.

For example, widget help can use `{"helpContent":{"label":[{"content":"Current totals","format":"TEXT"}],"columnHeader=count":[{"content":"Matching records","format":"TEXT"}]}}`. Table widget headers use `columnHeader=<accessor>` slots; composite slots use `<blockId>,<slot>` keys. Turn on `?helpHelp` to inspect the exact key at the target control before defining content. See [`help-utils.ts`](../../src/lib/utils/help-utils.ts) and [`widgetSlotHelp`](../../src/components/widgets/widget-utils.ts).

### Analytics configuration example

Publish these values through `QInstance.environmentValues`, not frontend build variables. Google uses `GOOGLE_ANALYTICS_ENABLED="true"` and `GOOGLE_ANALYTICS_TRACKING_ID` (a valid GA4 tracking ID). PostHog uses `POSTHOG_ENABLED="true"`, `POSTHOG_API_KEY` (alias `POSTHOG_PROJECT_API_KEY`), and optional `POSTHOG_HOST`, which defaults to `https://us.i.posthog.com`.

```json
{"environmentValues":{"ANALYTICS_PROVIDERS":"google,posthog","GOOGLE_ANALYTICS_ENABLED":"true","GOOGLE_ANALYTICS_TRACKING_ID":"G-EXAMPLE123","POSTHOG_ENABLED":"true","POSTHOG_PROJECT_API_KEY":"<public-project-key>","ANALYTICS_INCLUDE_RECORD_DATA":"false","ANALYTICS_IDENTIFY_USERS":"false"}}
```

Replace the illustrative IDs with the application's public provider identifiers. `ANALYTICS_PROVIDERS` accepts comma-, semicolon-, or newline-separated names; names are lowercased. If omitted, Google and PostHog are considered, but each still requires its own enable/configuration values. `ANALYTICS_PLUGIN_SCRIPTS` (alias `ANALYTICS_PLUGIN_SCRIPT_URLS`) loads configured provider scripts; those register through `window.QQQAnalytics`. Use the [provider registry](../../src/lib/analytics/registry.ts) and [provider interface](../../src/lib/analytics/types.ts), and configure host CSP for each script/endpoint. Privacy defaults and opt-ins are described above; never place server-side provider secrets in environment values exposed to browsers.

## 9. Accessibility, testing, and known boundaries

Components use labeled fields, keyboard navigation, focus-managed dialogs and drawers, inline errors, contained widget failures, and touch layouts. Below 768 px, queries become record cards and filters/actions use sheets; tablet testing uses a touch WebKit project. Test with keyboard and assistive technology in addition to axe. See [browser matrix](../acceptance/browser-matrix.md) and [accessibility rows](../acceptance/feature-matrix.md).

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build:export`, and `pnpm perf:budget` for the relevant change. For RC1, prioritize complete Chromium workflows and the full Chromium gate before expanding browser/viewport coverage; verify defaults, validation, save/reopen and persisted results. The final release acceptance gate is `QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet pnpm test:acceptance` with `QQQ_SAMPLE_JAR` pointing at a compatible real sample build. It verifies SQL/backend behavior as well as browser behavior; mocked tests are not a substitute. See [test setup](../../tests/acceptance/README.md), [performance budget](../acceptance/performance.md), and [API error handling](../API-ERROR-HANDLING.md).

Current limits to account for: the Material parity ledger has open Partial/Missing rows beyond the narrower feature matrix; the report filter/column editor supports variables and API-versioned metadata but still needs complete embedded-query equivalence review; a built-in QFMD bridge does not prove every third-party Material bundle works; root-path static hosting is the documented deployment; and Google Picker requires a backend with the #704 metadata/CSP changes (backend PR #908 merged to develop as `bac663044`). Real Auth0 tenant, Google account, and AWS QuickSight service tests have approved external-service exclusions in the feature matrix. Validate any additional feature against the current branch, backend contract, and matrix before describing it as production-compatible.


### Google Drive process configuration

This implementation is part of work after the immutable RC1 release. RC1 itself retains the disabled picker placeholder; the final 1.0 implementation requires the matching backend changes below.

Set the public browser OAuth client ID and browser API key as `GOOGLE_APP_CLIENT_ID`
and `GOOGLE_APP_API_KEY` in the QInstance environment (normally `QQQ_ENV_` environment
variables). Enable the Google Picker and Drive APIs and configure the application's
JavaScript origin in Google Cloud. Restrict the API key to the required APIs and website
origins, including `https://docs.google.com/*` as required by the
[Google Picker setup guide](https://developers.google.com/workspace/drive/picker/guides/web-picker).
Client secrets are not browser configuration and are not published in v1 metadata.

The Next UI middleware must include the #704 changes (backend PR #908, merged to develop as `bac663044`) that publish these two settings
and permit Google's SDK and picker origins in CSP only when both are configured.
Those conditional headers apply to the Javalin-hosted static export. The standalone
Node/container host must receive `QQQ_DASHBOARD_CSP_SOURCES` at runtime; it does not derive
Google allowances from instance metadata. Merge these sources with any other deployment
additions and start through [`standalone/qqq-server.mjs`](../../standalone/qqq-server.mjs):

```bash
export QQQ_DASHBOARD_CSP_SOURCES='script-src https://accounts.google.com/gsi/client https://apis.google.com; connect-src https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/ https://docs.google.com; style-src https://accounts.google.com/gsi/style'
```

This matches the #704 backend directive additions. The standalone parser adds these to
its base policy; custom reverse proxies/hosts must supply equivalent allowances. See
[`security-headers.mjs`](../../standalone/security-headers.mjs). Keep the metadata client
ID/API key configured too: CSP permissions alone do not enable the picker.

The component preserves Material's
shared-drive folder view and `drive` OAuth scope. It loads the official SDKs before the
button becomes ready, supports retry after loading or authorization errors, rejects files,
and requires selection again if authorization expires before submission. Tokens remain
in screen memory and are submitted to the backend process; they are not persisted in
localStorage or sessionStorage. Without configuration the picker stays disabled while
other inputs remain usable. PRC-065 verifies the browser/backend contract with controlled
Google SDK responses; PRC-039 retains the approved real-account testing exclusion.


### Post-RC4 table appearance correction

RC5 restores the original Next uniform row background; RC4 has alternating row shading. Selection highlighting and opaque pinned cells are retained. Applications can target `data-row-parity="odd"` or `"even"` through their configured CSS if they explicitly want alternating colors.

### API playground theme integration (RC7)

The embedded RapiDoc viewer uses its own shadow DOM. Next applies existing dashboard color tokens to its dark accent/inverse pair and light contact/status colors, preserving the surrounding layout. Preferences theme changes apply without reloading the page. Focused Chromium desktop/mobile checks cover the fixture's visible text, hovered controls and live theme changes; expanded endpoint states, arbitrary custom palettes and narrow-screen inner layout still require review. This correction is not included in RC6.

### TIME block correction (RC7)

Plain process and standalone TIME blocks now use a one-second native input step, matching regular/shared form fields. This permits second-level clock values without a minute-step validation error and makes native stepping advance one second. TIME values remain local clock strings, with no timezone conversion. This correction is published in RC7 at `f65cf6b`; earlier RCs remain unchanged.


### Narrow API controls and LONG validation (RC8)

The API specification Download and View actions fit narrow panels, including 320px phones, and wrap their labels when necessary. Their download/new-tab behavior is preserved. On wide panels, buttons grow to fit the rendered font instead of clipping labels at a fixed width. This correction is not included in RC7.

When the frontend receives LONG range bounds, invalid integer text produces a field error before range comparisons run. Integer-string bounds retain exact precision beyond JavaScript's safe-number range; optional blanks and required-field messages retain their existing behavior. This describes the frontend schema's supported inputs, not a new backend metadata contract. RC8 includes this correction; RC7 does not.
