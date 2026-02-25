# QQQ Admin UI Modernization: Assessment and Requirements Specification

**Version:** 1.0
**Date:** February 25, 2026
**Status:** Draft
**Author:** Generated via codebase analysis of qqq-middleware-javalin, qqq-frontend-core, qqq-frontend-material-dashboard, and qqq.wiki

---

## Table of Contents

1. [QQQ Framework Assessment](#1-qqq-framework-assessment)
2. [QFMD UI/UX API Catalog](#2-qfmd-uiux-api-catalog)
3. [Semantic API Contract v1.0](#3-semantic-api-contract-v10)
4. [Frontend Framework Evaluation](#4-frontend-framework-evaluation)
5. [New Admin UI Requirements](#5-new-admin-ui-requirements)
6. [Appendix A: File Manifest](#appendix-a-file-manifest)

---

## 1. QQQ Framework Assessment

### 1.1 What QQQ Is

QQQ is a metadata-driven, low-code application framework designed for engineers. The core abstraction is declarative: developers define tables, processes, apps, and widgets as metadata objects in Java, and the framework generates the full application stack automatically. This includes a REST API layer, an admin UI, input validation, authentication and authorization, audit logging, and backend data-store integration.

Rather than writing CRUD controllers, form components, and API routes by hand, a QQQ developer declares a `QTableMetaData` (with fields, joins, sections, permissions, and display hints), registers it in a `QInstance`, and the framework produces query endpoints, record views, edit forms, and list pages without additional code. Business logic is injected through an action-based architecture where developers implement `AbstractQActionFunction<Input, Output>` subclasses that the framework invokes at the appropriate lifecycle points.

### 1.2 Module Inventory

| Module | Description |
|--------|-------------|
| **qqq-backend-core** | Core framework: metadata model, action framework (`AbstractQActionFunction`), context management (`QContext`), query engine (`QQueryFilter`), validation, and backend module interfaces for pluggable data stores (RDBMS, MongoDB, Filesystem, etc.). |
| **qqq-middleware-javalin** | HTTP middleware layer built on Javalin. Exposes the QQQ backend as a versioned REST API (v1), handles session-based authentication, route registration, OpenAPI generation, and serves the SPA frontend. Contains endpoint specs and executor classes. |
| **qqq-frontend-core** | TypeScript library providing the API client layer (`QController`, `QControllerV1`) and all domain model types (`QRecord`, `QTableMetaData`, `QQueryFilter`, etc.). Framework-agnostic; consumed by any frontend implementation. |
| **qqq-frontend-material-dashboard (qfmd)** | The current admin UI. A React + Material UI (MUI) single-page application that dynamically renders pages, forms, tables, and widgets from backend metadata. Uses MUI X DataGrid Pro, Formik, Chart.js, and React Router v6. |

### 1.3 Metadata-Driven Patterns

The metadata flow through the QQQ stack follows a clear pipeline:

**Backend (qqq-backend-core):** Developers instantiate a `QInstance` and register metadata objects: `QTableMetaData` (table definitions with fields, sections, joins, permissions), `QProcessMetaData` (multi-step workflows), `QAppMetaData` (navigation structure), `QWidgetMetaData` (dashboard components), and `QBrandingMetaData` (theming). This metadata is the single source of truth.

**Middleware (qqq-middleware-javalin):** `MetaDataSpecV1` defines a `GET /qqq/v1/metaData` endpoint. Its executor, `MetaDataExecutor`, calls the backend `MetaDataAction`, which assembles the full `QInstance` metadata (filtered by the authenticated user's permissions) and returns it as a `MetaDataResponseV1`. This response includes the app tree (hierarchical navigation), all table definitions (light metadata), all process definitions, widget definitions, branding, help content, and environment values. Additional endpoints serve detailed per-table metadata (`GET /qqq/v1/metaData/table/{tableName}` via `TableMetaDataSpecV1`) and per-process metadata (`GET /qqq/v1/metaData/process/{processName}` via `ProcessMetaDataSpecV1`).

**Frontend (qqq-frontend-core + qfmd):** On application load, `QController.loadMetaData()` fetches the full instance metadata (memoized to avoid redundant calls). The `App.tsx` entry point traverses the returned `appTree` to dynamically generate React Router routes for every app, table, process, and report. Each table gets routes for query (list), create, view, edit, copy, and developer views. Each process gets a route for execution. The UI components (`RecordQuery`, `RecordView`, `EntityForm`, `ProcessRun`) read field definitions, section layouts, permissions, and display hints from the metadata to render themselves dynamically. No table or form is hardcoded; the entire UI structure is derived from what the backend declares.

### 1.4 Key Architectural Constraints

**Backend is the source of truth.** All metadata, permissions, and business logic reside in the Java backend. The frontend never defines schema; it only consumes and renders what the backend provides.

**Frontend is a pure consumer.** The qfmd UI is a "dumb" renderer. It fetches metadata, builds routes and forms dynamically, and delegates all data operations back to the API. There is no client-side business logic beyond form validation (which mirrors server-defined constraints).

**The API is implicit.** While the backend uses `AbstractEndpointSpec` classes with OpenAPI annotations, there is no formal, published OpenAPI specification document today. The API contract is defined by the intersection of the Javalin spec classes and the `QController`/`QControllerV1` TypeScript methods. This document (Section 3) formalizes that implicit contract.

**Tight coupling to MUI.** The current frontend is deeply coupled to Material UI (MUI) components, MUI X DataGrid Pro, and the Material Dashboard 2 Pro theme. Component abstractions sit atop MUI primitives. Layout, theming, and responsive behavior are all MUI-specific. A replacement UI must provide equivalent component richness without this coupling.

**Session-based authentication.** The API uses a `sessionUUID` cookie for authentication. Sessions are created via `POST /manageSession` after an OAuth2/OIDC flow. OIDC back-channel logout is supported for IdP-initiated session termination.

**Versioned middleware.** The API is served under `/qqq/v1/` with `MiddlewareVersionV1` registering all 12 endpoint specs. The architecture supports adding future versions (v2, v3) alongside v1 via `AbstractMiddlewareVersion`.

---

## 2. QFMD UI/UX API Catalog

### 2.1 Versioned API Endpoints (v1 — Javalin Middleware Specs)

These endpoints are formally defined in `qqq-middleware-javalin/specs/v1/` and registered in `MiddlewareVersionV1`. All paths are prefixed with `/qqq/v1/`.

| HTTP Method | Path Pattern | QController Method | Purpose | Request Shape | Response Shape |
|---|---|---|---|---|---|
| GET | `/metaData/authentication` | `getAuthenticationMetaData()` | Discover authentication type and configuration (unsecured) | None | `QAuthenticationMetaData { name, type, data: { clientId, baseUrl, audience } }` |
| POST | `/manageSession` | `manageSession(accessToken)` | Create/refresh session from OAuth2 access token (unsecured) | Form: `accessToken: string` | `{ uuid: string, values: Record<string, any> }` + sets `sessionUUID` cookie |
| POST | `/logout` | N/A (handled by auth module) | Invalidate session and clear cookie | Cookie: `sessionUUID` | Empty response + removes cookie |
| POST | `/oidc/backchannel-logout` | N/A (server-side only) | OIDC IdP-initiated back-channel logout | Form: `logout_token: string (JWT)` | Empty response (HTTP 200) |
| GET | `/metaData` | `loadMetaData()` | Fetch full application metadata (apps, tables, processes, widgets, branding) | Query: `frontendName?, frontendVersion?, applicationName?, applicationVersion?` | `MetaDataResponseV1 { apps, appTree, tables, processes, reports, widgets, branding, helpContents, environmentValues }` |
| GET | `/metaData/table/{tableName}` | `loadTableMetaData(tableName)` | Fetch detailed table metadata (fields, sections, joins, permissions) | Path: `tableName` | `QTableMetaData { name, label, primaryKeyField, fields, sections, exposedJoins, capabilities, permissions, helpContent, ... }` |
| GET | `/metaData/process/{processName}` | `loadProcessMetaData(processName)` | Fetch process metadata (steps, components, form fields) | Path: `processName` | `QProcessMetaData { name, label, tableName, frontendSteps, stepFlow, minInputRecords, maxInputRecords, ... }` |
| POST | `/table/{tableName}/query` | `query(tableName, filter, queryJoins, tableVariant)` (V1) | Query table records with filtering, sorting, pagination | JSON: `{ filter: QQueryFilter, joins?: QueryJoin[], tableVariant?: string }` | `{ records: QRecord[] }` |
| POST | `/table/{tableName}/count` | `count(tableName, filter, queryJoins, includeDistinct, tableVariant)` (V1) | Count records matching filter | JSON: `{ filter: QQueryFilter, joins?: QueryJoin[], tableVariant?: string }` + Query: `includeDistinct?` | `{ count: number, distinctCount?: number }` |
| POST | `/processes/{processName}/init` | `processInit(processName, values, recordsParam, ...)` | Initialize a process execution | Form: `values (JSON), recordsParam, recordIds, filterJSON, stepTimeoutMillis, file (binary)` | `ProcessInitOrStepOrStatusResponseV1` (see below) |
| POST | `/processes/{processName}/{processUUID}/step/{stepName}` | `processStep(processName, processUUID, step, values, ...)` | Advance a running process to the next step | Form: `values (JSON), stepTimeoutMillis, file (binary)` | `ProcessInitOrStepOrStatusResponseV1` |
| GET | `/processes/{processName}/{processUUID}/status/{jobUUID}` | `processJobStatus(processName, processUUID, jobUUID)` | Poll async process job status | Path: `processName, processUUID, jobUUID` | `ProcessInitOrStepOrStatusResponseV1` |

**Process Response Union Type (`ProcessInitOrStepOrStatusResponseV1`):**
- `QJobStarted { processUUID, jobUUID }` — async job started, poll via status endpoint
- `QJobRunning { processUUID, message, current?, total? }` — job in progress with optional progress
- `QJobComplete { processUUID, values, nextStep, backStep, processMetaDataAdjustment? }` — step completed
- `QJobError { processUUID, error, userFacingError? }` — step failed

### 2.2 Legacy/Unversioned API Endpoints (QJavalinImplementation)

These endpoints are called by `QController.ts` (the original, non-V1 controller) and are served by the legacy `QJavalinImplementation` class under the `/data/` and `/processes/` path prefixes. They predate the versioned spec system.

| HTTP Method | Path Pattern | QController Method | Purpose | Request Shape | Response Shape |
|---|---|---|---|---|---|
| GET | `/data/{tableName}/{primaryKey}` | `get(tableName, primaryKey, ...)` | Fetch single record by primary key | Path: `tableName, primaryKey`; Query: `tableVariant?, includeAssociations?, queryJoins?` | `QRecord` |
| POST | `/data/{tableName}` | `create(tableName, body)` | Insert new record | FormData: field values | `QRecord` |
| PUT | `/data/{tableName}/{id}` | `update(tableName, id, body)` | Update existing record | FormData: field values | `QRecord` |
| DELETE | `/data/{tableName}/{id}` | `delete(tableName, id)` | Delete record by primary key | Path: `tableName, id` | `number` (deleted count) |
| POST | `/data/{tableName}/count` | `count(tableName, filter)` (legacy) | Count records | Query params: `filter (JSON)` | `[count, distinctCount?]` |
| POST | `/data/{tableName}/query` | `query(tableName, filter)` (legacy) | Query records | Query params: `filter (JSON), queryJoins?, tableVariant?` | `QRecord[]` |
| GET | `/data/{tableName}/variants` | `tableVariants(tableName)` | Get table variants | Path: `tableName` | `QTableVariant[]` |
| POST | `/data/{tableName}/possibleValues/{fieldName}` | `possibleValues(...)` | Get possible values for a field (table context) | Form: `searchTerm?, ids?, labels?, values?, useCase?` | `QPossibleValue[]` |
| POST | `/processes/{processName}/possibleValues/{fieldName}` | `possibleValues(...)` | Get possible values (process context) | Form: `searchTerm?, ids?, labels?, values?, useCase?, processUUID?` | `QPossibleValue[]` |
| POST | `/possibleValues/{fieldName}` | `possibleValues(...)` | Get possible values (no context) | Form: `searchTerm?, ids?, labels?, values?, useCase?` | `QPossibleValue[]` |
| POST | `/processes/{processName}/init` | `processInit(...)` | Initialize process (legacy) | FormData/QueryString | `QJobStarted \| QJobComplete \| QJobError` |
| POST | `/processes/{processName}/run` | `processRun(...)` | Run process (single-shot, no async) | FormData/QueryString + `dontGoAsyncOnBackend?` | `QJobStarted \| QJobComplete \| QJobError` |
| POST | `/processes/{processName}/{processUUID}/step/{step}` | `processStep(...)` | Advance process step (legacy) | FormData/QueryString | `QJobStarted \| QJobComplete \| QJobError` |
| GET | `/processes/{processName}/{processUUID}/status/{jobUUID}` | `processJobStatus(...)` | Poll async job status (legacy) | Path params | `QJobRunning \| QJobComplete \| QJobError` |
| GET | `/processes/{processName}/{processUUID}/records` | `processRecords(processName, processUUID, skip, limit)` | Get paginated records from a running process | Query: `skip, limit` | `{ totalRecords: number, records: QRecord[] }` |
| GET | `/processes/{processName}/{processUUID}/cancel` | `processCancel(processName, processUUID)` | Cancel a running process | Path params | `boolean` |
| GET | `/widget/{widgetName}` | `widget(widgetName, urlParams)` | Fetch widget data | Query: dynamic key-value params | `any` (widget-specific JSON) |
| GET | `/data/{tableName}/{primaryKey}/developer` | `getRecordDeveloperMode(tableName, primaryKey)` | Get developer-mode record details | Path params | `any` |
| POST | `/data/{tableName}/{primaryKey}/developer/associatedScript/{fieldName}` | `storeRecordAssociatedScript(...)` | Store an associated script for a record | FormData: `contents, commitMessage` | `any` |
| GET | `/data/{tableName}/{primaryKey}/developer/associatedScript/{fieldName}/{scriptRevisionId}/logs` | `getRecordAssociatedScriptLogs(...)` | Get logs for a script revision | Path params | `any` |
| POST | `/data/{tableName}/{primaryKey}/developer/associatedScript/{fieldName}/test` | `testScript(...)` | Test a script against a record | FormData: `code, input values` | `any` |

### 2.3 Discrepancies Between Frontend and Backend

The following endpoints exist in `QController.ts` but do **not** have corresponding formal spec classes in `specs/v1/`:

- `GET /data/{tableName}/{primaryKey}` (single record get) — no `TableGetSpecV1`
- `POST /data/{tableName}` (insert) — no `TableInsertSpecV1`
- `PUT /data/{tableName}/{id}` (update) — no `TableUpdateSpecV1`
- `DELETE /data/{tableName}/{id}` (delete) — no `TableDeleteSpecV1`
- `GET /data/{tableName}/variants` — no `TableVariantsSpecV1`
- `POST .../possibleValues/{fieldName}` — no `PossibleValuesSpecV1`
- `GET /widget/{widgetName}` — no `WidgetDataSpecV1`
- `POST /processes/{processName}/run` — no `ProcessRunSpecV1` (only init, step, status in v1)
- `GET /processes/.../records` — no `ProcessRecordsSpecV1`
- `GET /processes/.../cancel` — no `ProcessCancelSpecV1`
- All developer/script endpoints — no v1 specs

These are served by the legacy `QJavalinImplementation` and have not yet been migrated to the formal v1 spec system. **The v1 spec layer is incomplete** — it covers metadata, auth, table query/count, and process init/step/status, but does not yet cover CRUD operations, possible values, widgets, developer tools, or all process lifecycle endpoints.

---

## 3. Semantic API Contract v1.0

### 3.1 Overview

This section formalizes the implicit QQQ REST API into an explicit, versioned contract. Any frontend implementation (not just qfmd) can be built against this specification.

**Version:** `v1.0`
**Base Path:** `/qqq/v1/`
**Content-Type:** `application/json` (responses), `multipart/form-data` (process/CRUD requests with file uploads)
**Authentication:** Cookie-based session (`sessionUUID` cookie) for all secured endpoints

### 3.2 Authentication Endpoints

#### 3.2.1 Get Authentication Metadata

```
GET /qqq/v1/metaData/authentication
Authentication: None (public)
```

**Response 200:**
```json
{
  "name": "string",
  "type": "AUTH_0 | OAUTH2 | FULLY_ANONYMOUS | MOCK",
  "values": {
    "clientId": "string",
    "baseUrl": "string",
    "audience": "string"
  }
}
```

#### 3.2.2 Create/Manage Session

```
POST /qqq/v1/manageSession
Authentication: None (public)
Content-Type: multipart/form-data
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accessToken` | string | Yes | OAuth2/OIDC access token |

**Response 200:**
```json
{
  "uuid": "string",
  "values": { }
}
```
Sets `sessionUUID` cookie with the session UUID.

#### 3.2.3 Logout

```
POST /qqq/v1/logout
Authentication: Required (sessionUUID cookie)
```

**Response 200:** Empty body. Removes `sessionUUID` cookie.

#### 3.2.4 OIDC Back-Channel Logout

```
POST /qqq/v1/oidc/backchannel-logout
Authentication: None (JWT in body)
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `logout_token` | string | Yes | JWT from Identity Provider containing `sub` or `sid` claims |

**Response 200:** Empty body.

### 3.3 Metadata Endpoints

#### 3.3.1 Application Metadata

```
GET /qqq/v1/metaData
Authentication: Required
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `frontendName` | string | No | Frontend identifier (e.g., "qqq-frontend-material-dashboard") |
| `frontendVersion` | string | No | Frontend version string |
| `applicationName` | string | No | Application instance name |
| `applicationVersion` | string | No | Application version |

**Response 200:**
```json
{
  "apps": {
    "{appName}": {
      "name": "string",
      "label": "string",
      "children": ["QAppTreeNode"],
      "iconName": "string",
      "widgets": ["string"],
      "sections": [{
        "name": "string",
        "label": "string",
        "icon": { "name": "string", "path": "string", "color": "string" },
        "tables": ["string"],
        "processes": ["string"],
        "reports": ["string"]
      }]
    }
  },
  "appTree": [{
    "name": "string",
    "label": "string",
    "type": "TABLE | PROCESS | REPORT | APP",
    "children": ["QAppTreeNode"],
    "iconName": "string",
    "icon": { "name": "string", "path": "string", "color": "string" }
  }],
  "tables": {
    "{tableName}": {
      "name": "string",
      "label": "string",
      "isHidden": "boolean",
      "primaryKeyField": "string",
      "iconName": "string",
      "capabilities": ["TABLE_QUERY", "TABLE_GET", "TABLE_COUNT", "TABLE_INSERT", "TABLE_UPDATE", "TABLE_DELETE"],
      "readPermission": "boolean",
      "insertPermission": "boolean",
      "editPermission": "boolean",
      "deletePermission": "boolean"
    }
  },
  "processes": {
    "{processName}": {
      "name": "string",
      "label": "string",
      "tableName": "string",
      "isHidden": "boolean",
      "iconName": "string",
      "hasPermission": "boolean"
    }
  },
  "reports": { },
  "widgets": { },
  "branding": {
    "companyName": "string",
    "companyUrl": "string",
    "appName": "string",
    "logo": "string",
    "icon": "string",
    "accentColor": "string",
    "banners": { }
  },
  "helpContents": { },
  "environmentValues": { }
}
```

#### 3.3.2 Table Metadata

```
GET /qqq/v1/metaData/table/{tableName}
Authentication: Required + READ permission on table
```

**Response 200:**
```json
{
  "name": "string",
  "label": "string",
  "isHidden": "boolean",
  "primaryKeyField": "string",
  "fields": {
    "{fieldName}": {
      "name": "string",
      "label": "string",
      "type": "STRING | INTEGER | LONG | DECIMAL | BOOLEAN | DATE | TIME | DATE_TIME | TEXT | HTML | PASSWORD | BLOB",
      "isRequired": "boolean",
      "isEditable": "boolean",
      "isHeavy": "boolean",
      "isHidden": "boolean",
      "defaultValue": "any",
      "possibleValueSourceName": "string",
      "displayFormat": "string",
      "maxLength": "number",
      "gridColumns": "number",
      "adornments": [{
        "type": "LINK | CHIP | SIZE | ERROR | RENDER_HTML | REVEAL | CODE_EDITOR | FILE_DOWNLOAD | FILE_UPLOAD | TOOLTIP",
        "values": { }
      }],
      "helpContents": [],
      "behaviors": []
    }
  },
  "sections": [{
    "name": "string",
    "label": "string",
    "tier": "string",
    "iconName": "string",
    "fieldNames": ["string"],
    "widgetName": "string",
    "isHidden": "boolean",
    "gridColumns": "number"
  }],
  "exposedJoins": [{
    "label": "string",
    "isMany": "boolean",
    "joinTable": "QTableMetaData",
    "joinPath": [{ "name": "string", "type": "ONE_TO_ONE | ONE_TO_MANY | MANY_TO_ONE", "leftTable": "string", "rightTable": "string" }]
  }],
  "capabilities": ["string"],
  "readPermission": "boolean",
  "insertPermission": "boolean",
  "editPermission": "boolean",
  "deletePermission": "boolean",
  "usesVariants": "boolean",
  "variantTableLabel": "string",
  "helpContent": { },
  "supplementalTableMetaData": { },
  "shareableTableMetaData": { }
}
```

#### 3.3.3 Process Metadata

```
GET /qqq/v1/metaData/process/{processName}
Authentication: Required
```

**Response 200:**
```json
{
  "name": "string",
  "label": "string",
  "tableName": "string",
  "isHidden": "boolean",
  "iconName": "string",
  "hasPermission": "boolean",
  "stepFlow": "LINEAR",
  "minInputRecords": "number",
  "maxInputRecords": "number",
  "frontendSteps": [{
    "name": "string",
    "label": "string",
    "format": "string",
    "components": [{
      "type": "HELP_TEXT | BULK_EDIT_FORM | BULK_LOAD_FILE_MAPPING_FORM | BULK_LOAD_VALUE_MAPPING_FORM | BULK_LOAD_PROFILE_FORM | VALIDATION_REVIEW_SCREEN | EDIT_FORM | VIEW_FORM | DOWNLOAD_FORM | RECORD_LIST | PROCESS_SUMMARY_RESULTS | GOOGLE_DRIVE_SELECT_FOLDER | WIDGET | HTML",
      "values": { }
    }],
    "formFields": ["QFieldMetaData"],
    "viewFields": ["QFieldMetaData"],
    "recordListFields": ["QFieldMetaData"],
    "helpContents": []
  }]
}
```

### 3.4 Table Data Endpoints

#### 3.4.1 Query Records

```
POST /qqq/v1/table/{tableName}/query
Authentication: Required + READ permission
```

**Request Body:**
```json
{
  "filter": {
    "criteria": [{
      "fieldName": "string",
      "operator": "EQUALS | NOT_EQUALS | NOT_EQUALS_OR_IS_NULL | IN | NOT_IN | STARTS_WITH | ENDS_WITH | CONTAINS | NOT_STARTS_WITH | NOT_ENDS_WITH | NOT_CONTAINS | LESS_THAN | LESS_THAN_OR_EQUALS | GREATER_THAN | GREATER_THAN_OR_EQUALS | IS_BLANK | IS_NOT_BLANK | BETWEEN | NOT_BETWEEN",
      "values": ["any"],
      "otherFieldName": "string"
    }],
    "orderBys": [{
      "fieldName": "string",
      "isAscending": "boolean"
    }],
    "subFilters": ["QQueryFilter"],
    "booleanOperator": "AND | OR",
    "skip": "number",
    "limit": "number"
  },
  "joins": [{
    "joinTable": "string",
    "select": "boolean",
    "type": "INNER | LEFT | RIGHT | FULL",
    "baseTableOrAlias": "string",
    "alias": "string",
    "joinName": "string"
  }],
  "tableVariant": "string"
}
```

**Response 200:**
```json
{
  "records": [{
    "tableName": "string",
    "recordLabel": "string",
    "values": { "{fieldName}": "any" },
    "displayValues": { "{fieldName}": "string" },
    "errors": ["string"],
    "warnings": ["string"]
  }]
}
```

#### 3.4.2 Count Records

```
POST /qqq/v1/table/{tableName}/count
Authentication: Required + READ permission
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeDistinct` | boolean | No | Whether to include distinct count |

**Request Body:** Same filter/joins structure as query.

**Response 200:**
```json
{
  "count": "number",
  "distinctCount": "number"
}
```

#### 3.4.3 Get Single Record (Not Yet in v1 Specs)

```
GET /qqq/v1/table/{tableName}/{primaryKey}
Authentication: Required + READ permission
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tableVariant` | string | No | Table variant identifier |
| `includeAssociations` | boolean | No | Include associated records |
| `queryJoins` | string (JSON) | No | Join specifications |

**Response 200:** `QRecord`

#### 3.4.4 Insert Record (Not Yet in v1 Specs)

```
POST /qqq/v1/table/{tableName}
Authentication: Required + INSERT permission
Content-Type: multipart/form-data
```

**Request Body:** Form fields matching table field names.

**Response 200:** `QRecord` (inserted record with generated ID)

#### 3.4.5 Update Record (Not Yet in v1 Specs)

```
PUT /qqq/v1/table/{tableName}/{primaryKey}
Authentication: Required + EDIT permission
Content-Type: multipart/form-data
```

**Request Body:** Form fields with updated values.

**Response 200:** `QRecord` (updated record)

#### 3.4.6 Delete Record (Not Yet in v1 Specs)

```
DELETE /qqq/v1/table/{tableName}/{primaryKey}
Authentication: Required + DELETE permission
```

**Response 200:**
```json
{
  "deletedCount": "number"
}
```

### 3.5 Process Endpoints

#### 3.5.1 Initialize Process

```
POST /qqq/v1/processes/{processName}/init
Authentication: Required
Content-Type: multipart/form-data
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `values` | string (JSON) | No | Initial process values |
| `recordsParam` | string | No | One of: `recordIds`, `filterJSON`, `filterId` |
| `recordIds` | string | Conditional | Comma-separated primary keys (when recordsParam=recordIds) |
| `filterJSON` | string | Conditional | QQueryFilter JSON (when recordsParam=filterJSON) |
| `stepTimeoutMillis` | number | No | Async timeout in ms (default: 3000) |
| `file` | binary | No | File upload |

**Response 200:** `QJobStarted | QJobComplete | QJobError` (see union type in Section 2.1)

#### 3.5.2 Process Step

```
POST /qqq/v1/processes/{processName}/{processUUID}/step/{stepName}
Authentication: Required
Content-Type: multipart/form-data
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `values` | string (JSON) | No | Step form values |
| `stepTimeoutMillis` | number | No | Async timeout in ms (default: 3000) |
| `file` | binary | No | File upload for this step |

**Response 200:** `QJobStarted | QJobComplete | QJobError`

#### 3.5.3 Process Status (Poll)

```
GET /qqq/v1/processes/{processName}/{processUUID}/status/{jobUUID}
Authentication: Required
```

**Response 200:** `QJobRunning | QJobComplete | QJobError`

#### 3.5.4 Process Records (Not Yet in v1 Specs)

```
GET /qqq/v1/processes/{processName}/{processUUID}/records
Authentication: Required
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `skip` | number | No | Records to skip |
| `limit` | number | No | Max records to return |

**Response 200:**
```json
{
  "totalRecords": "number",
  "records": ["QRecord"]
}
```

#### 3.5.5 Cancel Process (Not Yet in v1 Specs)

```
GET /qqq/v1/processes/{processName}/{processUUID}/cancel
Authentication: Required
```

**Response 200:** `boolean`

### 3.6 Widget Endpoints (Not Yet in v1 Specs)

```
GET /qqq/v1/widget/{widgetName}
Authentication: Required
```

**Query Parameters:** Dynamic, widget-specific key-value pairs.

**Response 200:** Widget-specific JSON payload. Shape varies by widget type (chart data, record grids, statistics, HTML content, etc.).

### 3.7 Possible Values Endpoints (Not Yet in v1 Specs)

```
POST /qqq/v1/table/{tableName}/possibleValues/{fieldName}
POST /qqq/v1/processes/{processName}/possibleValues/{fieldName}
POST /qqq/v1/possibleValues/{fieldName}
Authentication: Required
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `searchTerm` | string | No | Text search filter |
| `ids` | string | No | Specific IDs to look up |
| `labels` | string | No | Specific labels to look up |
| `values` | string | No | Pre-selected values |
| `useCase` | string | No | Context hint for filtering |

**Response 200:**
```json
[{
  "id": "number | string",
  "label": "string"
}]
```

### 3.8 Error Response Shape

All error responses follow a consistent shape:

```json
{
  "error": "string"
}
```

**HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Unauthorized (no valid session) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (table, process, or record does not exist) |
| 500 | Internal Server Error |

### 3.9 Pagination Contract

Based on analysis of `QQueryFilter` and `TableQuerySpecV1`:

The pagination model is **offset/limit** based:
- `filter.skip` (number): Number of records to skip (offset). Default: 0.
- `filter.limit` (number): Maximum number of records to return. No enforced maximum from the API; the frontend typically defaults to 10, 25, 50, or 100.

There is no cursor-based pagination. The frontend manages page state by computing `skip = (pageNumber - 1) * pageSize` and sending it with each query. Total count is obtained via a separate `/count` call.

### 3.10 Filtering Contract

Based on analysis of `QQueryFilter`, `QFilterCriteria`, and `QCriteriaOperator`:

Filters are tree-structured with boolean operators:
- Top-level `QQueryFilter` contains `criteria[]`, `orderBys[]`, and optional `subFilters[]`
- `booleanOperator` (`AND` | `OR`) controls how criteria are combined
- `subFilters` allow nested boolean logic (e.g., `(A AND B) OR (C AND D)`)
- Each `QFilterCriteria` specifies `fieldName`, `operator`, and `values[]`
- Special expression types are supported in values: `FilterVariableExpression`, `NowExpression`, `NowWithOffsetExpression`, `ThisOrLastPeriodExpression`

### 3.11 Backwards Compatibility Policy

Per the QQQ Semantic Versioning Policy (from wiki):

- **Public API surfaces** subject to SemVer include REST endpoints, request/response shapes, query parameter names, and HTTP status codes.
- **PATCH versions** may include bug fixes, security patches, and performance optimizations without changing the API contract.
- **MINOR versions** may add new optional fields to responses, new optional query parameters, new endpoints, and new enum values — all backward-compatible additions.
- **MAJOR versions** may include breaking changes: removing endpoints, changing required parameters, altering response shapes, or removing enum values.
- **Deprecation policy**: Two-version deprecation cycle. Deprecated features are annotated and kept available for at least one major version before removal.
- **Recommendation**: The v1 API contract defined in this document should be frozen once formalized. New capabilities should be added as backward-compatible extensions (new optional fields, new endpoints). Breaking changes require a v2 contract.

---

## 4. Frontend Framework Evaluation

### 4.1 Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| SSR/SSG capability | Medium | Server-side rendering and static generation support |
| TypeScript support | High | First-class TypeScript integration |
| Routing | High | File-based or declarative routing, dynamic route support |
| Data fetching | High | Built-in data loading, caching, optimistic updates |
| Component ecosystem | Medium | Availability of headless UI libraries, design system support |
| Bundle size / performance | Medium | Initial load time, code splitting |
| Community / longevity | Medium | Adoption trajectory, corporate backing, ecosystem health |
| Developer experience | Medium | Hot reload, error messages, tooling |
| Metadata-driven UI suitability | High | Ability to dynamically render UI from server-provided metadata schemas |

### 4.2 Framework Evaluations

#### 4.2.1 Next.js (App Router)

Next.js is the most mature and widely adopted React meta-framework, backed by Vercel. The App Router (introduced in v13, now stable) provides React Server Components, streaming SSR, nested layouts, and a powerful data fetching model. It has the largest ecosystem of any frontend meta-framework.

| Criterion | Score | Notes |
|-----------|-------|-------|
| SSR/SSG capability | High | Full SSR, SSG, ISR, streaming, and hybrid rendering |
| TypeScript support | High | First-class, zero-config TypeScript |
| Routing | High | File-based routing with dynamic segments, catch-all routes, route groups, parallel routes |
| Data fetching | High | Server Components, `fetch` with caching, React Query integration, Server Actions for mutations |
| Component ecosystem | High | Largest React ecosystem: shadcn/ui, Radix, Headless UI, React Admin, Refine, TanStack |
| Bundle size / performance | Medium | Larger baseline than SvelteKit; mitigated by code splitting and Server Components |
| Community / longevity | High | Backed by Vercel, massive community, dominant market share |
| Developer experience | High | Excellent HMR (Turbopack), detailed error overlays, strong tooling |
| Metadata-driven UI suitability | High | Dynamic routing via `[...slug]`, Server Components for metadata fetching, vast library of form/table/widget components |

**Pros for QQQ:**
- The React ecosystem has battle-tested dynamic form generators (React Hook Form, Formik), data grids (TanStack Table, AG Grid), and schema-driven UI libraries (React Admin, Refine) that map directly to QQQ's metadata patterns.
- Server Components can fetch and cache metadata server-side, reducing client bundle and improving initial load.
- The largest hiring pool and community support of any framework.
- Incremental adoption is possible — can start with a few routes and migrate gradually.

**Cons for QQQ:**
- App Router complexity: Server Components vs. Client Components boundary requires careful architectural planning.
- Larger bundle baseline compared to Svelte-based alternatives.
- Vercel-centric deployment optimizations may not apply if self-hosting.

**Risks:** App Router is still evolving rapidly; some patterns may shift between minor versions.

#### 4.2.2 Remix / React Router v7

Remix has merged with React Router as of v7, bringing its data-first architecture (loaders, actions) directly into the React Router ecosystem. It prioritizes web standards, progressive enhancement, and form-centric interaction patterns. Shopify rebuilt their admin interface on Remix, achieving ~30% performance improvement.

| Criterion | Score | Notes |
|-----------|-------|-------|
| SSR/SSG capability | Medium | Strong SSR; SSG requires additional tooling; no ISR equivalent |
| TypeScript support | High | First-class TypeScript throughout |
| Routing | High | File-based with nested routes; every route has its own loader/action/error boundary |
| Data fetching | High | Loaders (GET), Actions (mutations) with automatic revalidation; built-in optimistic UI |
| Component ecosystem | Medium | Same React ecosystem but smaller Remix-specific library count |
| Bundle size / performance | High | Minimal client JS by default; progressive enhancement means forms work without JS |
| Community / longevity | Medium | Backed by Shopify; growing but smaller than Next.js community |
| Developer experience | High | Excellent error boundaries per-route, clear data flow, web-standards approach |
| Metadata-driven UI suitability | High | Loaders naturally map to metadata fetching; nested routes map to QQQ app/table hierarchy |

**Pros for QQQ:**
- The loader/action pattern is a natural fit for QQQ's CRUD operations. Each route's loader fetches metadata + data; actions handle create/update/delete.
- Nested routes mirror QQQ's app → table → record hierarchy perfectly.
- Shopify's admin (a complex, metadata-heavy interface) validates Remix at scale.
- Automatic revalidation after mutations eliminates manual cache invalidation.
- Progressive enhancement means forms work even before JavaScript loads.

**Cons for QQQ:**
- Smaller ecosystem than Next.js; fewer pre-built admin components.
- No built-in ISR or static generation for marketing/docs pages.
- The React Router v7 merger is recent; documentation and ecosystem are still consolidating.

**Risks:** Post-merger ecosystem fragmentation; some Remix v2 patterns changed in React Router v7.

#### 4.2.3 SvelteKit

SvelteKit is the official framework for Svelte, a compiler-based UI framework. Svelte 5 introduced "runes" for fine-grained reactivity. SvelteKit provides SSR, SSG, file-based routing, and form actions. It produces significantly smaller bundles than React-based frameworks (20-40% smaller).

| Criterion | Score | Notes |
|-----------|-------|-------|
| SSR/SSG capability | High | Full SSR, SSG, and hybrid rendering; adapter-based deployment |
| TypeScript support | High | First-class TypeScript in Svelte 5 |
| Routing | High | File-based with dynamic parameters, layouts, and route groups |
| Data fetching | High | `load` functions (server and universal), form actions for mutations |
| Component ecosystem | Low | Significantly smaller than React; few enterprise-grade data grid or form libraries |
| Bundle size / performance | High | Smallest bundles; no virtual DOM overhead; excellent Lighthouse scores |
| Community / longevity | Medium | Growing but much smaller than React; no major corporate backer beyond Vercel (acquired Svelte creator) |
| Developer experience | High | Minimal boilerplate, intuitive reactivity, excellent dev tooling |
| Metadata-driven UI suitability | Medium | Dynamic rendering is straightforward but the component ecosystem lacks pre-built schema-driven form/table/grid libraries |

**Pros for QQQ:**
- Best raw performance: smallest bundles, fastest rendering.
- Clean, minimal API surface reduces complexity.
- Svelte's compiler approach means less runtime overhead.

**Cons for QQQ:**
- The critical weakness: no mature equivalent of React Admin, Refine, TanStack Table, AG Grid, or MUI X DataGrid Pro in the Svelte ecosystem. QQQ requires a sophisticated data grid with column reordering, pinning, filtering, server-side pagination, and multi-select. Building this from scratch would be a major effort.
- Smaller hiring pool for Svelte developers.
- Fewer form libraries for dynamic, metadata-driven form generation.

**Risks:** Ecosystem maturity for enterprise admin use cases is the primary concern. The team would need to build or heavily customize core components.

#### 4.2.4 Nuxt (Vue Ecosystem)

Nuxt 3 is the official Vue meta-framework, built on the Nitro server engine. It provides SSR, SSG, ISR, file-based routing, auto-imports, and a rich module ecosystem. It is the standard choice for Vue-based applications.

| Criterion | Score | Notes |
|-----------|-------|-------|
| SSR/SSG capability | High | Full SSR, SSG, ISR via Nitro engine; edge deployment support |
| TypeScript support | High | First-class TypeScript with auto-generated types |
| Routing | High | File-based with dynamic segments, nested layouts, middleware |
| Data fetching | High | `useFetch`, `useAsyncData` composables with caching and deduplication |
| Component ecosystem | Medium | Smaller than React but has Vuetify, PrimeVue, Naive UI, AG Grid (Vue); no Refine equivalent |
| Bundle size / performance | Medium | Moderate bundle size; Vue's reactivity is efficient |
| Community / longevity | Medium | Strong in Asia/Europe; Vue is well-established but React dominates enterprise |
| Developer experience | High | Excellent auto-imports, Nuxt DevTools, clear conventions |
| Metadata-driven UI suitability | Medium | Vue's template syntax works well for dynamic rendering; fewer schema-driven admin frameworks than React |

**Pros for QQQ:**
- Vue's template-driven approach can render dynamic metadata-driven UIs cleanly.
- Vuetify and PrimeVue provide comprehensive component libraries including data tables, forms, and widgets.
- Nuxt modules ecosystem is mature (auth, i18n, image optimization).

**Cons for QQQ:**
- Adopting Vue requires the team to learn a new framework ecosystem (QQQ is currently all React/TypeScript).
- Fewer metadata-driven admin frameworks (no equivalent of React Admin/Refine in Vue).
- Smaller enterprise adoption in North America compared to React.

**Risks:** Framework transition cost for a team with existing React expertise.

### 4.3 Recommendation

**Recommended Framework: Next.js (App Router)**

For the QQQ admin UI modernization, Next.js provides the strongest overall fit:

**Primary justification:** QQQ's core challenge is metadata-driven dynamic UI rendering — generating forms, tables, grids, filters, and widgets from server-provided schemas at runtime. The React ecosystem is unmatched in providing the building blocks for this pattern. Libraries like TanStack Table (or AG Grid) for data grids, React Hook Form (or Formik) for dynamic forms, shadcn/ui for composable UI primitives, and potentially Refine or React Admin for admin CRUD scaffolding provide a foundation that would need to be built from scratch in Svelte or adapted in Vue.

**Secondary justification:** Server Components in the App Router allow metadata to be fetched and processed on the server, reducing the client-side JavaScript bundle and improving initial page load performance. The metadata response (which can be large) can be cached at the server layer with revalidation, rather than shipping it entirely to the client on every page load.

**Risk mitigation:** Next.js has the largest community, the broadest library ecosystem, and the strongest long-term support trajectory. The team's existing React/TypeScript expertise transfers directly.

**Remix (React Router v7) is a strong second choice** — its loader/action pattern is arguably a more natural fit for QQQ's CRUD patterns, and Shopify's admin validates it at scale. However, Next.js's ecosystem breadth and Server Components provide a slight edge for the metadata-heavy rendering QQQ requires.

---

## 5. New Admin UI Requirements

### 5.1 Core Principles

1. **100% feature parity with current qfmd.** Every page, component, interaction, and capability documented in this section must be present in the replacement UI. No feature regression is acceptable.

2. **Responsive design.** The UI must be fully functional at mobile (< 768px), tablet (768px–1024px), and desktop (> 1024px) breakpoints. The current qfmd is primarily desktop-optimized.

3. **Metadata-driven rendering.** The UI structure (navigation, pages, forms, tables, widgets) must be derived entirely from backend metadata fetched via the API. No table names, field lists, process steps, or navigation items may be hardcoded.

4. **Accessible.** WCAG 2.1 AA compliance minimum. All interactive elements must be keyboard-navigable. Form fields must have proper labels and ARIA attributes. Color contrast ratios must meet AA standards. Screen reader compatibility required.

5. **Themeable.** Light and dark mode support. Custom brand colors via `QBrandingMetaData.accentColor`. CSS custom properties (60+ theme tokens observed in current qfmd) for granular customization. Support for `customCss` injection via `data-qqq-id` selectors.

### 5.2 Page Inventory

Based on analysis of `App.tsx` route generation and page components:

#### 5.2.1 Authentication Pages

| Route | Purpose | Key UI Elements | Data Sources | User Interactions |
|-------|---------|-----------------|--------------|-------------------|
| `/login` (implicit) | OAuth2/Auth0 login flow | Auth provider redirect, loading state | `GET /metaData/authentication`, `POST /manageSession` | Click login, redirect to IdP, return with token |
| `/no-auth-screen` | Displayed when auth fails | Error message, retry button | None | Retry authentication |

#### 5.2.2 App Home Pages

| Route | Purpose | Key UI Elements | Data Sources | User Interactions |
|-------|---------|-----------------|--------------|-------------------|
| `/app/{appName}` | App dashboard/home | App label, dashboard widgets, app sections (tables with record counts, process links, report links), child app navigation | `GET /metaData`, `GET /metaData/table/{t}`, `POST /table/{t}/count`, `GET /widget/{w}` | Navigate to tables/processes/reports, view record counts, interact with widgets |

#### 5.2.3 Record Pages

| Route | Purpose | Key UI Elements | Data Sources | User Interactions |
|-------|---------|-----------------|--------------|-------------------|
| `/app/{table}` | Record query/list | DataGrid Pro with columns, filters (basic + advanced), sorting, pagination, row selection, toolbar (search, export, columns, density, saved views), process launcher, bulk edit | `POST /table/{t}/query`, `POST /table/{t}/count`, `GET /metaData/table/{t}`, `GET /table/{t}/variants` | Filter, sort, paginate, select rows, export (CSV/PDF/Excel), launch process, create record, bulk edit, manage saved views |
| `/app/{table}/savedView/:id` | Saved view (pre-filtered query) | Same as query page with pre-loaded filter/column config | Same as query + saved view config | Same as query page |
| `/app/{table}/create` | Create new record | Multi-section form with dynamic fields, validation, file upload, possible-values autocomplete | `GET /metaData/table/{t}`, `POST /possibleValues/{f}` | Fill fields, validate, save |
| `/app/{table}/:id` | View single record | Record header, section-organized fields, audit trail, widgets (charts, child grids, custom), action menu (edit, delete, process, share), help content, related records sidebar | `GET /data/{t}/{id}`, `GET /metaData/table/{t}`, `GET /widget/{w}`, audit endpoints | View record, edit (modal), delete (confirm), launch process, share, navigate to related records |
| `/app/{table}/:id/edit` | Edit existing record | Same form as create, pre-populated with record values | `GET /data/{t}/{id}`, `GET /metaData/table/{t}`, `POST /possibleValues/{f}` | Modify fields, validate, save |
| `/app/{table}/:id/copy` | Copy record as new | Same form as create, pre-populated (without ID) | Same as edit | Modify fields, save as new record |
| `/app/{table}/key` | View record by unique key | Same as view, resolved by unique key lookup | Same as view | Same as view |
| `/app/{table}/dev` | Table developer view | Developer-mode table tools | `GET /metaData/table/{t}` | Developer inspection |
| `/app/{table}/:id/dev` | Record developer view | Script editor, script logs, test execution | `GET /data/{t}/{id}/developer`, script endpoints | Edit scripts, view logs, run tests |

#### 5.2.4 Process Pages

| Route | Purpose | Key UI Elements | Data Sources | User Interactions |
|-------|---------|-----------------|--------------|-------------------|
| `/app/{processName}` | Standalone process execution | Step wizard (stepper), dynamic forms per step, validation review, file mapping (bulk load), profile management, results summary, progress indicator | `GET /metaData/process/{p}`, `POST /processes/{p}/init`, `POST /processes/{p}/{uuid}/step/{s}`, `GET /processes/{p}/{uuid}/status/{j}`, `GET /processes/{p}/{uuid}/records` | Navigate steps (next/back), fill forms, upload files, review validation, execute, view results |
| `/app/{table}/{processName}` | Table-scoped process (launched from query or record view) | Same as standalone, with pre-selected records from the table context | Same as standalone + record selection context | Same as standalone |

#### 5.2.5 Report Pages

| Route | Purpose | Key UI Elements | Data Sources | User Interactions |
|-------|---------|-----------------|--------------|-------------------|
| `/app/{reportName}` | Report execution (specialized process) | Report configuration form, output display | Process endpoints (reports are backed by processes) | Configure parameters, execute, view/download results |

### 5.3 Component Inventory

#### 5.3.1 Layout Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Side Navigation** | SideNav, SideNavCollapse, SideNavItem, SideNavList, SideNavRoot | Hierarchical navigation from appTree metadata; collapsible groups; user profile section; logout; mini-mode (icons only) | Responsive: collapsible on mobile (off-canvas), mini-mode on tablet, full on desktop; keyboard navigation; search/filter within nav |
| **Top Navigation** | NavBar, Breadcrumbs | Breadcrumb trail from path-to-label map; recently-viewed autocomplete; sidebar toggle; user menu; go-to-record search | Sticky header; responsive breadcrumb truncation on mobile; command palette (Cmd+K) for quick navigation |
| **Header Banner** | BrandedHeaderBar, Banners | Custom branding banner with logo/tagline; environment banners (dev/staging/prod) with configurable severity, colors, text | Support HTML content in banners; dismissible banners; multiple concurrent banners |
| **Footer** | Footer | Page footer | Minimal; optional |

#### 5.3.2 Data Display Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Data Grid** | MUI X DataGrid Pro integration | Server-side pagination, sorting, filtering; column reordering, resizing, pinning, visibility; row selection (single/multi); density control; custom cell renderers per field type and adornment; export to CSV/PDF/Excel | Virtual scrolling for large datasets; keyboard navigation within grid; column grouping; row grouping/tree data; inline editing |
| **Record Detail View** | RecordView, FieldValueAsWidget | Section-organized field display; field values with type-appropriate formatting; field adornments (links, chips, file downloads, code editors, tooltips); associated records; audit trail | Responsive: single-column on mobile; collapsible sections; copy-to-clipboard for field values |
| **Statistics Cards** | MiniStatisticsCard, StatisticsCard, MultiStatisticsCard | Small number cards with icon, value, percentage, and color coding | Animated count-up; sparkline mini-charts; click-through to filtered query |
| **Charts** | DefaultLineChart, BarChart, HorizontalBarChart, StackedBarChart, PieChart, ChartSubheaderWithData | Line, bar, horizontal bar, stacked bar, and pie/doughnut charts from widget data | Interactive tooltips; zoom/pan; responsive sizing; export chart as image |
| **Data Bags** | DataBagViewer, DataBagPreview | JSON/structured data display with syntax highlighting and collapsible tree | Search within JSON; copy paths; formatted display |

#### 5.3.3 Form Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Entity Form** | EntityForm, DynamicForm, DynamicFormField | Multi-section form generated from table metadata; Formik + Yup validation; supports all QFieldTypes (STRING, INTEGER, DECIMAL, BOOLEAN, DATE, TIME, DATE_TIME, TEXT, HTML, PASSWORD, BLOB); conditional field visibility; help content per field | React Hook Form (or equivalent) for better performance; inline validation as-you-type; undo/redo; autosave drafts |
| **Autocomplete/Select** | DynamicSelect, FieldAutoComplete, QHierarchyAutoComplete | Possible-values dropdown with server-side search (`/possibleValues`); supports table context, process context, and standalone; hierarchical selection | Debounced search; virtual scrolling for large option lists; multi-select support; recent selections |
| **Boolean Fields** | BooleanFieldSwitch | Toggle switch for boolean values | Clear null/false/true tri-state where applicable |
| **Chip Input** | ChipTextField | Multi-value text input with chips | Tag suggestions; paste-to-create multiple |
| **File Upload** | FileInputField | Single and multi-file upload with preview | Drag-and-drop zone; progress indicator; file type validation; image preview thumbnails |
| **Date/Time Fields** | CriteriaDateField | Date picker, time picker, datetime picker; date range selection for filters | Calendar view; relative date shortcuts ("today", "last 7 days"); timezone awareness |
| **Code Editor** | ScriptViewer (via adornments) | Syntax-highlighted code editing for associated scripts | Language detection; line numbers; basic autocomplete |

#### 5.3.4 Process Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Step Wizard** | ProcessRun (stepper) | Linear and potentially branching step flow; step indicator showing progress; forward/back navigation; each step renders its own form/view/validation | Non-linear step navigation (where allowed by stepFlow); estimated time remaining |
| **Validation Review** | ValidationReview | Pre-commit review screen showing warnings/errors from backend validation; accept/reject/modify | Inline fix suggestions; bulk dismiss warnings |
| **Bulk Load** | BulkLoadProfileForm, BulkLoadFileMappingForm, BulkLoadFileMappingField, BulkLoadValueMappingForm, SavedBulkLoadProfiles | CSV column-to-field mapping; value mapping (source values to DB values); profile save/load; file upload and preview | Auto-detect mappings from header names; preview first N rows; mapping templates |
| **Process Results** | ProcessSummaryResults | Summary display after process completion; record counts; error lists; download links | Export results; link to affected records |
| **Progress Display** | QJobRunning state handling | Progress bar with message, current/total counts during async execution | Estimated time remaining; cancel button; background execution with notification |
| **Google Drive** | GoogleDriveFolderPickerWrapper | Google Drive folder picker for integrations | N/A (integration-specific) |

#### 5.3.5 Query/Filter Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Filter Builder** | FilterCriteriaRow, FilterCriteriaRowValues, CustomFilterPanel, BasicAndAdvancedQueryControls | Basic mode (quick search) and advanced mode (full filter builder); per-field criteria with operator selection; AND/OR boolean logic; nested sub-filters; expression types (Now, NowWithOffset, ThisOrLastPeriod, FilterVariable) | Visual filter builder with drag-and-drop; saved filter templates; filter sharing via URL |
| **Quick Filter** | QuickFilter | Text search across visible columns | Highlight matches in results; recent searches |
| **Column Configuration** | CustomColumnsPanel, FieldListMenu | Show/hide columns; reorder columns; persist column state per table | Column presets; column grouping |
| **Pagination** | CustomPaginationComponent | Page size selector (10/25/50/100); page navigation; total count display | Jump to page; infinite scroll option |
| **Saved Views** | SavedViews | Save and restore filter + column + sort configurations | Share views with team; default view per table |
| **Export** | ExportMenuItem | Export to CSV, PDF, Excel | Background export for large datasets; export with current filters applied |
| **Table Variants** | TableVariantDialog | Select table variant (alternate views of same table) | Variant indicator in header |

#### 5.3.6 Widget Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Widget Container** | Widget, WidgetBlock, CompositeWidget, ParentWidget, DashboardWidgets | Wrapper with label, dropdown menu, reload button, export button; dropdown selections with possible-value sources; help content | Drag-and-drop widget reordering on dashboards; widget resize |
| **Block Types** | TextBlock, BigNumberBlock, UpOrDownNumberBlock, NumberIconBadgeBlock, ProgressBarBlock, ButtonBlock, IconBlock, ImageBlock, AudioBlock, DividerBlock, InputFieldBlock, TableSubRowDetailRowBlock | Composable block elements within widgets: formatted text, large numbers, delta indicators, progress bars, buttons, icons, images, audio players, dividers, form inputs | Animation on data change; click-through actions on blocks |
| **Record Grid Widget** | RecordGridWidget | Embedded data grid for related/child records with add/edit/delete capabilities | Inline editing; drag-and-drop row reordering |
| **Specialized Widgets** | DynamicFormWidget, PivotTableSetupWidget, FilterAndColumnsSetupWidget, StepperCard, CronUIWidget, USMapWidget, QuickSightChart, ScriptViewer, CustomComponentWidget | Embedded forms, pivot table config, CRON expression builder, geographic visualization, AWS QuickSight embedding, script editing, custom React component mounting | Plugin architecture for custom widget types |

#### 5.3.7 Feedback Components

| Component Group | Current Components | Required Behavior | Enhancements |
|---|---|---|---|
| **Alerts** | MUI Alert, ErrorBoundary | Inline success/error/warning/info alerts; React error boundaries | Toast notifications for async operations; auto-dismiss with configurable duration |
| **Modals/Dialogs** | Modal, Dialog, GotoRecordDialog, ShareModal, SelectionSubsetDialog, TableVariantDialog | Modal stack management (nested modals); confirmation dialogs for destructive actions; go-to-record quick nav; record sharing | Keyboard shortcuts to close (Escape); focus trapping; slide-over panels as alternative to modals |
| **Tooltips/Help** | CustomWidthTooltip, HelpContent | Contextual help tooltips on fields and sections; rich content (HTML) in help; role-based help visibility | Guided tours for first-time users; help panel sidebar |
| **Command Menu** | CommandMenu | Keyboard-driven quick navigation (Cmd+K style) | Search across tables, records, processes; recent items; keyboard shortcuts reference |

### 5.4 Responsive Design Requirements

#### 5.4.1 Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| **Mobile** | < 768px | Single-column layout; navigation as off-canvas drawer (hamburger menu); touch-friendly controls (44px minimum tap targets); bottom navigation bar for primary actions |
| **Tablet** | 768px–1024px | Adaptive layout; sidebar in mini-mode (icons only) or collapsible; two-column forms where space allows; data grid with horizontal scroll |
| **Desktop** | > 1024px | Full layout with persistent sidebar; multi-panel views (list + detail); full data grid with all features |

#### 5.4.2 Page-Specific Responsive Treatment

**Record Query (Data Grid):**
- Mobile: Card-based list view as alternative to data grid; swipe actions (edit/delete); simplified filter as bottom sheet; column selector to show only 2-3 essential columns
- Tablet: Horizontal-scrolling data grid with fewer visible columns; sticky first column; pagination at bottom
- Desktop: Full DataGrid Pro experience with all columns, filters, and toolbar

**Record View:**
- Mobile: Single-column stacked sections; collapsible sections (only first section expanded by default); action menu as bottom sheet; widgets as full-width cards
- Tablet: Two-column layout for narrow sections; sidebar hidden by default (swipe to reveal)
- Desktop: Full multi-column layout with persistent sidebar for related records

**Entity Form (Create/Edit):**
- Mobile: Single-column form; sticky save/cancel buttons at bottom; step-through sections (one section at a time)
- Tablet: Two-column form where metadata specifies `gridColumns`
- Desktop: Multi-column form matching `gridColumns` metadata; inline validation

**Process Execution:**
- Mobile: Full-screen steps; stepper as horizontal scrollable; bottom-anchored navigation buttons
- Tablet/Desktop: Standard stepper with form content

**App Home (Dashboard):**
- Mobile: Widgets stacked vertically; statistics cards as horizontal scroll
- Tablet: 2-column widget grid
- Desktop: Multi-column widget grid matching `gridColumns` metadata

### 5.5 Authentication and Authorization

#### 5.5.1 Authentication Flows

The new UI must support:
- **OAuth2/OIDC authentication:** Redirect to Identity Provider, receive access token, exchange for session via `POST /manageSession`
- **Auth0 authentication:** Same flow with Auth0-specific configuration from `getAuthenticationMetaData()`
- **Anonymous/Mock authentication:** For development and fully-anonymous instances
- **Session management:** `sessionUUID` cookie-based; automatic 401 handling with redirect to login
- **Back-channel logout:** Server-side session invalidation via OIDC IdP (transparent to frontend; session becomes invalid on next request)
- **Explicit logout:** `POST /logout` clears session and cookie

#### 5.5.2 Authorization (Role-Based UI)

- Table-level permissions (`readPermission`, `insertPermission`, `editPermission`, `deletePermission`) must control visibility and enablement of CRUD actions
- Process-level permissions (`hasPermission`) must control visibility of process launch buttons
- Capability-based feature toggling (`capabilities` set: `TABLE_QUERY`, `TABLE_GET`, `TABLE_COUNT`, `TABLE_INSERT`, `TABLE_UPDATE`, `TABLE_DELETE`) must hide unavailable operations
- Widget-level permissions (`hasPermission`) must control widget visibility
- Help content role filtering (`QHelpContent.roles`) must show/hide help based on user role

#### 5.5.3 Session Timeout

- Detect 401 responses globally (axios interceptor or equivalent)
- Display non-disruptive re-authentication prompt (modal, not full-page redirect)
- Preserve user's current state (unsaved form data, scroll position, filter state) across re-auth
- Configurable session timeout warning (e.g., 5 minutes before expiry)

### 5.6 Performance Requirements

#### 5.6.1 Load Time Targets

| Metric | Target | Notes |
|--------|--------|-------|
| First Contentful Paint | < 1.5s | On 4G connection (simulated throttled) |
| Time to Interactive | < 3.0s | Page is fully interactive (forms respond, grid renders) |
| Largest Contentful Paint | < 2.5s | Primary content visible |
| Cumulative Layout Shift | < 0.1 | Minimal layout jank during load |
| First Input Delay | < 100ms | Immediate response to user interaction |

#### 5.6.2 Caching Strategy

| Endpoint | Cache Strategy | TTL |
|----------|----------------|-----|
| `GET /metaData` | Memoize in memory (per session) | Until page reload or explicit invalidation |
| `GET /metaData/table/{t}` | Memoize per table (per session) | Until page reload |
| `GET /metaData/process/{p}` | Memoize per process (per session) | Until page reload |
| `GET /metaData/authentication` | localStorage with TTL | 1 hour (as current implementation) |
| `POST /table/{t}/query` | No cache (always fresh) | N/A |
| `POST /table/{t}/count` | Short-lived cache | 30 seconds (debounce rapid filter changes) |
| `GET /widget/{w}` | Request deduplication | Cancel-and-replace (abort previous in-flight request for same widget) |
| `POST /possibleValues/{f}` | Debounced request | 300ms debounce on search term changes |

#### 5.6.3 Optimization Strategies

- **Route-based code splitting:** Each page/route loads only its required JavaScript
- **Lazy loading:** Widgets, charts, and heavy components loaded on demand
- **Optimistic UI updates:** For create/update/delete, update the UI immediately and reconcile with server response
- **Virtual scrolling:** For data grids with > 100 rows and autocomplete dropdowns with > 50 options
- **Server-side metadata processing:** If using Next.js Server Components, fetch and process metadata server-side to reduce client bundle

### 5.7 Developer Experience Requirements

#### 5.7.1 Component Documentation

- **Storybook** (or equivalent) for all shared components
- Each component must have stories demonstrating all states (loading, empty, error, populated, disabled)
- Interactive controls for prop exploration
- Accessibility audit integration in stories

#### 5.7.2 Testing

- **E2E testing:** Playwright (recommended) for critical user flows (login, CRUD, process execution, filter/sort/paginate)
- **Component testing:** Vitest + Testing Library for unit/integration tests on components
- **Visual regression:** Screenshot comparison for layout-sensitive components
- **Accessibility testing:** axe-core integration in CI for automated WCAG checks
- **API contract testing:** Validate frontend type definitions against backend OpenAPI spec (once formalized)

#### 5.7.3 Build and CI/CD

- Integration with the existing QQQ Gradle/Maven build pipeline
- Hot Module Replacement (HMR) for development (Vite-based or Turbopack)
- Production build with minification, tree-shaking, and source maps
- Bundle size monitoring (fail CI if bundle exceeds threshold)
- Lint (ESLint) and format (Prettier) enforcement in CI

#### 5.7.4 Type Safety

- **Generated API client:** TypeScript types generated from the Semantic API Contract (Section 3), either via OpenAPI codegen (once a formal spec is published) or a shared type package derived from `qqq-frontend-core` models
- **Strict TypeScript:** `strict: true` in tsconfig; no `any` types in component props
- **Runtime validation:** Zod or similar for API response validation at the boundary

### 5.8 Migration Strategy

#### 5.8.1 Phased Approach

**Phase 0 — Foundation (Weeks 1–4):**
- Set up Next.js project with TypeScript, Tailwind CSS (or chosen design system), and Storybook
- Port `qqq-frontend-core` types and API client (or generate from spec)
- Implement authentication flow (OAuth2/OIDC, session management)
- Build layout shell (sidebar, top nav, breadcrumbs) driven by metadata
- Deploy alongside qfmd under a separate path (e.g., `/v2/`)

**Phase 1 — Vertical Slice: Record Query (Weeks 5–10):**
- Implement the Record Query page (data grid with filtering, sorting, pagination, export)
- This is the most complex and most-used page; proving it validates the architecture
- Implement table metadata fetching and dynamic column generation
- Build the filter builder (basic and advanced modes)
- Implement saved views
- **Milestone: One table fully functional in the new UI**

**Phase 2 — Record CRUD (Weeks 11–16):**
- Implement Record View (detail page with sections, widgets, audit trail)
- Implement Create/Edit forms (dynamic form generation from field metadata)
- Implement Delete with confirmation
- Build all form field types (text, number, boolean, date, select, file, etc.)

**Phase 3 — Processes (Weeks 17–22):**
- Implement Process Execution (step wizard, form steps, validation review)
- Implement bulk load workflows (file mapping, value mapping, profiles)
- Implement async job polling and progress display
- Build process results display

**Phase 4 — Dashboard and Widgets (Weeks 23–26):**
- Implement App Home with widget rendering
- Build all widget types (charts, grids, statistics, custom)
- Implement widget block system

**Phase 5 — Polish and Parity (Weeks 27–32):**
- Developer tools (script editor, logs)
- Command palette, keyboard shortcuts
- Responsive design refinement across all breakpoints
- Accessibility audit and remediation
- Performance optimization
- E2E test suite for all critical flows

#### 5.8.2 Coexistence Strategy

During migration, both UIs can run simultaneously:
- The Javalin server already supports multiple route providers via `QApplicationJavalinServer`
- The new UI can be served as a separate SPA route provider (e.g., under `/v2/` or `/next/`)
- Both UIs share the same backend API and session management
- A feature flag or user preference can control which UI is shown by default
- Users can switch between UIs during the transition period

#### 5.8.3 First Milestone Deliverable

The recommended first milestone is a **fully functional Record Query page for a single table**. This validates:
- Metadata-driven column generation
- API integration (query, count, metadata)
- Data grid performance with server-side pagination
- Filter builder with all operator types
- Authentication and session management
- Responsive layout at all breakpoints
- The chosen framework's suitability for QQQ's patterns

This is the highest-value, highest-risk page. Proving it works de-risks the rest of the migration.

---

## Appendix A: File Manifest

### Backend — qqq-middleware-javalin

| File | Lines (approx.) | Summary |
|------|-----------------|---------|
| `specs/AbstractEndpointSpec.java` | 599 | Base class for all endpoint specs; handles HTTP lifecycle, parameter extraction, security checks, exception handling |
| `specs/AbstractMiddlewareVersion.java` | 384 | Aggregates endpoint specs into a versioned API; generates OpenAPI documentation; security scheme configuration |
| `QApplicationJavalinServer.java` | 400+ | Server bootstrap: route registration, SPA serving, middleware setup, hot-swap support |
| `specs/v1/MiddlewareVersionV1.java` | 77 | V1 version registration; registers 12 endpoint specs |
| `specs/v1/AuthenticationMetaDataSpecV1.java` | 126 | GET /metaData/authentication — unsecured auth discovery |
| `specs/v1/ManageSessionSpecV1.java` | 203 | POST /manageSession — session creation from OAuth token |
| `specs/v1/LogoutSpecV1.java` | 141 | POST /logout — session invalidation |
| `specs/v1/BackChannelLogoutSpecV1.java` | 139 | POST /oidc/backchannel-logout — OIDC IdP-initiated logout |
| `specs/v1/MetaDataSpecV1.java` | 205 | GET /metaData — full application metadata |
| `specs/v1/TableMetaDataSpecV1.java` | 171 | GET /metaData/table/{t} — detailed table metadata |
| `specs/v1/ProcessMetaDataSpecV1.java` | 141 | GET /metaData/process/{p} — process metadata |
| `specs/v1/TableQuerySpecV1.java` | 182 | POST /table/{t}/query — record query with filter |
| `specs/v1/TableCountSpecV1.java` | 164 | POST /table/{t}/count — record count |
| `specs/v1/ProcessInitSpecV1.java` | 269 | POST /processes/{p}/init — process initialization |
| `specs/v1/ProcessStepSpecV1.java` | 202 | POST /processes/{p}/{uuid}/step/{s} — process step advancement |
| `specs/v1/ProcessStatusSpecV1.java` | 165 | GET /processes/{p}/{uuid}/status/{j} — async job polling |
| `executors/AuthenticationMetaDataExecutor.java` | ~30 | Pass-through to backend auth metadata action |
| `executors/ManageSessionExecutor.java` | ~60 | Dispatches to auth module for session creation |
| `executors/LogoutExecutor.java` | ~50 | Iterates auth providers for logout |
| `executors/BackChannelLogoutExecutor.java` | ~80 | Parses JWT, finds and deletes matching sessions |
| `executors/MetaDataExecutor.java` | ~40 | Calls backend MetaDataAction, returns decorated response |
| `executors/TableMetaDataExecutor.java` | ~50 | Validates table, checks permissions, calls TableMetaDataAction |
| `executors/TableQueryExecutor.java` | ~60 | Checks READ permission, executes query with timeout |
| `executors/TableCountExecutor.java` | ~50 | Checks READ permission, executes count |
| `executors/ProcessMetaDataExecutor.java` | ~40 | Calls ProcessMetaDataAction |
| `executors/ProcessInitOrStepExecutor.java` | ~100 | Handles both init and step; manages async execution |
| `executors/ProcessStatusExecutor.java` | ~40 | Polls AsyncJobManager for job status |

### Frontend — qqq-frontend-core

| File | Lines (approx.) | Summary |
|------|-----------------|---------|
| `controllers/QController.ts` | 1169 | Primary API client; all HTTP calls to legacy endpoints; memoization, auth gating, request cancellation |
| `controllers/QControllerV1.ts` | 1117 | V1 API client; versioned endpoints; JSON bodies for query/count |
| `model/QRecord.ts` | ~50 | Single record: values, displayValues, associatedRecords, errors, warnings |
| `model/QPossibleValue.ts` | ~10 | Dropdown option: id + label |
| `model/QInstance.ts` | ~80 | Top-level metadata: tables, processes, apps, appTree, branding, widgets |
| `model/metaData/QTableMetaData.ts` | ~100 | Table definition: fields, sections, joins, permissions, capabilities |
| `model/metaData/QFieldMetaData.ts` | ~60 | Field definition: type, constraints, adornments, display hints |
| `model/metaData/QProcessMetaData.ts` | ~40 | Process definition: steps, flow, input record constraints |
| `model/metaData/QFrontendStepMetaData.ts` | ~30 | Process step: components, formFields, viewFields |
| `model/metaData/QAppMetaData.ts` | ~40 | App definition: sections, children, widgets |
| `model/metaData/QWidgetMetaData.ts` | ~50 | Widget definition: type, dropdowns, icons, permissions |
| `model/metaData/QAuthenticationMetaData.ts` | ~15 | Auth config: name, type, data |
| `model/metaData/QBrandingMetaData.ts` | ~30 | Branding: company, logo, colors, banners |
| `model/query/QQueryFilter.ts` | ~50 | Filter tree: criteria, orderBys, subFilters, booleanOperator, skip, limit |
| `model/query/QFilterCriteria.ts` | ~15 | Single criterion: fieldName, operator, values |
| `model/query/QCriteriaOperator.ts` | ~25 | Enum of 20 filter operators |
| `model/query/QFilterOrderBy.ts` | ~10 | Sort spec: fieldName, isAscending |
| `model/query/QueryJoin.ts` | ~15 | Join spec: table, type, alias |
| `model/query/FilterVariableExpression.ts` | ~15 | Dynamic filter variable placeholder |
| `model/query/NowExpression.ts` | ~10 | Current datetime expression |
| `model/query/NowWithOffsetExpression.ts` | ~20 | Relative datetime expression |
| `model/query/ThisOrLastPeriodExpression.ts` | ~20 | Period-based expression |
| `model/processes/QJobStarted.ts` | ~10 | Async job initiated: processUUID, jobUUID |
| `model/processes/QJobRunning.ts` | ~15 | Job in progress: message, current, total |
| `model/processes/QJobComplete.ts` | ~20 | Job done: values, nextStep, backStep, metaDataAdjustment |
| `model/processes/QJobError.ts` | ~15 | Job failed: error, userFacingError |
| `model/processes/ProcessMetaDataAdjustment.ts` | ~15 | Dynamic step list and field updates |
| (+ 15 additional model files) | ~200 total | Supporting types: QFieldType, QComponentType, AdornmentType, Capability, QAppNodeType, QTableSection, QAppSection, QAppTreeNode, QExposedJoin, QJoinMetaData, QReportMetaData, QHelpContent, QIcon, QTableVariant, Banner, FieldAdornment |

### Frontend — qqq-frontend-material-dashboard

| File/Directory | Files | Summary |
|------|-------|---------|
| `CLAUDE.md` | 1 | Project conventions: architecture notes, component patterns, testing strategy |
| `src/App.tsx` | 1 | Application entry: dynamic route generation from metadata, auth providers, theme, layout shell |
| `src/qqq/pages/apps/` | ~3 | App home page (dashboard with widgets, sections, record counts) |
| `src/qqq/pages/records/` | ~8 | Record CRUD pages: query (DataGrid Pro), view, create, edit, developer views |
| `src/qqq/pages/processes/` | ~5 | Process execution, report execution |
| `src/qqq/components/audits/` | ~3 | Audit trail display |
| `src/qqq/components/buttons/` | ~12 | Standardized button set (create, save, delete, edit, cancel, submit, menu) |
| `src/qqq/components/databags/` | ~3 | JSON/data structure viewers |
| `src/qqq/components/forms/` | ~8 | Dynamic form, entity form, form fields, boolean switch, chip input |
| `src/qqq/components/horseshoe/` | ~15 | Layout: sidenav, navbar, breadcrumbs, footer, branded header |
| `src/qqq/components/legacy/` | ~5 | Legacy/deprecated components |
| `src/qqq/components/misc/` | ~15 | HelpContent, FieldAutoComplete, SavedViews, TabPanel, Banners, CommandMenu, ErrorBoundary, etc. |
| `src/qqq/components/processes/` | ~12 | Process forms, validation review, bulk load (file mapping, value mapping, profiles), Google Drive picker |
| `src/qqq/components/query/` | ~15 | Filter builder, quick filter, column panel, pagination, export, table variant dialog, go-to-record |
| `src/qqq/components/scripts/` | ~3 | Script viewer/editor |
| `src/qqq/components/sharing/` | ~2 | Share modal |
| `src/qqq/components/tooltips/` | ~2 | Custom-width tooltips |
| `src/qqq/components/widgets/` | ~60+ | Widget container, dashboard layout, all chart types, record grid widget, block types (text, number, progress, button, icon, image, audio, divider, input), specialized widgets (pivot table, CRON, US map, QuickSight, custom component) |
| **Total component files** | **217** | All .ts/.tsx files in components directory |

### Wiki Documentation

| File | Summary |
|------|---------|
| `qqq.wiki/High-Level-Architecture.md` | Architecture overview: metadata-first design, action-based business logic, QContext management, pluggable backends, request flow diagram, extension points |
| `qqq.wiki/Public-API-Overview.md` | Public API surface: action framework, context management, metadata system, backend module interfaces, middleware APIs, frontend widget interface, configuration, error handling, logging |
| `qqq.wiki/Semantic-Versioning-Policy.md` | Versioning policy: PATCH/MINOR/MAJOR bump criteria, public API surfaces subject to SemVer, backward compatibility rules, two-version deprecation cycle |
