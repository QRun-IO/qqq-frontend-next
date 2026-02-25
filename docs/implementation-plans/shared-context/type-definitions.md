# QQQ TypeScript Type Definitions

> These types are ported from `qqq-frontend-core/src/model/`. Every implementation agent must use these types exactly as defined.

## Core Data Types

### QRecord
Single database record with values, display representations, and metadata.
```typescript
export interface QRecord {
  tableName: string; // Name of the source table
  recordLabel: string; // Display-friendly record identifier
  values: Record<string, any>; // Raw field values keyed by field name
  displayValues: Record<string, string>; // Formatted/display string representations
  associatedRecords?: Record<string, QRecord[]>; // Related records from joins
  errors?: string[]; // Validation errors encountered
  warnings?: string[]; // Non-fatal warnings
}
```

### QPossibleValue
Represents a selectable option from a dropdown or autocomplete field.
```typescript
export interface QPossibleValue {
  id: number | string; // Unique identifier for the value
  label: string; // Display label shown to user
}
```

---

## Metadata Types

### QInstance
Top-level metadata container describing the entire application instance.
```typescript
export interface QInstance {
  apps: Record<string, QAppMetaData>; // All defined apps keyed by name
  appTree: QAppTreeNode[]; // Hierarchical navigation tree
  tables: Record<string, QTableMetaData>; // All tables keyed by name
  processes: Record<string, QProcessMetaData>; // All processes keyed by name
  reports: Record<string, any>; // All reports keyed by name
  widgets: Record<string, QWidgetMetaData>; // All widgets keyed by name
  branding: QBrandingMetaData; // Application branding and theme
  helpContents: Record<string, QHelpContent>; // Context-specific help
  environmentValues: Record<string, string>; // Environment configuration
}
```

### QTableMetaData
Complete definition of a table, including fields, sections, permissions, and UI hints.
```typescript
export interface QTableMetaData {
  name: string; // Unique table identifier
  label: string; // User-facing table name
  isHidden: boolean; // Hide from navigation if true
  primaryKeyField: string; // Name of the primary key field
  fields: Record<string, QFieldMetaData>; // Field definitions
  sections: QTableSection[]; // Form/view section organization
  exposedJoins: QExposedJoin[]; // Relationships to other tables
  capabilities: Capability[]; // Operations enabled (QUERY, GET, INSERT, UPDATE, DELETE, COUNT)
  readPermission: boolean; // User can read records
  insertPermission: boolean; // User can create records
  editPermission: boolean; // User can modify records
  deletePermission: boolean; // User can delete records
  usesVariants: boolean; // Table has multiple views
  variantTableLabel: string; // Label for variant selector
  helpContent?: QHelpContent; // Table-level help
  supplementalTableMetaData?: Record<string, any>; // Additional metadata
  shareableTableMetaData?: Record<string, any>; // Shareable configuration
}
```

### QFieldMetaData
Defines a single field within a table, including type, constraints, and display behavior.
```typescript
export interface QFieldMetaData {
  name: string; // Field identifier
  label: string; // User-facing field name
  type: QFieldType; // Data type (STRING, INTEGER, BOOLEAN, DATE, etc.)
  isRequired: boolean; // Must have a value
  isEditable: boolean; // User can modify this field
  isHeavy: boolean; // Large data; load on demand
  isHidden: boolean; // Don't display in UI
  defaultValue?: any; // Initial value for new records
  possibleValueSourceName?: string; // Reference to dropdown options endpoint
  displayFormat?: string; // Formatting pattern for display (e.g., "currency", "percentage")
  maxLength?: number; // Maximum string/text length
  gridColumns?: number; // Width hint for responsive layouts
  adornments: FieldAdornment[]; // Visual/interactive enhancements (icons, links, file uploads)
  helpContents?: QHelpContent[]; // Field-level help
  behaviors?: string[]; // Special behaviors (e.g., "readonly_after_create")
}
```

### QProcessMetaData
Definition of a process or workflow with its steps and configuration.
```typescript
export interface QProcessMetaData {
  name: string; // Process identifier
  label: string; // User-facing process name
  tableName: string; // Associated table name
  isHidden: boolean; // Hide from navigation
  iconName: string; // Icon reference for UI
  hasPermission: boolean; // User can execute this process
  stepFlow: "LINEAR"; // Step flow type (only LINEAR currently documented)
  minInputRecords: number; // Minimum records required as input
  maxInputRecords: number; // Maximum records allowed as input
  frontendSteps: QFrontendStepMetaData[]; // Step definitions
}
```

### QFrontendStepMetaData
Describes a single step within a process workflow.
```typescript
export interface QFrontendStepMetaData {
  name: string; // Step identifier
  label: string; // Display name
  format?: string; // Layout format hint
  components: QFrontendComponent[]; // UI components to render
  formFields?: QFieldMetaData[]; // Fields for input forms
  viewFields?: QFieldMetaData[]; // Fields for display-only views
  recordListFields?: QFieldMetaData[]; // Fields for record list display
  helpContents?: QHelpContent[]; // Step-level help
}
```

### QAppMetaData
Defines an application or dashboard with its sections and widgets.
```typescript
export interface QAppMetaData {
  name: string; // App identifier
  label: string; // Display name
  children: QAppTreeNode[]; // Child apps or items
  iconName: string; // Icon reference
  widgets: string[]; // Dashboard widget names
  sections: QAppSection[]; // Logical sections within app
}
```

### QAppTreeNode
Represents a single node in the hierarchical application navigation tree.
```typescript
export interface QAppTreeNode {
  name: string; // Node identifier
  label: string; // Display name
  type: QAppNodeType; // Node type (TABLE, PROCESS, REPORT, APP)
  children?: QAppTreeNode[]; // Nested children
  iconName?: string; // Icon reference
  icon?: QIcon; // Detailed icon configuration
}
```

### QAppNodeType
Type discriminator for navigation tree nodes.
```typescript
export type QAppNodeType = "TABLE" | "PROCESS" | "REPORT" | "APP";
```

### QAppSection
Represents a section within an app (e.g., "Users", "Settings") containing tables/processes/reports.
```typescript
export interface QAppSection {
  name: string; // Section identifier
  label: string; // Display name
  icon?: QIcon; // Section icon
  tables: string[]; // Table names in section
  processes: string[]; // Process names in section
  reports: string[]; // Report names in section
}
```

### QWidgetMetaData
Configuration for a dashboard widget.
```typescript
export interface QWidgetMetaData {
  name: string; // Widget identifier
  label: string; // Display name
  type?: string; // Widget type (chart, grid, statistic, etc.)
  hasPermission: boolean; // User can view this widget
  dropdowns?: Record<string, any>; // Dropdown selections for widget
  helpContent?: QHelpContent; // Widget-level help
}
```

### QAuthenticationMetaData
Authentication system configuration.
```typescript
export interface QAuthenticationMetaData {
  name: string; // Authentication provider name
  type: "AUTH_0" | "OAUTH2" | "FULLY_ANONYMOUS" | "MOCK"; // Auth type
  values: {
    clientId?: string; // OAuth client ID
    baseUrl?: string; // Provider base URL
    audience?: string; // OAuth audience claim
  };
}
```

### QBrandingMetaData
Application branding, theming, and custom styling.
```typescript
export interface QBrandingMetaData {
  companyName: string; // Company/organization name
  companyUrl: string; // Company website URL
  appName: string; // Application name
  logo?: string; // Company logo URL or base64
  icon?: string; // Application icon URL or base64
  accentColor?: string; // Primary accent color (hex code)
  banners?: Record<string, Banner>; // Environment/status banners
}
```

### QTableSection
Organizes fields within a table form or view into logical groupings.
```typescript
export interface QTableSection {
  name: string; // Section identifier
  label: string; // Display name
  tier?: string; // Priority tier (e.g., "basic", "advanced")
  iconName?: string; // Icon reference
  fieldNames: string[]; // Field names in this section
  widgetName?: string; // Optional embedded widget
  isHidden: boolean; // Hide entire section
  gridColumns?: number; // Column count for responsive layout
}
```

### QExposedJoin
Represents a relationship between tables.
```typescript
export interface QExposedJoin {
  label: string; // Relationship display name
  isMany: boolean; // One-to-many (true) or one-to-one (false)
  joinTable?: QTableMetaData; // Target table metadata
  joinPath?: QJoinMetaData[]; // Path steps through intermediate tables
}
```

### QJoinMetaData
Single step in a join path between tables.
```typescript
export interface QJoinMetaData {
  name: string; // Join identifier
  type: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE"; // Relationship type
  leftTable: string; // Source table name
  rightTable: string; // Target table name
}
```

### QReportMetaData
Definition of a report (typically backed by a process).
```typescript
export interface QReportMetaData {
  name: string; // Report identifier
  label: string; // Display name
  isHidden: boolean; // Hide from navigation
  hasPermission: boolean; // User can access report
}
```

### QHelpContent
Contextual help text and rich content for UI elements.
```typescript
export interface QHelpContent {
  title?: string; // Help section title
  content?: string; // Help text or HTML
  links?: Array<{ label: string; url: string }>; // Related links
  roles?: string[]; // Show only to specific user roles
}
```

### QIcon
Icon configuration with name, path, and styling.
```typescript
export interface QIcon {
  name: string; // Icon identifier
  path?: string; // SVG path or icon URL
  color?: string; // Icon color (hex or CSS color)
}
```

### QTableVariant
Alternative view/configuration of a table.
```typescript
export interface QTableVariant {
  name: string; // Variant identifier
  label: string; // Display name
  description?: string; // Variant description
}
```

### Banner
Status or environment banner configuration.
```typescript
export interface Banner {
  text: string; // Banner text
  severity: "info" | "warning" | "error"; // Visual severity level
  color?: string; // Custom color (hex)
  dismissible: boolean; // User can close banner
}
```

### FieldAdornment
Visual or interactive enhancement applied to a field (links, chips, file uploads, etc.).
```typescript
export interface FieldAdornment {
  type: AdornmentType; // Adornment category
  values?: Record<string, any>; // Configuration-specific values
}
```

---

## Enum Types

### QFieldType
Enumeration of all supported field data types.
```typescript
export type QFieldType =
  | "STRING" // Short text
  | "INTEGER" // Whole number
  | "LONG" // Large whole number
  | "DECIMAL" // Floating-point number
  | "BOOLEAN" // True/false
  | "DATE" // Date (no time)
  | "TIME" // Time (no date)
  | "DATE_TIME" // Date and time
  | "TEXT" // Long text
  | "HTML" // HTML content
  | "PASSWORD" // Sensitive text (masked in UI)
  | "BLOB"; // Binary large object
```

### QComponentType
Component types available within process steps.
```typescript
export type QComponentType =
  | "HELP_TEXT" // Static help text
  | "BULK_EDIT_FORM" // Multi-record edit form
  | "BULK_LOAD_FILE_MAPPING_FORM" // CSV column mapping
  | "BULK_LOAD_VALUE_MAPPING_FORM" // Source-to-DB value mapping
  | "BULK_LOAD_PROFILE_FORM" // Saved bulk load profile
  | "VALIDATION_REVIEW_SCREEN" // Review validation errors
  | "EDIT_FORM" // Record edit form
  | "VIEW_FORM" // Record display form
  | "DOWNLOAD_FORM" // File download form
  | "RECORD_LIST" // Records display
  | "PROCESS_SUMMARY_RESULTS" // Process completion summary
  | "GOOGLE_DRIVE_SELECT_FOLDER" // Google Drive folder picker
  | "WIDGET" // Custom widget
  | "HTML"; // Custom HTML content
```

### AdornmentType
Types of field enhancements.
```typescript
export type AdornmentType =
  | "LINK" // Clickable hyperlink
  | "CHIP" // Tag/chip display
  | "SIZE" // Bytesize formatter
  | "ERROR" // Error state indicator
  | "RENDER_HTML" // Render as HTML
  | "REVEAL" // Show/hide toggle
  | "CODE_EDITOR" // Code editing interface
  | "FILE_DOWNLOAD" // Download link
  | "FILE_UPLOAD" // File upload control
  | "TOOLTIP"; // Hover tooltip
```

### Capability
Feature toggle enumerations for table operations.
```typescript
export type Capability =
  | "TABLE_QUERY" // List/query records
  | "TABLE_GET" // Fetch single record
  | "TABLE_COUNT" // Count records
  | "TABLE_INSERT" // Create new record
  | "TABLE_UPDATE" // Edit record
  | "TABLE_DELETE"; // Delete record
```

### QCriteriaOperator
Filter operator enumerations for building query criteria.
```typescript
export type QCriteriaOperator =
  | "EQUALS" // Exact match
  | "NOT_EQUALS" // Not equal
  | "NOT_EQUALS_OR_IS_NULL" // Not equal or missing
  | "IN" // Within list
  | "NOT_IN" // Not in list
  | "STARTS_WITH" // String prefix
  | "ENDS_WITH" // String suffix
  | "CONTAINS" // Substring match
  | "NOT_STARTS_WITH" // Exclude prefix
  | "NOT_ENDS_WITH" // Exclude suffix
  | "NOT_CONTAINS" // Exclude substring
  | "LESS_THAN" // Numeric/date <
  | "LESS_THAN_OR_EQUALS" // Numeric/date <=
  | "GREATER_THAN" // Numeric/date >
  | "GREATER_THAN_OR_EQUALS" // Numeric/date >=
  | "IS_BLANK" // Empty/null
  | "IS_NOT_BLANK" // Non-empty/not null
  | "BETWEEN" // Within range (inclusive)
  | "NOT_BETWEEN"; // Outside range
```

---

## Query Types

### QQueryFilter
Tree-structured query definition with criteria, ordering, and pagination.
```typescript
export interface QQueryFilter {
  criteria: QFilterCriteria[]; // Filter conditions
  orderBys?: QFilterOrderBy[]; // Sort specifications
  subFilters?: QQueryFilter[]; // Nested boolean logic
  booleanOperator: "AND" | "OR"; // How criteria/subFilters combine
  skip: number; // Offset for pagination
  limit: number; // Max records to return
}
```

### QFilterCriteria
Single filter condition within a QQueryFilter.
```typescript
export interface QFilterCriteria {
  fieldName: string; // Field being filtered
  operator: QCriteriaOperator; // Comparison operator
  values: (string | number | boolean | FilterVariableExpression | NowExpression | NowWithOffsetExpression | ThisOrLastPeriodExpression)[]; // Values to compare
  otherFieldName?: string; // For field-to-field comparisons
}
```

### QFilterOrderBy
Sort specification within a query.
```typescript
export interface QFilterOrderBy {
  fieldName: string; // Field to sort by
  isAscending: boolean; // Sort direction
}
```

### QueryJoin
Join specification for including related tables in a query.
```typescript
export interface QueryJoin {
  joinTable: string; // Table name to join
  select: boolean; // Include in results
  type: "INNER" | "LEFT" | "RIGHT" | "FULL"; // Join type
  baseTableOrAlias?: string; // Base table or alias
  alias?: string; // Join alias
  joinName?: string; // Named join identifier
}
```

### FilterVariableExpression
Placeholder for dynamic filter variable substitution.
```typescript
export interface FilterVariableExpression {
  type: "FILTER_VARIABLE"; // Expression type marker
  variableName: string; // Variable name to substitute
}
```

### NowExpression
Represents the current date/time in filter expressions.
```typescript
export interface NowExpression {
  type: "NOW"; // Expression type marker
}
```

### NowWithOffsetExpression
Represents current date/time with offset (e.g., +7 days, -1 month).
```typescript
export interface NowWithOffsetExpression {
  type: "NOW_WITH_OFFSET"; // Expression type marker
  offsetValue: number; // Offset magnitude
  offsetUnit: "DAY" | "WEEK" | "MONTH" | "YEAR"; // Offset unit
  isNegativeOffset: boolean; // Add (false) or subtract (true)
}
```

### ThisOrLastPeriodExpression
Represents "this period" or "last period" relative expressions (week, month, quarter, year).
```typescript
export interface ThisOrLastPeriodExpression {
  type: "THIS_OR_LAST_PERIOD"; // Expression type marker
  period: "WEEK" | "MONTH" | "QUARTER" | "YEAR"; // Time period
  isLast: boolean; // This period (false) or last period (true)
}
```

---

## Process Job Types

### QJobStarted
Indicates async job has been initiated; frontend should poll for status.
```typescript
export interface QJobStarted {
  processUUID: string; // Process execution ID
  jobUUID: string; // Async job ID for polling
}
```

### QJobRunning
Indicates job is in progress with optional progress information.
```typescript
export interface QJobRunning {
  processUUID: string; // Process execution ID
  message: string; // Status message
  current?: number; // Current progress count
  total?: number; // Total progress count
}
```

### QJobComplete
Indicates job completed successfully with next step information.
```typescript
export interface QJobComplete {
  processUUID: string; // Process execution ID
  values: Record<string, any>; // Step output values
  nextStep?: string; // Name of next step to execute
  backStep?: string; // Name of previous step (for back navigation)
  processMetaDataAdjustment?: ProcessMetaDataAdjustment; // Dynamic step/field changes
}
```

### QJobError
Indicates job failed with error details.
```typescript
export interface QJobError {
  processUUID: string; // Process execution ID
  error: string; // Technical error details
  userFacingError?: string; // User-friendly error message
}
```

### ProcessMetaDataAdjustment
Dynamic modifications to process metadata after a step completes.
```typescript
export interface ProcessMetaDataAdjustment {
  addedSteps?: QFrontendStepMetaData[]; // Steps to insert
  removedSteps?: string[]; // Step names to remove
  modifiedFields?: Record<string, Partial<QFieldMetaData>>; // Field changes
}
```

---

## Usage Notes

- All type names prefixed with `Q` follow the QQQ naming convention
- Use `interface` (not `class`) as these represent data contracts
- Import and use these types in all frontend implementations to ensure API contract alignment
- Never create custom type aliases; always reference these canonical definitions
- Mark fields as optional using `?` only when explicitly documented as optional
- All `Record<string, X>` mappings use string keys (field/table/process/widget names)
- Process job types form a discriminated union; use the `processUUID` and type presence to determine state
- Filter expressions support runtime variable substitution via `FilterVariableExpression` types
