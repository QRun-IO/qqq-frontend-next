# Semantic API Contract v1.0

## 3.1 Overview

This section formalizes the implicit QQQ REST API into an explicit, versioned contract. Any frontend implementation (not just qfmd) can be built against this specification.

**Version:** `v1.0`
**Base Path:** `/qqq/v1/`
**Content-Type:** `application/json` (responses), `multipart/form-data` (process/CRUD requests with file uploads)
**Authentication:** Cookie-based session (`sessionUUID` cookie) for all secured endpoints

## 3.2 Authentication Endpoints

### 3.2.1 Get Authentication Metadata

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

### 3.2.2 Create/Manage Session

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

### 3.2.3 Logout

```
POST /qqq/v1/logout
Authentication: Required (sessionUUID cookie)
```

**Response 200:** Empty body. Removes `sessionUUID` cookie.

### 3.2.4 OIDC Back-Channel Logout

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

## 3.3 Metadata Endpoints

### 3.3.1 Application Metadata

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

### 3.3.2 Table Metadata

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

### 3.3.3 Process Metadata

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

## 3.4 Table Data Endpoints

### 3.4.1 Query Records

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

### 3.4.2 Count Records

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

### 3.4.3 Get Single Record (Not Yet in v1 Specs)

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

### 3.4.4 Insert Record (Not Yet in v1 Specs)

```
POST /qqq/v1/table/{tableName}
Authentication: Required + INSERT permission
Content-Type: multipart/form-data
```

**Request Body:** Form fields matching table field names.

**Response 200:** `QRecord` (inserted record with generated ID)

### 3.4.5 Update Record (Not Yet in v1 Specs)

```
PUT /qqq/v1/table/{tableName}/{primaryKey}
Authentication: Required + EDIT permission
Content-Type: multipart/form-data
```

**Request Body:** Form fields with updated values.

**Response 200:** `QRecord` (updated record)

### 3.4.6 Delete Record (Not Yet in v1 Specs)

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

## 3.5 Process Endpoints

### 3.5.1 Initialize Process

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

### 3.5.2 Process Step

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

### 3.5.3 Process Status (Poll)

```
GET /qqq/v1/processes/{processName}/{processUUID}/status/{jobUUID}
Authentication: Required
```

**Response 200:** `QJobRunning | QJobComplete | QJobError`

### 3.5.4 Process Records (Not Yet in v1 Specs)

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

### 3.5.5 Cancel Process (Not Yet in v1 Specs)

```
GET /qqq/v1/processes/{processName}/{processUUID}/cancel
Authentication: Required
```

**Response 200:** `boolean`

## 3.6 Widget Endpoints (Not Yet in v1 Specs)

```
GET /qqq/v1/widget/{widgetName}
Authentication: Required
```

**Query Parameters:** Dynamic, widget-specific key-value pairs.

**Response 200:** Widget-specific JSON payload. Shape varies by widget type (chart data, record grids, statistics, HTML content, etc.).

## 3.7 Possible Values Endpoints (Not Yet in v1 Specs)

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

## 3.8 Error Response Shape

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

## 3.9 Pagination Contract

Based on analysis of `QQueryFilter` and `TableQuerySpecV1`:

The pagination model is **offset/limit** based:
- `filter.skip` (number): Number of records to skip (offset). Default: 0.
- `filter.limit` (number): Maximum number of records to return. No enforced maximum from the API; the frontend typically defaults to 10, 25, 50, or 100.

There is no cursor-based pagination. The frontend manages page state by computing `skip = (pageNumber - 1) * pageSize` and sending it with each query. Total count is obtained via a separate `/count` call.

## 3.10 Filtering Contract

Based on analysis of `QQueryFilter`, `QFilterCriteria`, and `QCriteriaOperator`:

Filters are tree-structured with boolean operators:
- Top-level `QQueryFilter` contains `criteria[]`, `orderBys[]`, and optional `subFilters[]`
- `booleanOperator` (`AND` | `OR`) controls how criteria are combined
- `subFilters` allow nested boolean logic (e.g., `(A AND B) OR (C AND D)`)
- Each `QFilterCriteria` specifies `fieldName`, `operator`, and `values[]`
- Special expression types are supported in values: `FilterVariableExpression`, `NowExpression`, `NowWithOffsetExpression`, `ThisOrLastPeriodExpression`

## 3.11 Backwards Compatibility Policy

Per the QQQ Semantic Versioning Policy (from wiki):

- **Public API surfaces** subject to SemVer include REST endpoints, request/response shapes, query parameter names, and HTTP status codes.
- **PATCH versions** may include bug fixes, security patches, and performance optimizations without changing the API contract.
- **MINOR versions** may add new optional fields to responses, new optional query parameters, new endpoints, and new enum values — all backward-compatible additions.
- **MAJOR versions** may include breaking changes: removing endpoints, changing required parameters, altering response shapes, or removing enum values.
- **Deprecation policy**: Two-version deprecation cycle. Deprecated features are annotated and kept available for at least one major version before removal.
- **Recommendation**: The v1 API contract defined in this document should be frozen once formalized. New capabilities should be added as backward-compatible extensions (new optional fields, new endpoints). Breaking changes require a v2 contract.
