# QQQ Frontend Type Glossary

All types listed here are re-exported from `@/types` (the `src/types/index.ts` barrel).
Application code should always import from `@/types`, not from individual module files,
so that internal type organisation can change without affecting import paths.

```typescript
import type { QInstance, QTableMetaData, QRecord, QQueryFilter } from '@/types'
```

---

## 1. App & Auth

| Type | Source file | Purpose |
|------|-------------|---------|
| `QInstance` | `metadata.ts` | Top-level descriptor returned by `/metaData/instance`; the single source of truth for all apps, tables, processes, reports, widgets, and branding. **Key fields:** `apps`, `tables`, `processes`, `widgets`, `branding`, `appTree`, `environmentValues` |
| `QAuthenticationMetaData` | `metadata.ts` | Describes the auth provider type (`AUTH_0`, `OAUTH2`, `TABLE_BASED`, `FULLY_ANONYMOUS`, `MOCK`), the provider-specific values (client ID, base URL, audience) needed to boot the correct auth flow, and the pre-sign-in `branding` (`QLoginBranding`) the login page shows. |
| `QBrandingMetaData` | `metadata.ts` | Controls visual identity: company name, app name, logo URL, accent color, notification banners, and custom CSS injected via `data-qqq-id` selectors. |
| `QThemeMetaData` | `metadata.ts` | Backend-supplied Tailwind CSS token overrides (`primaryColor`, `accentColor`, `mode`). Applied on top of the default theme by the theme provider. |
| `Banner` | `metadata.ts` | A single notification banner (text, severity `info|warning|error`, optional color, dismissible flag) rendered at the top of the dashboard layout. |

### QInstance example

```typescript
const instance: QInstance = {
  apps: { crm: { name: 'crm', label: 'CRM', children: [], ... } },
  appTree: [{ name: 'crm', label: 'CRM', type: 'APP', ... }],
  tables: { person: { name: 'person', label: 'People', fields: {}, ... } },
  processes: {},
  reports: {},
  widgets: {},
  branding: { companyName: 'Acme', companyUrl: 'https://acme.com', appName: 'Admin' },
  helpContents: {},
  environmentValues: {},
}
```

---

## 2. Metadata

| Type | Source file | Purpose |
|------|-------------|---------|
| `QTableMetaData` | `metadata.ts` | Full descriptor for a QQQ table: fields, sections, join relationships, capabilities, and per-user CRUD permissions. Drives the entire record query, view, create, and edit experience. **Key fields:** `name`, `label`, `primaryKeyField`, `fields`, `sections`, `capabilities`, `readPermission`, `insertPermission`, `editPermission`, `deletePermission` |
| `QFieldMetaData` | `metadata.ts` | Descriptor for a single table column: data type, required/editable/hidden flags, max length, numeric bounds, possible-value source, display format, and adornments. **Key fields:** `name`, `label`, `type`, `isRequired`, `isEditable`, `isHidden`, `possibleValueSourceName`, `adornments` |
| `QProcessMetaData` | `metadata.ts` | Descriptor for a multi-step wizard process: identity, permissions, input record bounds, and the ordered list of `QFrontendStepMetaData` objects to render. |
| `QFrontendStepMetaData` | `metadata.ts` | A single step in a process wizard: label, ordered component list, and optional form/view/record-list field arrays used by the step renderer. |
| `QFrontendComponent` | `metadata.ts` | A single UI component descriptor within a process step — a `type` (from `QComponentType`) plus arbitrary `values` passed as props to the matching renderer. |
| `QAppMetaData` | `metadata.ts` | A top-level app grouping: sidebar navigation children, dashboard widget names, and labeled sections grouping tables, processes, and reports. |
| `QAppTreeNode` | `metadata.ts` | One node in the recursive sidebar navigation tree; the `type` field (`TABLE`, `PROCESS`, `REPORT`, `APP`) determines the route. |
| `QAppSection` | `metadata.ts` | A labeled card group on an app dashboard page, listing the table, process, and report names belonging to that group. |
| `QWidgetMetaData` | `metadata.ts` | Dashboard widget descriptor: renderer type string, permissions, grid column span, optional toolbar dropdowns, reload/export button flags, and help content. |
| `QTableSection` | `metadata.ts` | A collapsible card section on record view/edit pages: field names to display, optional embedded widget name, display tier, and grid column span. |
| `QExposedJoin` | `metadata.ts` | A join relationship made available for query filters and record views: cardinality (`isMany`), joined table metadata, and the path of `QJoinMetaData` hops. |
| `FieldAdornment` | `metadata.ts` | Discriminated union of all adornment shapes (`LINK`, `CHIP`, `TOOLTIP`, `ERROR`, `FILE_DOWNLOAD`, `SIZE`, `REVEAL`, `CODE_EDITOR`, `RENDER_HTML`, `FILE_UPLOAD`). Narrow with `Extract<FieldAdornment, { type: 'LINK' }>`. |

### QFieldMetaData example

```typescript
const field: QFieldMetaData = {
  name: 'firstName',
  label: 'First Name',
  type: 'STRING',
  isRequired: true,
  isEditable: true,
  isHidden: false,
  isHeavy: false,
  maxLength: 100,
  adornments: [],
}
```

---

## 3. Records & Queries

| Type | Source file | Purpose |
|------|-------------|---------|
| `QRecord` | `records.ts` | A single backend record returned by the tables API. `values` holds raw typed data; `displayValues` holds pre-formatted strings ready for rendering. May include `associatedRecords` for joined/child data, and `errors`/`warnings` for bulk operations. |
| `QPossibleValue` | `records.ts` | A single option from a possible-value source, used to populate autocomplete and select inputs. `id` is the stored value; `label` is the user-visible text. |
| `QAuditRecord` | `records.ts` | An audit log entry for a record: who changed it, when, what action (`INSERT`/`UPDATE`/`DELETE`), and the list of `QAuditFieldChange` field-level diffs. |
| `QQueryFilter` | `query.ts` | Root filter object sent to `/tables/{name}/query` and `/tables/{name}/count`. Combines `criteria` with `AND`/`OR`, supports nested `subFilters`, and carries `skip`/`limit` for pagination. |
| `QFilterCriteria` | `query.ts` | A single field-level predicate: a `fieldName`, a `QCriteriaOperator`, and a `values` array that may contain literals or dynamic expressions (`NowExpression`, `NowWithOffsetExpression`, etc.). |
| `QFilterOrderBy` | `query.ts` | A sort clause: `fieldName` and `isAscending`. Multiple entries form a compound sort. |
| `QueryJoin` | `query.ts` | A join instruction sent alongside a `QQueryFilter` when fields from a related table are needed in query results. Specifies `joinTable`, join type (`INNER`/`LEFT`/etc.), and optional alias. |
| `NowWithOffsetExpression` | `query.ts` | A dynamic filter value that resolves to "now minus/plus N days/weeks/months/years" at query time, enabling "last 7 days" style saved filters. |

### QQueryFilter example

```typescript
const filter: QQueryFilter = {
  criteria: [
    { fieldName: 'status', operator: 'EQUALS', values: ['ACTIVE'] },
    { fieldName: 'createdDate', operator: 'GREATER_THAN', values: [{ type: 'NOW_WITH_OFFSET', offsetValue: 30, offsetUnit: 'DAY', isNegativeOffset: true }] },
  ],
  booleanOperator: 'AND',
  orderBys: [{ fieldName: 'lastName', isAscending: true }],
  skip: 0,
  limit: 25,
}
```

---

## 4. Processes

| Type | Source file | Purpose |
|------|-------------|---------|
| `QJobStarted` | `processes.ts` | Initial response after submitting a process step; provides `processUUID` and `jobUUID` for subsequent status polling. |
| `QJobRunning` | `processes.ts` | Intermediate polling response while a job executes asynchronously; provides a `message` and optional `current`/`total` progress counts for the progress bar. |
| `QJobComplete` | `processes.ts` | Terminal success response; carries output `values`, optional `nextStep`/`backStep` navigation hints, and any `processMetaDataAdjustment` that modifies remaining wizard steps. |
| `QJobError` | `processes.ts` | Terminal failure response; provides a technical `error` string and an optional `userFacingError` message for display in the wizard UI. |
| `QJobResponse` | `processes.ts` | Discriminated union of `QJobStarted \| QJobRunning \| QJobComplete \| QJobError`. Narrow by checking for the discriminating property (`jobUUID`, `message`, `values`, or `error`). |
| `ProcessMetaDataAdjustment` | `processes.ts` | Runtime modifications to the process wizard applied after a step completes: `addedSteps`, `removedSteps`, and partial `modifiedFields` overrides. |

### QJobResponse narrowing example

```typescript
function handleJobResponse(response: QJobResponse) {
  if ('error' in response) {
    // QJobError
    showToast(response.userFacingError ?? response.error)
  } else if ('values' in response) {
    // QJobComplete
    advanceToStep(response.nextStep)
  } else if ('message' in response) {
    // QJobRunning — update progress bar
    setProgress({ message: response.message, current: response.current, total: response.total })
  } else {
    // QJobStarted — store jobUUID and start polling
    setJobUUID(response.jobUUID)
  }
}
```

---

## 5. Widgets

| Type | Source file | Purpose |
|------|-------------|---------|
| `WidgetData` | `widgets.ts` | Base shape for all widget data payloads; the `type` string is the discriminant used to select the correct renderer. |
| `ChartWidgetData` | `widgets.ts` | Recharts widget payload: `chartType` (`line`/`bar`/`pie`/`area`), `labels` array, and `datasets` array of `ChartDataset` series. |
| `ChartDataset` | `widgets.ts` | A single Recharts data series: human-readable `label`, ordered `data` values aligned with the parent chart's `labels`, and optional `color`. |
| `StatisticsWidgetData` | `widgets.ts` | KPI tile payload: headline `title`, `value`, optional `unit`, and optional `trend` object with direction (`up`/`down`/`flat`), numeric magnitude, and period label. |
| `HtmlWidgetData` | `widgets.ts` | Raw HTML widget payload; the `html` string **must** be sanitized with DOMPurify before use in `dangerouslySetInnerHTML`. |
| `RecordGridWidgetData` | `widgets.ts` | Tabular record list widget: `tableName`, optional `columns` (field name strings) or `fields` (full `QFieldMetaData[]`), `records` array, and optional `totalCount`. |
| `BlockData` | `widgets.ts` | Discriminated union of all block element types renderable inside a `BlockWidgetData`: `text`, `big_number`, `up_or_down`, `progress`, `button`, `icon`, `image`, `audio`, `divider`, `input`, `html`. |
| `BlockWidgetData` | `widgets.ts` | Ordered heterogeneous block widget: a `blocks` array of `BlockData` variants and an optional `layout` (`vertical`/`horizontal`/`grid`). |

---

## 6. Enums

| Type | Source file | Purpose |
|------|-------------|---------|
| `QFieldType` | `enums.ts` | String-union of all primitive field data types: `STRING`, `INTEGER`, `LONG`, `DECIMAL`, `BOOLEAN`, `DATE`, `TIME`, `DATE_TIME`, `TEXT`, `HTML`, `PASSWORD`, `BLOB`. Determines which renderer, input component, and Zod validator to use. |
| `QCriteriaOperator` | `enums.ts` | String-union of all filter comparison operators used in `QFilterCriteria.operator`: `EQUALS`, `NOT_EQUALS`, `IN`, `NOT_IN`, `CONTAINS`, `STARTS_WITH`, `LESS_THAN`, `GREATER_THAN`, `IS_BLANK`, `IS_NOT_BLANK`, `BETWEEN`, and more. |
| `Capability` | `enums.ts` | String-union of backend-declared table capabilities (`TABLE_QUERY`, `TABLE_GET`, `TABLE_COUNT`, `TABLE_INSERT`, `TABLE_UPDATE`, `TABLE_DELETE`) that gate UI elements such as Create, Edit, and Delete buttons. |
| `QAppNodeType` | `enums.ts` | String-union identifying the entity kind of a sidebar navigation node: `TABLE`, `PROCESS`, `REPORT`, `APP`. Drives route prefix selection in `QAppTreeNode`. |
| `QComponentType` | `enums.ts` | String-union of all UI component types renderable inside a process step: `EDIT_FORM`, `VIEW_FORM`, `RECORD_LIST`, `VALIDATION_REVIEW_SCREEN`, `BULK_LOAD_FILE_MAPPING_FORM`, `PROCESS_SUMMARY_RESULTS`, `HTML`, `WIDGET`, and more. |
| `AdornmentType` | `enums.ts` | String-union of all field adornment identifiers (`LINK`, `CHIP`, `SIZE`, `ERROR`, `RENDER_HTML`, `REVEAL`, `CODE_EDITOR`, `FILE_DOWNLOAD`, `FILE_UPLOAD`, `TOOLTIP`). Mirrors the discriminant property of the `FieldAdornment` union for use in switch statements and type-guard utilities. |

---

## Quick-Reference Import Cheat Sheet

```typescript
// App & auth
import type { QInstance, QAuthenticationMetaData, QBrandingMetaData, Banner } from '@/types'

// Metadata
import type {
  QTableMetaData, QFieldMetaData, QProcessMetaData,
  QFrontendStepMetaData, QWidgetMetaData, FieldAdornment,
} from '@/types'

// Records & queries
import type { QRecord, QPossibleValue, QQueryFilter, QFilterCriteria } from '@/types'

// Processes
import type { QJobResponse, QJobComplete, QJobError, ProcessMetaDataAdjustment } from '@/types'

// Widgets
import type { WidgetData, ChartWidgetData, StatisticsWidgetData, BlockData } from '@/types'

// Enums
import type { QFieldType, QCriteriaOperator, Capability } from '@/types'
```
