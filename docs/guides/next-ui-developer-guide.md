# Next UI developer guide

This guide describes the Next UI implementation on `feature/next-1.0` at `3c4b247` (2026-09-26). It is a guide to the code and backend metadata contract, not a claim that Next UI 1.0 has shipped. For acceptance evidence use the [real-server feature matrix](../acceptance/feature-matrix.md); for differences from Material Dashboard use the [Material parity ledger](../acceptance/material-parity.md). The latter still records Partial and Missing items, including custom component bridge and Material CSS compatibility. Recheck those living ledgers when integrating newer work.

## 1. What an application supplies

QQQ supplies an instance metadata document with `apps`, ordered `appTree`, `tables`, `processes`, `reports`, `widgets`, `branding`, `helpContents`, and `environmentValues`. The UI renders those objects for the signed-in user's permissions. A table, widget, or route name is an internal identifier; its `label` is the text users see. Define names and behavior on the backend, then verify the versioned metadata response. Do not edit the frontend to add an application-specific table or menu item.

The source of truth for the frontend shape is [`src/types/metadata.ts`](../../src/types/metadata.ts). A small, **partial response fragment** illustrates the relationships; it is not a complete `QInstance` response:

```json
{
  "appTree": [{ "name": "operations", "label": "Operations", "type": "APP", "children": [{ "name": "orders", "label": "Orders", "type": "TABLE" }] }],
  "apps": { "operations": { "name": "operations", "label": "Operations", "widgets": ["ordersToday"], "sections": [{ "name": "work", "label": "Work", "tables": ["orders"] }] } },
  "widgets": { "ordersToday": { "name": "ordersToday", "label": "Orders today", "type": "statistics", "hasPermission": true, "gridColumns": 4 } },
  "branding": { "appName": "Operations", "accentColor": "#1d4ed8" }
}
```

`appTree` controls the sidebar; `apps[name].widgets` controls ordered dashboard widgets; `apps[name].sections` controls the app home cards. The server may omit denied objects or send disabled permission flags; the frontend also checks flags before requesting data. The server must still enforce authorization. A widget can also be placed in a table section through `QTableSection.widgetName`, or embedded in a process step of type `WIDGET`.

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

The mock setting is for isolated development. Set `NEXT_PUBLIC_MOCK_API=false` and connect a real QQQ backend for integration. `build:export` writes `out/`; `build:jar` packages it with Maven. The Maven POM enforces the presence of static placeholder pages. The default `pnpm build` instead creates a standalone Node server, whose `QQQ_BACKEND_URL` build setting adds same-origin rewrites. For the container path see [`docker/quickstart/Dockerfile`](../../docker/quickstart/Dockerfile). The checked-out `package.json` and POM still say `0.2.1`; use the published artifact version that actually exists, rather than assuming `1.0.0` is available.

| Setting | Behavior in this checkout |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Defaults to `/qqq/v1`; baked into browser requests. Keep the UI and API on the same origin where possible. |
| `NEXT_PUBLIC_MOCK_API` | `true` enables MSW development fixtures; `build:export` forces `false`. |
| `QQQ_NEXT_OUTPUT` | `export` selects the Javalin-hosted static export; otherwise standalone build. |
| `QQQ_BACKEND_URL` | Standalone build only: backend origin for Next rewrites; fixed at build time. |
| `NEXT_PUBLIC_APP_VERSION` | Optional version reported to the backend; defaults to `package.json` version. |

The static export is built for `/`, with `trailingSlash: true`. QQQ serves placeholder HTML for dynamic route shapes; [`useRouteParams`](../../src/lib/hooks/use-route-params.ts) reads real path segments from the browser. Keep that behavior intact when adding routes. The [parity ledger](../acceptance/material-parity.md) currently lists sub-path hosting as unsupported. A plain file server without the QQQ route fallback is not a valid deep-link test.

## 3. Authentication and security

`GET /qqq/v1/metaData/authentication` selects `AUTH_0`, `OAUTH2`, `FULLY_ANONYMOUS`, `MOCK`, or `TABLE_BASED` (see [`QAuthenticationMetaData`](../../src/types/metadata.ts) and [`auth-provider.tsx`](../../src/lib/auth/auth-provider.tsx)). OAuth flows use authorization code and PKCE; table-based sign-in sends credentials to the QQQ session endpoint. The server issues the `sessionUUID` cookie; browser API calls use credentials. A 401 clears session state and returns to sign-in. The pre-login response exposes only limited login branding, not banners or custom CSS.

Permissions apply to metadata and data: check table capabilities and the corresponding read/insert/edit/delete flags, `process.hasPermission`, `report.hasPermission`, and `widget.hasPermission`. A disabled widget can show a permission message without fetching; omitted metadata cannot be guessed from the UI. Use the backend to prove a forbidden operation is rejected. HTML from metadata or widget payloads is sanitized before display. Treat `customCss` and custom component bundles as trusted application configuration with a stricter review boundary. See the [security review](../security/next-ui-review.md) for reviewed behavior and open follow-ups.

## 4. Navigation and deep links

[`useAppTreeRoutes`](../../src/lib/hooks/use-routes.ts) recursively walks `appTree` to build sidebar links, labels, ancestor breadcrumbs, and the first accessible app. `APP` nodes nest; `TABLE`, `PROCESS`, and `REPORT` nodes navigate to `/app/{name}`. An app home uses its `widgets` and `sections`; a table slug opens its query page; a process slug opens its wizard; a report slug opens its runner. The unified route resolves name collisions in that order: app, table, process, report. Use unique names across these maps.

| URL | Screen |
|---|---|
| `/app` | Instance dashboard / app entry point. |
| `/app/{appName}` | App home and its ordered widgets/sections. |
| `/app/{tableName}` | Query or key lookup, according to table capability. |
| `/app/{tableName}/create` | Create record. |
| `/app/{tableName}/{recordId}` | Record view; `/edit`, `/copy`, and `/dev` are subroutes. |
| `/app/{tableName}/key?...` | Unique-key lookup. |
| `/app/{tableName}/savedView/{viewId}` | Server-backed saved query view. |
| `/app/{processName}` | Process run. |
| `/app/{reportName}` | Report run and download. |
| `/app/search?q=...` | Navigation, recent-record, and available record search results. |
| `/app/developer` | Developer information available to permitted users. |

The header search and `/` dialog locate navigation targets and recent records; record search is offered when the backend supports it. The command palette uses `.` or Cmd/Ctrl+K. Keyboard shortcuts on query and record pages are listed in the [feature matrix](../acceptance/feature-matrix.md). Material's nested `/{app}/{table}/{id}` URLs are not the native Next route; only the specific compatibility links covered by the parity ledger should be relied on. For links generated by widgets use [`material-links.ts`](../../src/lib/utils/material-links.ts), which normalizes supported legacy links and preserves a trailing slash for static-export routes.

## 5. Tables, queries, records, and forms

Tables are described by [`QTableMetaData`](../../src/types/metadata.ts): `primaryKeyField`, `fields`, `sections`, `associations`, `exposedJoins`, capabilities, and permission flags. A field supplies `name`, `label`, `type`, `isRequired`, `isEditable`, `isHeavy`, `isHidden`, and `adornments`; possible values, bounds, formats, and help are optional. The supported primitive field types are `STRING`, `INTEGER`, `LONG`, `DECIMAL`, `BOOLEAN`, `DATE`, `TIME`, `DATE_TIME`, `TEXT`, `HTML`, `PASSWORD`, and `BLOB`. [`DynamicFormField`](../../src/components/forms/DynamicFormField.tsx) chooses editors, while [`zod-from-metadata.ts`](../../src/lib/utils/zod-from-metadata.ts) builds validation. Configure fields in QQQ metadata, not in a per-table React component.

The query page supports filters, quick search, sort, column visibility/order/width, density, pagination, CSV export, row selection, bulk process launch, and table variants where declared. `TABLE_QUERY`, `TABLE_GET`, `TABLE_COUNT`, `TABLE_INSERT`, `TABLE_UPDATE`, `TABLE_DELETE`, `TABLE_EXPORT`, and `QUERY_STATS` gate operations alongside permissions. For tables with `usesVariants`, choose a backend-provided variant before querying; it is sent with relevant requests. URL parameters `page`, `pageSize`, `filter`, and `q` carry shareable query state ([`use-record-query.ts`](../../src/lib/hooks/use-record-query.ts)). A saved view uses backend process and record endpoints and has its own route; the menu only appears when those backend capabilities are available ([`use-saved-views.ts`](../../src/lib/hooks/use-saved-views.ts)). Browser local storage holds personal display preferences such as column configuration, not authoritative records or permissions.

Record pages render sections, field values, associated records, widgets, actions, help, and audit history. Create/edit/copy forms follow field metadata and surface server validation. Process launch actions can receive selected record IDs or a filter. `gotoFieldNames` in Material supplemental table metadata enables a Go To dialog for the primary key or configured unique keys. Developer views are capability and permission dependent. Consult [record and query acceptance rows](../acceptance/feature-matrix.md) for exact supported cases; do not infer coverage from the existence of a component alone.

## 6. Processes and reports

`QProcessMetaData` declares the process name, label, table association, permission, limits on input records, and ordered `frontendSteps`. The wizard initializes a run, submits each step, polls asynchronous jobs, handles validation results, and cancels or retries as appropriate ([`ProcessRun.tsx`](../../src/components/process/ProcessRun.tsx), [`processes.ts`](../../src/lib/api/processes.ts)). `QFrontendComponent.type` selects a process component. The currently registered types are:

| Type | Purpose |
|---|---|
| `HELP_TEXT`, `HTML` | Guidance and sanitized markup. |
| `EDIT_FORM`, `VIEW_FORM` | Metadata-driven writable and read-only fields. |
| `RECORD_LIST`, `PROCESS_SUMMARY_RESULTS` | Input/output records and completion summary. |
| `BULK_EDIT_FORM` | Changes applied to selected records. |
| `BULK_LOAD_FILE_MAPPING_FORM`, `BULK_LOAD_VALUE_MAPPING_FORM`, `BULK_LOAD_PROFILE_FORM` | Import mapping and saved profile controls. |
| `VALIDATION_REVIEW_SCREEN` | Review validation findings before commit. |
| `DOWNLOAD_FORM` | Download parameters and result. |
| `GOOGLE_DRIVE_SELECT_FOLDER` | Google folder picker step; real Google service remains an approved external-service exclusion in the matrix. |
| `WIDGET` | Embedded connected widget. |

Do not invent `values` keys for these components: their shapes vary by backend process implementation. Start with the QQQ producer and a [real fixture](../../tests/acceptance/fixture), then verify the versioned response and end-to-end step submission. Reports appear in `QInstance.reports`. [`ReportRun.tsx`](../../src/components/reports/ReportRun.tsx) offers CSV, XLSX, and JSON, handles required inputs and asynchronous process-backed reports, and provides a download. A report without a backing process uses the versioned streaming report route. Saved and scheduled report behavior is covered by the report rows of the acceptance matrix.

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
  dropdowns: [{ name: 'region', label: 'Region', possibleValueSourceName: 'regions', type: 'POSSIBLE_VALUE_SOURCE' }],
  storeDropdownSelections: true,
} satisfies QWidgetMetaData
```

`gridColumns` spans 1–12 twelfths on large screens (default 12); smaller screens stack widgets. `isCard: false` removes card chrome. `minHeight`, `footerHTML`, help content, `icons.topLeftInsideCard`/`topRightInsideCard`, tooltip, reload, and export customize the frame. Payload `label`, `sublabel`, and `footerHTML` can override or add frame text. HTML is sanitized. For export, provide `csvData` as rows of cells; a table payload may also export `columns` and `rows`. The dropdown controls are declared in metadata **and populated by parallel payload lists** (`dropdownNameList`, `dropdownLabelList`, `dropdownDataList`, `dropdownDefaultValueList`). The selected ID becomes a request parameter; a possible-value source uses its source name. Required selection can delay content, and `storeDropdownSelections` persists choices at `qqq.widgets.dropdownData.<widget>.<param>`. See [WID-040–WID-050](../acceptance/feature-matrix.md) for the tested contract.

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
| `table` | `columns` (`header`, `accessor`, alignment) and `rows`, optional `noRowsFoundHTML`, pagination and sticky last row flags. |
| `multiTable` | `tableDataList` of table payloads, each with its own label and rows. |

### Composite and interactive widgets

| `type` | Use and important response fields |
|---|---|
| `composite` | QQQ block tree: `blocks`/`blockTypeName`, layout, values, links, tooltips and styles. Without those fields, demo `childWidgets` uses `CompositeWidget`. |
| `parentWidget` | Server response `childWidgetNameList`; renders permitted registered children in a 12-column grid or `layoutType: "TABS"`. Children fetch their own data. |
| `process` | Inline wizard using `processMetaData`, optional `defaultValues` and selected record IDs. Server permission still applies. |
| `childRecordList` | Joined child records from `queryOutput.records` and `childFrontendTableMetaData`/`childTableMetaData`; optional `viewAllLink`, add-child defaults, and row limits. Record context matters. |
| `customComponent` | Loads a trusted bundle from metadata `defaultValues.componentSourceUrl` and `componentName`, then resolves `window[componentName][componentName]`; review CSP and the parity ledger's missing Material bridge before migrating existing bundles. |
| `cronUI` | Read-only display of a record's expression and time zone using metadata `defaultValues.cronExpressionFieldName`/`timeZoneFieldName`, plus payload `cronDescription`. The record form has a separate cron editor. |
| `dynamicForm` | Read-only labeled `fieldList` and `recordOfFieldValues`; can read merged JSON field values from record context. |
| `dataBagViewer` | Data bag/version browser; uses `queryParams.id` or record ID and reads the built-in `dataBag` and `dataBagVersion` tables. |
| `pivotTableSetup` | Read-only saved report pivot summary from record `pivotTableJson` (`rows`, `columns`, `values`). |
| `filterAndColumnsSetup` | Read-only saved report filter, sort, and columns summary from record JSON fields; optional payload field-name and visibility overrides. |
| `rowBuilder` | Read-only rows from payload `records`, with columns from metadata `defaultValues.fields` when supplied. |
| `scriptViewer` | Script revision and files viewer; uses `queryParams.id` or record ID and the built-in script tables. |
| `ESB_OVERVIEW` | ESB destination/trigger overview; fetches its own ESB API data and does not use the ordinary widget payload for content. Requires the ESB backend module. |

QQQ composite block types rendered by [`QqqBlocks.tsx`](../../src/components/widgets/blocks/QqqBlocks.tsx) include `TEXT`, `BIG_NUMBER`, `UP_OR_DOWN_NUMBER`, `NUMBER_ICON_BADGE`, `ICON`, `TABLE_SUB_ROW_DETAIL_ROW`, `PROGRESS_BAR`, `DIVIDER`, `IMAGE`, `AUDIO`, `INPUT_FIELD`, and `BUTTON`. Supported layouts include `FLEX_COLUMN`, `FLEX_ROW`, `FLEX_ROW_WRAPPED`, `FLEX_ROW_SPACE_BETWEEN`, `FLEX_ROW_CENTER`, `TABLE_SUB_ROW_DETAILS`, and `BADGES_WRAPPER`. Interactive buttons/inputs need a process action callback to have an effect. Unknown block types show a contained warning. See [WID-057–WID-059](../acceptance/feature-matrix.md).

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

`QInstance.branding` can supply `appName`, company information, logo/icon URLs, accent colors, banners, and `customCss`. `QInstance.theme` can supply `primaryColor`, `accentColor`, `mode`, and `customTokens`. [`apply-branding.ts`](../../src/lib/theme/apply-branding.ts), [`tokens.ts`](../../src/lib/theme/tokens.ts), and [`qqq-theme.css`](../../src/styles/qqq-theme.css) define the implemented token behavior. Use scoped `data-qqq-id` selectors for app CSS, then inspect the rendered element: the [parity ledger](../acceptance/material-parity.md) records that several Material `--qqq-*` variables and ID names do not yet map one-for-one. Do not promise a Material theme stylesheet will work unchanged. User preference controls display mode and density locally; server metadata remains the source for app identity and structure.

## 9. Accessibility, testing, and known boundaries

Components use labeled fields, keyboard navigation, focus-managed dialogs and drawers, inline errors, contained widget failures, and touch layouts. Below 768 px, queries become record cards and filters/actions use sheets; tablet testing uses a touch WebKit project. Test with keyboard and assistive technology in addition to axe. See [browser matrix](../acceptance/browser-matrix.md) and [accessibility rows](../acceptance/feature-matrix.md).

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build:export`, and `pnpm perf:budget` for the relevant change. The release acceptance gate is `QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit,mobile,tablet pnpm test:acceptance` with `QQQ_SAMPLE_JAR` pointing at a compatible real sample build. It verifies SQL/backend behavior as well as browser behavior; mocked tests are not a substitute. See [test setup](../../tests/acceptance/README.md), [performance budget](../acceptance/performance.md), and [API error handling](../API-ERROR-HANDLING.md).

Current limits to account for: the Material parity ledger has open Partial/Missing rows beyond the narrower feature matrix; custom components that depend on Material's QFMD bridge or `window.React` globals may fail; root-path static hosting is the documented deployment; a real Auth0 tenant, Google Picker, and AWS QuickSight checks are approved external-service exclusions in the feature matrix. Validate any additional feature against the current branch, backend contract, and matrix before describing it as production-compatible.
