# Work Package 3: Record View and CRUD

**Package Status:** Ready for implementation (depends on Package 1 complete)
**Estimated Duration:** 6 weeks
**Team Size:** 2-3 engineers
**Priority:** High
**Risk Level:** Medium (complex form generation, multiple field types, file handling)

---

## 1. Prerequisites

### Package 1 Dependencies (Must be Complete)
- TypeScript types (`/src/types/index.ts`): QInstance, QTableMetaData, QFieldMetaData, QRecord, QQueryFilter, QPossibleValue
- API client (`/src/lib/api/client.ts`): axios instance with 401 interceptor
- Metadata functions (`/src/lib/api/metadata.ts`): loadMetaData, loadTableMetaData
- TanStack Query v5 setup (`/src/lib/query-client.ts`): queryClient, queryKeys factory
- QContext provider (`/src/lib/context/q-context.tsx`): useQContext hook
- Dashboard layout: Sidebar, Header, Breadcrumbs, navigation routing
- Placeholder pages for `/[tableName]/page.tsx`, `/[tableName]/[recordId]/page.tsx`, `/[tableName]/new/page.tsx`, `/[tableName]/[recordId]/edit/page.tsx`, `/[tableName]/[recordId]/copy/page.tsx`

### Development Environment
- Node.js 18+
- Next.js 15 with App Router
- TypeScript 5.3+
- React 19 with hooks
- Tailwind CSS 4
- shadcn/ui components pre-installed
- React Hook Form 7.48+
- Zod 3.22+
- TanStack Query v5
- react-big-calendar (optional, for date pickers)
- Draft.js or similar (for rich text editor)
- Axios 1.6+

### Team Knowledge
- TypeScript generics and advanced types
- React Server Components vs Client Components in Next.js 15
- Form state management with React Hook Form
- Data validation with Zod
- Query management with TanStack Query
- File handling in multipart/form-data
- Responsive design with Tailwind CSS

---

## 2. Requirements Traceability

| Requirement Section | Feature | Implementation Component |
|---|---|---|
| 5.2.3 | Record view/create/edit/copy routes | `/src/app/(dashboard)/app/[tableName]/[recordId]/page.tsx`, etc. |
| 5.3.2 | Record Detail View | RecordView.tsx, FieldDisplay component |
| 5.3.3 | Form Components | EntityForm.tsx, DynamicFormField.tsx |
| 5.4.2 | Responsive layout (view & form) | Tailwind CSS responsive classes, gridColumns prop |
| 3.4.3 | GET /qqq/v1/table/{tableName}/{primaryKey} | useRecord hook, getRecord API function |
| 3.4.4 | POST /qqq/v1/table/{tableName} | createRecord API function, mutate hook |
| 3.4.5 | PUT /qqq/v1/table/{tableName}/{primaryKey} | updateRecord API function, mutate hook |
| 3.4.6 | DELETE /qqq/v1/table/{tableName}/{primaryKey} | deleteRecord API function, mutate hook |
| 3.7 | POST /qqq/v1/table/{tableName}/possibleValues/{fieldName} | getPossibleValues API function |
| Field Types | All 12 field types (STRING, INTEGER, LONG, DECIMAL, BOOLEAN, DATE, TIME, DATE_TIME, TEXT, HTML, PASSWORD, BLOB) | DynamicFormField.tsx per-type rendering |
| Adornments | All adornment types (LINK, CHIP, SIZE, ERROR, RENDER_HTML, REVEAL, CODE_EDITOR, FILE_DOWNLOAD, FILE_UPLOAD, TOOLTIP) | FieldDisplay.tsx, DynamicFormField.tsx |
| Validation | Zod schema generation, field constraints | validateAndBuildSchema function |
| Permissions | Edit/delete/create gating | usePermissions hook, conditional rendering |
| Keyboard Shortcuts | n=new, e=edit, c=copy, d=delete, a=audit | useKeyboardShortcuts hook |

---

## 3. Shared Context Files Required

### From Package 1 - Type Definitions
```
/src/types/index.ts:
- QInstance
- QTableMetaData
- QFieldMetaData (with all 12 field types and adornment types)
- QRecord
- QQueryFilter
- QPossibleValue
- QPermissions
- QSection
- QBehavior
- QHelpContent
```

### From Package 1 - API & Query
```
/src/lib/api/client.ts
/src/lib/api/metadata.ts
/src/lib/query-client.ts
/src/lib/context/q-context.tsx
```

### From Package 1 - UI Components (shadcn/ui)
```
@/components/ui/button
@/components/ui/input
@/components/ui/select
@/components/ui/checkbox
@/components/ui/textarea
@/components/ui/dialog
@/components/ui/form
@/components/ui/popover
@/components/ui/command
@/components/ui/loading
@/components/ui/alert
@/components/ui/card
@/components/ui/tabs
@/components/ui/tooltip
@/components/ui/badge
```

---

## 4. Scope: In and Out

### IN SCOPE - Package 3

**Record View:**
- Display single record with all field types rendered appropriately
- T1 sections displayed in hero/top area with visual prominence
- Non-T1 sections below in card layout
- Field value rendering respecting all 12 field types
- Field display adornments (LINK, CHIP, SIZE, ERROR, RENDER_HTML, REVEAL, CODE_EDITOR, FILE_DOWNLOAD, TOOLTIP)
- Associated records display (sidebar or tabs)
- Help content tooltips on fields
- Action menu: Edit, Delete, Copy, Launch Process, Share
- Keyboard shortcuts: n=new, e=edit, c=copy, d=delete, a=audit
- Permission-gated actions based on editPermission, deletePermission
- Loading and error states

**Create/Edit/Copy Forms:**
- Dynamic form generation from QFieldMetaData
- All 12 field type inputs: text, number, date, time, datetime, textarea, rich text, password, file upload, boolean switch, select, autocomplete
- Form layout by sections with section names and icons
- gridColumns support for multi-column fields within sections
- Form validation via Zod schemas generated from metadata
- Field constraints: required, maxLength, type validation
- File upload fields (single and multi-file) with preview
- Boolean tri-state: null/false/true values
- Possible values autocomplete with debounced search (300ms delay)
- Rich text editor for HTML field type
- Code editor syntax highlighting for PASSWORD and custom code fields
- Dirty tracking and unsaved changes warning
- Success/error messages after form submission
- Field-level help content and error messages

**Associated Records:**
- Display records related via foreign key relationships
- List or table view per association metadata
- Clickable links to navigate to associated record details

**CRUD Operations:**
- Create: POST to /qqq/v1/table/{tableName}, multipart/form-data
- Read: GET from /qqq/v1/table/{tableName}/{primaryKey}
- Update: PUT to /qqq/v1/table/{tableName}/{primaryKey}, multipart/form-data
- Delete: DELETE to /qqq/v1/table/{tableName}/{primaryKey} with confirmation
- Optimistic updates and error recovery

### OUT OF SCOPE - Package 3 (For Future Packages)

- **Record Query/Grid (Package 2):** Table views, filtering, sorting, pagination
- **Process Execution (Package 4):** Workflow engine, multi-step processes
- **Widgets (Package 5):** Custom dashboard widgets on record view
- **Developer Views (Package 6):** SQL editors, debug panels
- **Export/Import:** Bulk operations
- **Advanced Permissions:** Role-based access beyond edit/delete/create flags
- **Audit Trail UI:** Beyond audit button to view logs
- **Inline Editing:** Cell-level editing in tables

---

## 5. Detailed Implementation Steps

### Step 1: Create API Client Functions and Query Hooks

**File:** `/src/lib/api/records.ts`

Create the API integration layer with type safety and error handling.

**Implementation:**
- Implement getRecord function with query params (tableVariant, includeAssociations, queryJoins)
- Implement createRecord with multipart/form-data handling
- Implement updateRecord with optimistic updates
- Implement deleteRecord with confirmation callback
- Implement getPossibleValues with debounced search
- Add query key factory for TanStack Query
- Add error interceptors for 401 (re-auth) and form validation errors
- Add type guards for response validation

**Deliverables:**
- Fully typed API functions with JSDoc comments
- Query hooks: useRecord, useCreateRecord, useUpdateRecord, useDeleteRecord, usePossibleValues
- Query key constants
- Error types and handling

---

### Step 2: Create Validation Schema Generator

**File:** `/src/lib/forms/schema-builder.ts`

Generate Zod schemas dynamically from QFieldMetaData.

**Implementation:**
- Parse QFieldMetaData to determine field constraints
- Build Zod schema with required, maxLength, regex patterns per type
- Handle all 12 field types with appropriate constraints
- Create schema for entire table from QTableMetaData sections
- Export function: buildFormSchema(tableMetaData: QTableMetaData): ZodSchema
- Add custom error messages for validation failures
- Support conditional validation based on behaviors

**Deliverables:**
- schema-builder.ts with buildFormSchema function
- Per-type validation: string max length, integer min/max, date ranges, etc.
- Error message templates
- Type safety for runtime schema

---

### Step 3: Create FieldDisplay Component

**File:** `/src/components/record/FieldDisplay.tsx`

Render field values with all 12 types and adornment support.

**Implementation:**
- Accept fieldMetadata, value, displayValue, record context
- Implement per-type rendering:
  - STRING: text with optional LINK adornment
  - INTEGER/LONG/DECIMAL: formatted numbers with optional SIZE adornment
  - BOOLEAN: yes/no badge or tri-state indicator
  - DATE: formatted date (MM/DD/YYYY)
  - TIME: formatted time (HH:MM:SS)
  - DATE_TIME: formatted datetime with timezone
  - TEXT: paragraph text, handle line breaks
  - HTML: sanitized HTML rendering with RENDER_HTML adornment
  - PASSWORD: reveal toggle with REVEAL adornment, asterisks by default
  - BLOB: FILE_DOWNLOAD button with file icon
- Implement adornments:
  - LINK: href, open in new tab option
  - CHIP: inline badge styling
  - SIZE: file size formatting (bytes → MB/GB)
  - ERROR: red border + error icon
  - RENDER_HTML: parse and render HTML safely
  - REVEAL: password reveal toggle (eye icon)
  - CODE_EDITOR: syntax-highlighted code block (read-only)
  - FILE_DOWNLOAD: download button with metadata
  - FILE_UPLOAD: preview of uploaded file (handled in form)
  - TOOLTIP: hover text with tooltip component
- Support help content as tooltip
- Handle null/undefined values gracefully
- Support displayFormat if present

**Deliverables:**
- FieldDisplay.tsx component
- Per-type rendering logic
- Adornment handlers
- TypeScript interface for props

---

### Step 4: Create DynamicFormField Component

**File:** `/src/components/forms/DynamicFormField.tsx`

Render form inputs for all 12 field types with validation.

**Implementation:**
- Integrate React Hook Form useController
- Implement per-type input:
  - STRING: <Input type="text" /> with maxLength prop
  - INTEGER: <Input type="number" /> step="1"
  - LONG: <Input type="number" /> step="1"
  - DECIMAL: <Input type="number" /> step="0.01"
  - BOOLEAN: Custom tri-state switch (null/false/true)
  - DATE: Date picker (react-day-picker or similar)
  - TIME: Time picker (HH:MM:SS)
  - DATE_TIME: DateTime picker (date + time)
  - TEXT: <Textarea /> with optional character counter
  - HTML: Rich text editor (Draft.js or Tiptap)
  - PASSWORD: <Input type="password" /> with show/hide toggle, strength indicator
  - BLOB: File upload input (single or multi-file per metadata)
- Implement possibleValues autocomplete:
  - Input with Command/Popover for dropdown
  - Debounced search (300ms) calling POST /possibleValues/{fieldName}
  - Cache results in component state
  - Support single vs multi-select based on metadata
- Add field-level validation errors (from Zod)
- Add help content as popover or tooltip
- Support conditional visibility based on behaviors
- Render adornments in form context (reveal for password, file upload button)
- Support defaultValue from metadata and record values
- Handle file previews for BLOB fields

**Deliverables:**
- DynamicFormField.tsx component
- Per-type input components
- Autocomplete with debouncing
- File upload handler
- Error and help content rendering
- TypeScript interfaces for all input props

---

### Step 5: Create EntityForm Component

**File:** `/src/components/forms/EntityForm.tsx`

Multi-section form layout for create/edit/copy operations.

**Implementation:**
- Use React Hook Form with Zod schema validation
- Render sections from QTableMetaData.sections in order
- Per-section:
  - Render section label and icon
  - Render fields in gridColumns layout (CSS Grid)
  - Skip hidden sections (isHidden: true)
  - Apply section-level styling (card, background)
- Render all fields in section as DynamicFormField components
- Support form submission: collect all values, construct multipart/form-data
- Handle file fields: append File objects to FormData
- Call appropriate mutation (createRecord, updateRecord, deleteRecord)
- Show loading state during submission
- Show success toast on completion
- Show error messages on failure
- Track dirty state and warn on unsaved changes (beforeunload)
- Support optional field filtering (exclude certain fields per route)
- Add Cancel and Submit buttons
- Reset form on successful submission (create) or back on edit

**Deliverables:**
- EntityForm.tsx component
- Multi-section layout with gridColumns
- Form submission logic
- Dirty tracking and unsaved changes warning
- Success/error feedback
- File handling in FormData
- TypeScript interface for form props

---

### Step 6: Create RecordView Component

**File:** `/src/components/record/RecordView.tsx`

Display single record with all sections, fields, and associated records.

**Implementation:**
- Fetch record using useRecord hook with tableName and recordId
- Display loading spinner during fetch
- Handle error state with error message and retry button
- Separate sections into T1 (hero) and non-T1
- Render T1 sections at top in hero area with larger typography, colored background
- Render non-T1 sections below as cards in grid layout
- Per-section:
  - Render section label and icon
  - Render fields using FieldDisplay component
  - Display widget if widgetName present (via DashboardWidgets)
  - Skip hidden sections
- Render action menu (button group or dropdown):
  - Edit: navigate to edit page (permission: editPermission)
  - Delete: open confirmation dialog (permission: deletePermission)
  - Copy: navigate to copy page
  - Launch Process: placeholder for Package 4
  - Share: placeholder for later
  - Audit: keyboard shortcut or menu item
- Implement keyboard shortcuts using useEffect and keydown listener:
  - n: navigate to new page
  - e: navigate to edit page
  - c: navigate to copy page
  - d: trigger delete dialog
  - a: launch audit view
- Display associated records in sidebar or tabs:
  - List or table of related records
  - Clickable links to navigate to associated record
- Support breadcrumbs showing table > record label
- Support full-page view or modal/panel view

**Deliverables:**
- RecordView.tsx component
- Section separation and rendering
- Action menu with permission gates
- Keyboard shortcuts handler
- Associated records display
- TypeScript interfaces for component props

---

### Step 7: Create Record Routes and Pages

**File Set:**
- `/src/app/(dashboard)/app/[tableName]/[recordId]/page.tsx`
- `/src/app/(dashboard)/app/[tableName]/new/page.tsx`
- `/src/app/(dashboard)/app/[tableName]/[recordId]/edit/page.tsx`
- `/src/app/(dashboard)/app/[tableName]/[recordId]/copy/page.tsx`

Implement route handlers and page wrappers.

**Implementation:**
- **Record View Page:** Server component fetching metadata, client wrapper rendering RecordView
- **Create Page:** Server component with layout, client form rendering EntityForm for create
  - Initialize empty form values
  - No recordId in URL
- **Edit Page:** Server component with layout, client form rendering EntityForm for edit
  - Fetch existing record and pre-populate form
  - Show recordId in form (read-only)
  - Submit as PUT with recordId
- **Copy Page:** Server component with layout, client form rendering EntityForm for copy
  - Fetch existing record and pre-populate form values
  - Clear primary key field (allow new ID generation)
  - Submit as POST (create)
  - Show "Copy of {recordLabel}" in title
- Add back button navigation to list or previous page
- Add metadata loading and error handling
- Support query params for context (tableVariant, etc.)

**Deliverables:**
- 4 page.tsx files with layout integration
- Client/server component split per Next.js 15 best practices
- Metadata and record fetching
- Navigation and routing

---

### Step 8: Create Delete Confirmation Dialog

**File:** `/src/components/dialogs/DeleteConfirmDialog.tsx`

Confirmation UI for destructive operations.

**Implementation:**
- Modal dialog with title, description, confirm/cancel buttons
- Show record label being deleted
- Show associated records warning if present
- Call deleteRecord mutation on confirm
- Show loading state during deletion
- Handle error with error message retry
- Close dialog on success
- Support keyboard Escape to cancel

**Deliverables:**
- DeleteConfirmDialog.tsx component
- Confirmation copy per record
- Error handling and retry
- TypeScript interfaces

---

### Step 9: Create File Upload Component

**File:** `/src/components/forms/FileUploadField.tsx`

Handle single and multi-file uploads with preview.

**Implementation:**
- Accept fieldMetadata for single/multi-file support
- Drag-and-drop area for file selection
- File input with accept type filters based on metadata
- Preview of selected files (thumbnails for images, file icons)
- Remove file button per selected file
- Display file size and type
- Validation: file count, file size limits
- Integration with React Hook Form (register as file input)
- Support for file replacement (remove + re-add)

**Deliverables:**
- FileUploadField.tsx component
- Drag-and-drop handler
- File preview and removal
- Validation
- TypeScript interfaces

---

### Step 10: Create Rich Text Editor Field

**File:** `/src/components/forms/RichTextEditorField.tsx`

HTML field rendering with rich text editor.

**Implementation:**
- Use Tiptap or Draft.js for rich text editing
- Toolbar with formatting: bold, italic, underline, heading, lists, links, quotes
- Display formatted HTML output
- Integration with React Hook Form
- Support markdown or HTML input/output
- Sanitize HTML on save (DOMPurify)
- Full-screen editing option for large content

**Deliverables:**
- RichTextEditorField.tsx component
- Toolbar configuration
- HTML sanitization
- TypeScript interfaces

---

### Step 11: Create Date and Time Picker Components

**File:** `/src/components/forms/DateTimePickerFields.tsx`

Calendar and time inputs.

**Implementation:**
- DATE field: Calendar picker (react-day-picker) with date selection
- TIME field: Time input with HH:MM:SS format
- DATE_TIME field: Combined calendar + time picker
- Support date range validation (min/max dates from metadata)
- Show selected value in clear format
- Integration with React Hook Form
- Keyboard navigation support

**Deliverables:**
- DateTimePickerFields.tsx component(s)
- Calendar and time picker UI
- Format handling
- TypeScript interfaces

---

### Step 12: Create Possible Values Autocomplete

**File:** `/src/components/forms/PossibleValuesAutocomplete.tsx`

Autocomplete input with debounced server search.

**Implementation:**
- Input field with dropdown/popover
- Debounce search input (300ms delay)
- Call POST /qqq/v1/table/{tableName}/possibleValues/{fieldName} with searchTerm
- Display results as command menu items
- Cache results to avoid duplicate requests
- Support single and multi-select based on metadata
- Show loading spinner during search
- Highlight search term matches in results
- Support keyboard navigation (arrow keys, enter)
- Support clear selection button
- Integration with React Hook Form (useController)

**Deliverables:**
- PossibleValuesAutocomplete.tsx component
- Debounce and caching logic
- API integration
- TypeScript interfaces

---

### Step 13: Create Keyboard Shortcuts Handler

**File:** `/src/lib/hooks/useKeyboardShortcuts.ts`

Custom hook for record view keyboard shortcuts.

**Implementation:**
- useEffect to attach keydown listener
- Map key combinations to callbacks:
  - n: callback for new
  - e: callback for edit
  - c: callback for copy
  - d: callback for delete
  - a: callback for audit
- Ignore shortcuts when input is focused
- Clean up listener on unmount
- Support for disabling shortcuts per context

**Deliverables:**
- useKeyboardShortcuts.ts hook
- Keyboard event handling
- Callback registration
- TypeScript interfaces

---

### Step 14: Create Permissions Hook

**File:** `/src/lib/hooks/usePermissions.ts`

Determine if user can perform CRUD actions.

**Implementation:**
- Extract permissions from QContext
- Return flags: canView, canCreate, canEdit, canDelete
- Support table-level and record-level permissions
- Check editPermission, deletePermission, insertPermission from record or table metadata
- Cache permissions in context

**Deliverables:**
- usePermissions.ts hook
- Permission checking logic
- TypeScript interfaces

---

### Step 15: Create Associated Records Display Component

**File:** `/src/components/record/AssociatedRecordsDisplay.tsx`

Show related records via foreign keys.

**Implementation:**
- Display associated records from QRecord.associatedRecords
- Per-association: render as list or table
- Clickable rows to navigate to associated record
- Show count of associated records
- Support different display formats (list, card, table)
- Optional: inline creation of associated record (future)

**Deliverables:**
- AssociatedRecordsDisplay.tsx component
- List/table rendering
- Navigation links
- TypeScript interfaces

---

### Step 16: Create Help Content and Tooltips

**File:** `/src/components/common/FieldHelp.tsx`

Display field help content and validation errors.

**Implementation:**
- Render help content from QFieldMetaData.helpContents
- Display as tooltip or popover on field
- Show field label with help icon (?)
- Display validation error messages below input
- Distinguish between help text and error text (color coding)
- Support markdown in help content (optional)

**Deliverables:**
- FieldHelp.tsx component
- Help content rendering
- Error message styling
- TypeScript interfaces

---

### Step 17: Create Integration Tests

**File Set:**
- `/src/__tests__/integration/record-view.test.tsx`
- `/src/__tests__/integration/entity-form.test.tsx`
- `/src/__tests__/integration/api-records.test.ts`

Test CRUD operations end-to-end.

**Implementation:**
- Mock API responses for record fetch, create, update, delete
- Test record view rendering with sample data
- Test form submission and validation
- Test keyboard shortcuts
- Test file upload handling
- Test permission gating
- Test error states and recovery
- Test navigation between routes

**Deliverables:**
- Integration test suite with 50+ test cases
- Mock data and API handlers
- Test coverage for critical paths

---

### Step 18: Create Component Stories (Storybook)

**File Set:**
- `/src/components/record/FieldDisplay.stories.tsx`
- `/src/components/forms/DynamicFormField.stories.tsx`
- `/src/components/forms/EntityForm.stories.tsx`
- `/src/components/record/RecordView.stories.tsx`

Create Storybook stories for component testing and documentation.

**Implementation:**
- Story for each field type rendering in FieldDisplay
- Story for each field type input in DynamicFormField
- Story for EntityForm with various configurations
- Story for RecordView with different section arrangements
- Include args controls for interactive testing
- Include accessibility testing setup

**Deliverables:**
- Storybook stories for all major components
- Interactive component documentation
- Visual regression testing baseline

---

### Step 19: Documentation and Handoff

**File Set:**
- `/docs/implementation-plans/03-IMPLEMENTATION_NOTES.md`
- `/docs/user-guide/RECORD_VIEW_GUIDE.md`
- `/docs/developer-guide/FORM_CUSTOMIZATION.md`

Create reference documentation.

**Implementation:**
- Document schema builder usage
- Document validation rules per field type
- Document file upload constraints and formats
- Document possible values search API contract
- Document keyboard shortcuts
- Document permission model
- Document error handling and recovery flows
- Create troubleshooting guide

**Deliverables:**
- Implementation notes
- User guide for record view
- Developer guide for form customization
- API reference

---

## 6. Component Specifications

### 6.1 FieldDisplay Component

**File:** `/src/components/record/FieldDisplay.tsx`

```typescript
// Type definitions
interface FieldDisplayProps {
  field: QFieldMetaData;
  value: any;
  displayValue?: string;
  record: QRecord;
  className?: string;
  helpContent?: QHelpContent[];
}

interface FieldDisplayState {
  revealed: boolean; // For PASSWORD type
  expanded: boolean; // For CODE_EDITOR type
}

interface AdornmentConfig {
  type: 'LINK' | 'CHIP' | 'SIZE' | 'ERROR' | 'RENDER_HTML' | 'REVEAL' | 'CODE_EDITOR' | 'FILE_DOWNLOAD' | 'FILE_UPLOAD' | 'TOOLTIP';
  values?: Record<string, any>;
}

// Component
export const FieldDisplay: React.FC<FieldDisplayProps> = ({
  field,
  value,
  displayValue,
  record,
  className = '',
  helpContent = []
}) => {
  const [revealed, setRevealed] = useState(false);

  const renderByType = (type: QFieldType): ReactNode => {
    switch (type) {
      case 'STRING':
        return <span className="text-sm">{value || displayValue || '-'}</span>;
      case 'INTEGER':
      case 'LONG':
        return <span className="font-mono">{value?.toLocaleString() || '-'}</span>;
      case 'DECIMAL':
        return <span className="font-mono">{value?.toFixed(2) || '-'}</span>;
      case 'BOOLEAN':
        return (
          <Badge variant={value === true ? 'default' : 'outline'}>
            {value === true ? 'Yes' : value === false ? 'No' : 'Unknown'}
          </Badge>
        );
      case 'DATE':
        return <span>{value ? format(new Date(value), 'MM/dd/yyyy') : '-'}</span>;
      case 'TIME':
        return <span className="font-mono">{value || '-'}</span>;
      case 'DATE_TIME':
        return <span>{value ? format(new Date(value), 'MM/dd/yyyy HH:mm:ss') : '-'}</span>;
      case 'TEXT':
        return <p className="whitespace-pre-wrap text-sm">{value || '-'}</p>;
      case 'HTML':
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(value || '') }}
          />
        );
      case 'PASSWORD':
        return (
          <div className="flex items-center gap-2">
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              {revealed ? value : '••••••••'}
            </code>
            <button
              onClick={() => setRevealed(!revealed)}
              className="p-1 hover:bg-gray-100 rounded"
              title={revealed ? 'Hide' : 'Show'}
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        );
      case 'BLOB':
        return <FileDownloadButton value={value} field={field} />;
      default:
        return <span>-</span>;
    }
  };

  const renderAdornments = (adornments: AdornmentConfig[]): ReactNode => {
    return adornments.map((adornment) => {
      switch (adornment.type) {
        case 'LINK':
          return (
            <a
              href={adornment.values?.href || value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {adornment.values?.label || value}
            </a>
          );
        case 'CHIP':
          return <Badge variant="secondary">{value}</Badge>;
        case 'TOOLTIP':
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                {renderByType(field.type)}
              </TooltipTrigger>
              <TooltipContent>
                {adornment.values?.text || helpContent?.[0]?.content}
              </TooltipContent>
            </Tooltip>
          );
        default:
          return renderByType(field.type);
      }
    });
  };

  return (
    <div className={cn('field-display', className)}>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {field.label}
      </label>
      <div className="mt-2">
        {field.adornments && field.adornments.length > 0
          ? renderAdornments(field.adornments)
          : renderByType(field.type)}
      </div>
    </div>
  );
};
```

---

### 6.2 DynamicFormField Component

**File:** `/src/components/forms/DynamicFormField.tsx`

```typescript
interface DynamicFormFieldProps {
  field: QFieldMetaData;
  fieldState?: FieldState;
  control: Control<any>;
  disabled?: boolean;
  onValueChange?: (value: any) => void;
}

interface FieldState {
  isDirty: boolean;
  isTouched: boolean;
  error?: FieldError;
}

interface DynamicFormFieldInternalProps extends DynamicFormFieldProps {
  value: any;
  onChange: (value: any) => void;
  onBlur: () => void;
  error?: FieldError;
}

export const DynamicFormField: React.FC<DynamicFormFieldProps> = ({
  field,
  fieldState,
  control,
  disabled = false,
  onValueChange
}) => {
  const { field: fieldProps, fieldState: state } = useController({
    name: field.name,
    control,
    rules: {
      required: field.isRequired ? `${field.label} is required` : false,
      maxLength: field.maxLength ? {
        value: field.maxLength,
        message: `Maximum ${field.maxLength} characters`
      } : undefined,
      validate: getCustomValidator(field)
    }
  });

  return (
    <div className="form-field">
      <Label htmlFor={field.name} className="mb-2">
        {field.label}
        {field.isRequired && <span className="text-red-600">*</span>}
      </Label>

      <div className="relative">
        <DynamicFormFieldInternal
          field={field}
          fieldState={state}
          value={fieldProps.value}
          onChange={(value) => {
            fieldProps.onChange(value);
            onValueChange?.(value);
          }}
          onBlur={fieldProps.onBlur}
          disabled={disabled || !field.isEditable}
        />
      </div>

      {field.helpContents && field.helpContents.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {field.helpContents[0].content}
        </p>
      )}

      {state.error && (
        <p className="text-xs text-red-600 mt-1">{state.error.message}</p>
      )}
    </div>
  );
};

interface DynamicFormFieldInternalProps {
  field: QFieldMetaData;
  value: any;
  onChange: (value: any) => void;
  onBlur: () => void;
  disabled: boolean;
  fieldState?: FieldState;
}

const DynamicFormFieldInternal: React.FC<DynamicFormFieldInternalProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  fieldState
}) => {
  const renderField = (): ReactNode => {
    switch (field.type) {
      case 'STRING':
        return (
          <Input
            id={field.name}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            maxLength={field.maxLength}
            placeholder={field.label}
            aria-invalid={fieldState?.error ? 'true' : 'false'}
            className={fieldState?.error ? 'border-red-600' : ''}
          />
        );
      case 'INTEGER':
      case 'LONG':
        return (
          <Input
            id={field.name}
            type="number"
            step="1"
            value={value || ''}
            onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
            onBlur={onBlur}
            disabled={disabled}
            placeholder={field.label}
            aria-invalid={fieldState?.error ? 'true' : 'false'}
          />
        );
      case 'DECIMAL':
        return (
          <Input
            id={field.name}
            type="number"
            step="0.01"
            value={value || ''}
            onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
            onBlur={onBlur}
            disabled={disabled}
            placeholder={field.label}
            aria-invalid={fieldState?.error ? 'true' : 'false'}
          />
        );
      case 'BOOLEAN':
        return (
          <BooleanTriStateSwitch
            value={value}
            onChange={onChange}
            disabled={disabled}
            label={field.label}
          />
        );
      case 'DATE':
        return (
          <DatePickerField
            value={value}
            onChange={onChange}
            disabled={disabled}
            field={field}
          />
        );
      case 'TIME':
        return (
          <TimePickerField
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 'DATE_TIME':
        return (
          <DateTimePickerField
            value={value}
            onChange={onChange}
            disabled={disabled}
            field={field}
          />
        );
      case 'TEXT':
        return (
          <Textarea
            id={field.name}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={disabled}
            maxLength={field.maxLength}
            placeholder={field.label}
            rows={6}
            className="resize-vertical"
          />
        );
      case 'HTML':
        return (
          <RichTextEditorField
            value={value}
            onChange={onChange}
            disabled={disabled}
            field={field}
          />
        );
      case 'PASSWORD':
        return (
          <PasswordField
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            field={field}
            error={fieldState?.error}
          />
        );
      case 'BLOB':
        return (
          <FileUploadField
            value={value}
            onChange={onChange}
            disabled={disabled}
            field={field}
            multiple={field.maxLength && field.maxLength > 1}
          />
        );
      default:
        return <Input disabled placeholder="Unknown field type" />;
    }
  };

  return renderField();
};

// Helper: Get custom validator for field type
function getCustomValidator(field: QFieldMetaData): ((value: any) => boolean | string) | undefined {
  if (field.possibleValueSourceName) {
    return (value) => {
      // Validate against possible values (cached in component state)
      return true;
    };
  }
  return undefined;
}
```

---

### 6.3 EntityForm Component

**File:** `/src/components/forms/EntityForm.tsx`

```typescript
interface EntityFormProps {
  tableMetadata: QTableMetaData;
  initialRecord?: QRecord;
  mode: 'create' | 'edit' | 'copy';
  tableName: string;
  onSuccess: (record: QRecord) => void;
  onError: (error: Error) => void;
  excludeFields?: string[];
}

interface EntityFormState {
  isDirty: boolean;
  isSubmitting: boolean;
  showUnsavedWarning: boolean;
}

export const EntityForm: React.FC<EntityFormProps> = ({
  tableMetadata,
  initialRecord,
  mode,
  tableName,
  onSuccess,
  onError,
  excludeFields = []
}) => {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build form schema from metadata
  const schema = useMemo(
    () => buildFormSchema(tableMetadata, excludeFields),
    [tableMetadata, excludeFields]
  );

  // Initialize form with React Hook Form
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(initialRecord, tableMetadata, mode)
  });

  // API mutations
  const createMutation = useCreateRecord(tableName);
  const updateMutation = useUpdateRecord(tableName, initialRecord?.values?.id);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);

      // Construct FormData for multipart/form-data
      const formData = new FormData();

      Object.entries(data).forEach(([key, value]) => {
        if (value instanceof File) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item instanceof File) {
              formData.append(key, item);
            } else {
              formData.append(key, JSON.stringify(item));
            }
          });
        } else if (value !== null && value !== undefined) {
          formData.append(key, String(value));
        }
      });

      let result;
      if (mode === 'create' || mode === 'copy') {
        result = await createMutation.mutateAsync(formData);
      } else {
        result = await updateMutation.mutateAsync(formData);
      }

      setIsDirty(false);
      onSuccess(result);
      toast.success(`Record ${mode === 'edit' ? 'updated' : 'created'} successfully`);

      // Navigate to record view
      if (result.values?.id) {
        router.push(`/app/${tableName}/${result.values.id}`);
      }
    } catch (error) {
      onError(error as Error);
      toast.error(`Failed to ${mode} record`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
      {tableMetadata.sections.map((section) => (
        !section.isHidden && (
          <FormSection
            key={section.name}
            section={section}
            tableMetadata={tableMetadata}
            form={form}
            disabled={isSubmitting}
            excludeFields={excludeFields}
            onDirtyChange={setIsDirty}
          />
        )
      ))}

      <div className="flex gap-4 pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="ml-auto"
        >
          {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};

interface FormSectionProps {
  section: QSection;
  tableMetadata: QTableMetaData;
  form: UseFormReturn<any>;
  disabled: boolean;
  excludeFields: string[];
  onDirtyChange: (dirty: boolean) => void;
}

const FormSection: React.FC<FormSectionProps> = ({
  section,
  tableMetadata,
  form,
  disabled,
  excludeFields,
  onDirtyChange
}) => {
  const sectionFields = section.fieldNames
    .map((name) => tableMetadata.fields.find((f) => f.name === name))
    .filter((f): f is QFieldMetaData => f !== undefined && !excludeFields.includes(f.name));

  const gridColsClass = getGridColsClass(section.gridColumns);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {section.iconName && <Icon name={section.iconName} />}
          {section.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-6 ${gridColsClass}`}>
          {sectionFields.map((field) => (
            <Controller
              key={field.name}
              name={field.name}
              control={form.control}
              render={({ field: fieldProps, fieldState }) => (
                <div className="space-y-2">
                  <DynamicFormField
                    field={field}
                    fieldState={fieldState}
                    control={form.control}
                    disabled={disabled}
                    onValueChange={() => onDirtyChange(true)}
                  />
                </div>
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper: Get grid layout class from gridColumns
function getGridColsClass(gridColumns?: number): string {
  switch (gridColumns) {
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-2';
    case 3:
      return 'grid-cols-3';
    case 4:
      return 'grid-cols-4';
    default:
      return 'grid-cols-1 md:grid-cols-2';
  }
}

// Helper: Build default values from record or metadata
function getDefaultValues(
  initialRecord: QRecord | undefined,
  metadata: QTableMetaData,
  mode: 'create' | 'edit' | 'copy'
): Record<string, any> {
  const defaults: Record<string, any> = {};

  metadata.fields.forEach((field) => {
    if (mode === 'edit' && initialRecord) {
      defaults[field.name] = initialRecord.values[field.name] ?? field.defaultValue ?? null;
    } else if (mode === 'copy' && initialRecord) {
      // Don't copy primary key for copy mode
      if (!isPrimaryKey(field.name, metadata)) {
        defaults[field.name] = initialRecord.values[field.name] ?? field.defaultValue ?? null;
      }
    } else {
      defaults[field.name] = field.defaultValue ?? null;
    }
  });

  return defaults;
}

function isPrimaryKey(fieldName: string, metadata: QTableMetaData): boolean {
  return metadata.primaryKey === fieldName;
}
```

---

### 6.4 RecordView Component

**File:** `/src/components/record/RecordView.tsx`

```typescript
interface RecordViewProps {
  tableName: string;
  recordId: string;
  tableMetadata: QTableMetaData;
}

interface ActionMenuProps {
  record: QRecord;
  tableMetadata: QTableMetaData;
  tableName: string;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canCreate: boolean;
  };
  onDelete: () => void;
}

export const RecordView: React.FC<RecordViewProps> = ({
  tableName,
  recordId,
  tableMetadata
}) => {
  const router = useRouter();
  const { data: record, isLoading, isError, error } = useRecord(tableName, recordId);
  const { canEdit, canDelete, canCreate } = usePermissions(record);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'n': () => router.push(`/app/${tableName}/new`),
    'e': () => canEdit && router.push(`/app/${tableName}/${recordId}/edit`),
    'c': () => router.push(`/app/${tableName}/${recordId}/copy`),
    'd': () => canDelete && setShowDeleteDialog(true),
    'a': () => handleAuditView()
  });

  const handleAuditView = () => {
    // Navigate to audit trail (Package 6)
    router.push(`/app/${tableName}/${recordId}/audit`);
  };

  const handleDelete = async () => {
    try {
      await deleteRecord(tableName, recordId);
      toast.success('Record deleted successfully');
      router.push(`/app/${tableName}`);
    } catch (error) {
      toast.error('Failed to delete record');
    } finally {
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading record</AlertTitle>
        <AlertDescription>{error?.message}</AlertDescription>
        <Button onClick={() => router.refresh()} className="mt-2">
          Retry
        </Button>
      </Alert>
    );
  }

  if (!record) {
    return <NotFoundState />;
  }

  const t1Sections = tableMetadata.sections.filter((s) => s.tier === 'T1' && !s.isHidden);
  const otherSections = tableMetadata.sections.filter((s) => s.tier !== 'T1' && !s.isHidden);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: tableMetadata.label, href: `/app/${tableName}` },
          { label: record.recordLabel, current: true }
        ]}
      />

      {/* Action Menu */}
      <ActionMenu
        record={record}
        tableMetadata={tableMetadata}
        tableName={tableName}
        permissions={{ canEdit, canDelete, canCreate }}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {/* Hero Section (T1) */}
      {t1Sections.length > 0 && (
        <HeroSection
          sections={t1Sections}
          record={record}
          tableMetadata={tableMetadata}
        />
      )}

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {otherSections.map((section) => (
            <ContentSection
              key={section.name}
              section={section}
              record={record}
              tableMetadata={tableMetadata}
            />
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {record.associatedRecords && record.associatedRecords.length > 0 && (
            <AssociatedRecordsDisplay
              associations={record.associatedRecords}
              tableName={tableName}
            />
          )}
        </aside>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        recordLabel={record.recordLabel}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
};

const ActionMenu: React.FC<ActionMenuProps> = ({
  record,
  tableMetadata,
  tableName,
  permissions,
  onDelete
}) => {
  const router = useRouter();
  const recordId = record.values[tableMetadata.primaryKey];

  return (
    <div className="flex gap-2">
      {permissions.canCreate && (
        <Button
          variant="outline"
          onClick={() => router.push(`/app/${tableName}/new`)}
          title="Keyboard: N"
        >
          New
        </Button>
      )}
      {permissions.canEdit && (
        <Button
          variant="outline"
          onClick={() => router.push(`/app/${tableName}/${recordId}/edit`)}
          title="Keyboard: E"
        >
          Edit
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => router.push(`/app/${tableName}/${recordId}/copy`)}
        title="Keyboard: C"
      >
        Copy
      </Button>
      {permissions.canDelete && (
        <Button
          variant="destructive"
          onClick={onDelete}
          title="Keyboard: D"
        >
          Delete
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/app/${tableName}/${recordId}/audit`)}>
            View Audit Trail (A)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyToClipboard(JSON.stringify(record, null, 2))}>
            Copy JSON
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            Share (Coming Soon)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

interface HeroSectionProps {
  sections: QSection[];
  record: QRecord;
  tableMetadata: QTableMetaData;
}

const HeroSection: React.FC<HeroSectionProps> = ({ sections, record, tableMetadata }) => {
  const section = sections[0]; // First T1 section
  const sectionFields = section.fieldNames
    .map((name) => tableMetadata.fields.find((f) => f.name === name))
    .filter((f): f is QFieldMetaData => f !== undefined);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-8">
      <div className="space-y-4">
        {sectionFields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sectionFields.map((field) => (
              <FieldDisplay
                key={field.name}
                field={field}
                value={record.values[field.name]}
                displayValue={record.displayValues?.[field.name]}
                record={record}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ContentSectionProps {
  section: QSection;
  record: QRecord;
  tableMetadata: QTableMetaData;
}

const ContentSection: React.FC<ContentSectionProps> = ({ section, record, tableMetadata }) => {
  const sectionFields = section.fieldNames
    .map((name) => tableMetadata.fields.find((f) => f.name === name))
    .filter((f): f is QFieldMetaData => f !== undefined);

  const gridColsClass = getGridColsClass(section.gridColumns);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {section.iconName && <Icon name={section.iconName} />}
          {section.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-6 ${gridColsClass}`}>
          {sectionFields.map((field) => (
            <FieldDisplay
              key={field.name}
              field={field}
              value={record.values[field.name]}
              displayValue={record.displayValues?.[field.name]}
              record={record}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
```

---

### 6.5 Keyboard Shortcuts Hook

**File:** `/src/lib/hooks/useKeyboardShortcuts.ts`

```typescript
interface KeyboardShortcutsConfig {
  [key: string]: () => void;
}

export const useKeyboardShortcuts = (config: KeyboardShortcutsConfig) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if input is focused
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const handler = config[event.key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config]);
};
```

---

## 7. API Client Functions

### 7.1 Record API Functions

**File:** `/src/lib/api/records.ts`

```typescript
import axios, { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { QRecord, QTableMetaData, QPossibleValue } from '@/types';

// Query Keys
export const recordQueryKeys = {
  all: ['records'] as const,
  byTable: (tableName: string) => [...recordQueryKeys.all, 'table', tableName] as const,
  detail: (tableName: string, recordId: string) => [
    ...recordQueryKeys.byTable(tableName),
    'detail',
    recordId
  ] as const,
  possibleValues: (tableName: string, fieldName: string) => [
    ...recordQueryKeys.byTable(tableName),
    'possibleValues',
    fieldName
  ] as const,
};

// GET /qqq/v1/table/{tableName}/{primaryKey}
interface GetRecordParams {
  tableName: string;
  recordId: string;
  tableVariant?: string;
  includeAssociations?: boolean;
  queryJoins?: string[];
}

export async function getRecord({
  tableName,
  recordId,
  tableVariant,
  includeAssociations = true,
  queryJoins = []
}: GetRecordParams): Promise<QRecord> {
  const params = new URLSearchParams();
  if (tableVariant) params.append('tableVariant', tableVariant);
  if (includeAssociations) params.append('includeAssociations', 'true');
  if (queryJoins.length > 0) params.append('queryJoins', queryJoins.join(','));

  const url = `/qqq/v1/table/${tableName}/${recordId}${params.toString() ? '?' + params.toString() : ''}`;
  const response = await apiClient.get<QRecord>(url);
  return response.data;
}

export const useRecord = (
  tableName: string,
  recordId: string,
  options = {}
) => {
  return useQuery({
    queryKey: recordQueryKeys.detail(tableName, recordId),
    queryFn: () => getRecord({ tableName, recordId }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  });
};

// POST /qqq/v1/table/{tableName}
interface CreateRecordParams {
  tableName: string;
  data: FormData;
}

export async function createRecord({
  tableName,
  data
}: CreateRecordParams): Promise<QRecord> {
  const response = await apiClient.post<QRecord>(
    `/qqq/v1/table/${tableName}`,
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return response.data;
}

export const useCreateRecord = (tableName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) => createRecord({ tableName, data }),
    onSuccess: (data) => {
      // Invalidate table query to refresh list
      queryClient.invalidateQueries({
        queryKey: recordQueryKeys.byTable(tableName)
      });
    },
    onError: (error: AxiosError) => {
      handleApiError(error);
    }
  });
};

// PUT /qqq/v1/table/{tableName}/{primaryKey}
interface UpdateRecordParams {
  tableName: string;
  recordId: string;
  data: FormData;
}

export async function updateRecord({
  tableName,
  recordId,
  data
}: UpdateRecordParams): Promise<QRecord> {
  const response = await apiClient.put<QRecord>(
    `/qqq/v1/table/${tableName}/${recordId}`,
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return response.data;
}

export const useUpdateRecord = (tableName: string, recordId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) => {
      if (!recordId) throw new Error('recordId is required for update');
      return updateRecord({ tableName, recordId, data });
    },
    onSuccess: (data) => {
      // Update cache with new data
      if (recordId) {
        queryClient.setQueryData(
          recordQueryKeys.detail(tableName, recordId),
          data
        );
      }
      // Invalidate table query
      queryClient.invalidateQueries({
        queryKey: recordQueryKeys.byTable(tableName)
      });
    },
    onError: (error: AxiosError) => {
      handleApiError(error);
    }
  });
};

// DELETE /qqq/v1/table/{tableName}/{primaryKey}
interface DeleteRecordParams {
  tableName: string;
  recordId: string;
}

export async function deleteRecord({
  tableName,
  recordId
}: DeleteRecordParams): Promise<{ deletedCount: number }> {
  const response = await apiClient.delete<{ deletedCount: number }>(
    `/qqq/v1/table/${tableName}/${recordId}`
  );
  return response.data;
}

export const useDeleteRecord = (tableName: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteRecord({ tableName, recordId }),
    onSuccess: () => {
      // Invalidate table query
      queryClient.invalidateQueries({
        queryKey: recordQueryKeys.byTable(tableName)
      });
    },
    onError: (error: AxiosError) => {
      handleApiError(error);
    }
  });
};

// POST /qqq/v1/table/{tableName}/possibleValues/{fieldName}
interface GetPossibleValuesParams {
  tableName: string;
  fieldName: string;
  searchTerm?: string;
  ids?: (string | number)[];
  labels?: string[];
  values?: (string | number)[];
  useCase?: string;
}

export async function getPossibleValues({
  tableName,
  fieldName,
  searchTerm,
  ids,
  labels,
  values,
  useCase
}: GetPossibleValuesParams): Promise<QPossibleValue[]> {
  const response = await apiClient.post<QPossibleValue[]>(
    `/qqq/v1/table/${tableName}/possibleValues/${fieldName}`,
    {
      searchTerm,
      ids,
      labels,
      values,
      useCase
    }
  );
  return response.data;
}

export const usePossibleValues = (
  tableName: string,
  fieldName: string,
  searchTerm?: string,
  options = {}
) => {
  return useQuery({
    queryKey: recordQueryKeys.possibleValues(tableName, fieldName),
    queryFn: () =>
      getPossibleValues({
        tableName,
        fieldName,
        searchTerm
      }),
    enabled: !!searchTerm && searchTerm.length > 0,
    staleTime: 5 * 60 * 1000,
    ...options
  });
};

// Error Handler
function handleApiError(error: AxiosError) {
  if (error.response?.status === 401) {
    // Handle unauthorized (already handled by client interceptor)
  } else if (error.response?.status === 400) {
    // Validation error - show field-specific errors
    const data = error.response.data as { errors?: Record<string, string> };
    console.error('Validation errors:', data.errors);
  } else if (error.response?.status === 404) {
    // Record not found
    console.error('Record not found');
  } else if (error.response?.status === 500) {
    // Server error
    console.error('Server error:', error.message);
  }
}
```

---

### 7.2 Form Validation Schema Builder

**File:** `/src/lib/forms/schema-builder.ts`

```typescript
import { z } from 'zod';
import { QTableMetaData, QFieldMetaData, QFieldType } from '@/types';

export interface ValidationRules {
  required: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  regex?: RegExp;
}

export function buildFormSchema(
  tableMetadata: QTableMetaData,
  excludeFields: string[] = []
): z.ZodSchema {
  const fieldSchemas: Record<string, z.ZodTypeAny> = {};

  tableMetadata.fields.forEach((field) => {
    if (excludeFields.includes(field.name)) return;

    const schema = buildFieldSchema(field);
    fieldSchemas[field.name] = schema;
  });

  return z.object(fieldSchemas);
}

export function buildFieldSchema(field: QFieldMetaData): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case 'STRING':
      schema = z.string().default('');
      if (field.maxLength) {
        schema = schema.max(field.maxLength, {
          message: `Maximum ${field.maxLength} characters`
        });
      }
      break;

    case 'INTEGER':
    case 'LONG':
      schema = z.union([z.number().int(), z.string()]).pipe(z.coerce.number().int());
      break;

    case 'DECIMAL':
      schema = z.union([z.number(), z.string()]).pipe(z.coerce.number());
      break;

    case 'BOOLEAN':
      schema = z.union([z.boolean(), z.null()]).default(null);
      break;

    case 'DATE':
      schema = z.union([z.date(), z.string().datetime()]).pipe(z.coerce.date()).nullable();
      break;

    case 'TIME':
      schema = z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Invalid time format (HH:MM:SS)').nullable();
      break;

    case 'DATE_TIME':
      schema = z.union([z.date(), z.string().datetime()]).pipe(z.coerce.date()).nullable();
      break;

    case 'TEXT':
      schema = z.string().default('');
      if (field.maxLength) {
        schema = schema.max(field.maxLength);
      }
      break;

    case 'HTML':
      schema = z.string().default('');
      break;

    case 'PASSWORD':
      schema = z.string().default('');
      if (field.maxLength) {
        schema = schema.max(field.maxLength);
      }
      break;

    case 'BLOB':
      schema = z.union([
        z.instanceof(File),
        z.array(z.instanceof(File)),
        z.null()
      ]).nullable();
      break;

    default:
      schema = z.any();
  }

  // Apply required constraint
  if (!field.isRequired && !['BOOLEAN'].includes(field.type)) {
    schema = schema.nullable();
  } else if (field.isRequired && !['BOOLEAN'].includes(field.type)) {
    schema = schema.refine((val) => val !== null && val !== undefined && val !== '', {
      message: `${field.label} is required`
    });
  }

  return schema;
}

// Helper to extract validation rules from field metadata
export function getValidationRules(field: QFieldMetaData): ValidationRules {
  const rules: ValidationRules = {
    required: field.isRequired
  };

  if (field.maxLength) {
    rules.maxLength = field.maxLength;
  }

  // Add type-specific rules
  switch (field.type) {
    case 'INTEGER':
    case 'LONG':
      // Could add min/max from metadata if available
      break;
    case 'DECIMAL':
      // Could add min/max and precision from metadata
      break;
  }

  return rules;
}
```

---

## 8. Testing Requirements

### Unit Tests

1. **FieldDisplay Component** (10 tests)
   - Render each field type correctly
   - Render each adornment type correctly
   - Handle null/undefined values
   - Format dates, numbers correctly
   - Sanitize HTML rendering

2. **DynamicFormField Component** (15 tests)
   - Render each input type correctly
   - Validate required fields
   - Validate maxLength constraint
   - Handle file uploads
   - Handle possibleValues autocomplete with debounce

3. **EntityForm Component** (12 tests)
   - Build correct FormData from form values
   - Handle create submission
   - Handle update submission
   - Handle delete submission
   - Warn on unsaved changes
   - Handle form validation errors
   - Display success/error messages

4. **RecordView Component** (10 tests)
   - Load and display record data
   - Render T1 and non-T1 sections
   - Display associated records
   - Trigger action menu items
   - Handle keyboard shortcuts

5. **Schema Builder** (8 tests)
   - Build schema for each field type
   - Apply required constraint
   - Apply maxLength constraint
   - Validate correct data types
   - Reject invalid data

6. **API Functions** (10 tests)
   - getRecord success and error
   - createRecord success and error
   - updateRecord success and error
   - deleteRecord success and error
   - getPossibleValues success and error

### Integration Tests

1. **Create Record Flow** (3 tests)
   - Navigate to create page
   - Fill form and submit
   - Verify record created and redirected

2. **Edit Record Flow** (3 tests)
   - Load existing record
   - Edit field values
   - Save and verify update
   - Verify changes persisted

3. **Copy Record Flow** (2 tests)
   - Load existing record
   - Copy to new record
   - Verify primary key cleared
   - Verify other fields copied

4. **Delete Record Flow** (2 tests)
   - Display confirmation dialog
   - Confirm delete
   - Verify record deleted
   - Verify redirect to list

### E2E Tests (Cypress/Playwright)

1. Create → Edit → Delete workflow
2. Copy record workflow
3. File upload and download
4. Keyboard shortcuts
5. Form validation errors
6. Autocomplete search and selection
7. Responsive layout on mobile

### Test Coverage Goals

- Statements: 90%+
- Branches: 85%+
- Functions: 90%+
- Lines: 90%+

---

## 9. Acceptance Criteria

### Record View Display

- [ ] Record view page loads and displays record data for valid tableName and recordId
- [ ] T1 sections display in hero area with larger typography and colored background
- [ ] Non-T1 sections display below as cards in grid layout
- [ ] Section icons render if iconName present
- [ ] Section labels render correctly
- [ ] Fields within sections render in correct order from fieldNames
- [ ] gridColumns metadata applied to field layout (1, 2, 3, or 4 columns)
- [ ] Field values display with correct formatting per type (dates, numbers, etc.)
- [ ] Field display values show if different from values
- [ ] Help content displays as tooltips on field labels
- [ ] Associated records display in sidebar or tabs with counts
- [ ] Breadcrumbs show table name and record label
- [ ] Loading state displays spinner while fetching record
- [ ] Error state displays message and retry button on fetch failure
- [ ] 404 state displays when record does not exist

### Field Display Types

- [ ] STRING fields render as text with LINK adornment support
- [ ] INTEGER/LONG fields render with thousands separator
- [ ] DECIMAL fields render with 2 decimal places
- [ ] BOOLEAN fields render as yes/no badge
- [ ] DATE fields render as MM/DD/YYYY format
- [ ] TIME fields render as HH:MM:SS format
- [ ] DATE_TIME fields render with date and time
- [ ] TEXT fields render with preserved line breaks
- [ ] HTML fields render sanitized HTML content
- [ ] PASSWORD fields render as asterisks with reveal toggle
- [ ] BLOB fields render file download button with filename

### Field Display Adornments

- [ ] LINK adornment creates clickable links to href
- [ ] CHIP adornment renders field as badge
- [ ] SIZE adornment formats file sizes (B, KB, MB, GB)
- [ ] ERROR adornment shows red border and error icon
- [ ] RENDER_HTML adornment sanitizes and renders HTML
- [ ] REVEAL adornment shows password toggle button
- [ ] CODE_EDITOR adornment shows syntax-highlighted code block
- [ ] FILE_DOWNLOAD adornment creates download button
- [ ] TOOLTIP adornment shows hover text
- [ ] Multiple adornments on same field render correctly

### Action Menu

- [ ] New button navigates to create page
- [ ] Edit button navigates to edit page (hidden if !editPermission)
- [ ] Copy button navigates to copy page
- [ ] Delete button opens confirmation dialog (hidden if !deletePermission)
- [ ] More menu displays audit trail and copy JSON options
- [ ] Audit trail link navigates to audit view

### Keyboard Shortcuts

- [ ] N key navigates to new page
- [ ] E key navigates to edit page (if canEdit)
- [ ] C key navigates to copy page
- [ ] D key opens delete confirmation (if canDelete)
- [ ] A key opens audit trail view
- [ ] Shortcuts ignored when input is focused
- [ ] Shortcuts work consistently across browsers

### Create Form

- [ ] Form displays all sections in order from metadata
- [ ] Section labels and icons render
- [ ] Section fields render in gridColumns layout
- [ ] All 12 field types render appropriate inputs
- [ ] Required fields marked with asterisk
- [ ] Help text displays below field labels
- [ ] Field defaults apply from metadata
- [ ] Form validates on submit per Zod schema
- [ ] Validation errors display below fields
- [ ] Submit button disabled until form valid
- [ ] Cancel button navigates back
- [ ] Form submission creates record via POST API
- [ ] Success message displays on completion
- [ ] Redirects to record view with new record ID

### Edit Form

- [ ] Form loads and displays existing record values
- [ ] All field values pre-populate correctly
- [ ] Primary key field read-only or hidden
- [ ] Form validates changes per Zod schema
- [ ] Submit button labeled "Update"
- [ ] Form submission updates record via PUT API
- [ ] Only changed fields sent to server
- [ ] Success message displays on completion
- [ ] Redirects to record view after update
- [ ] Unsaved changes warning on navigation away

### Copy Form

- [ ] Form loads existing record values
- [ ] Primary key field cleared/hidden
- [ ] All other fields pre-populate
- [ ] Form submission creates new record via POST
- [ ] New record ID assigned by server
- [ ] Title shows "Copy of {recordLabel}"
- [ ] Success message displays on completion
- [ ] Redirects to new record view

### Form Validation

- [ ] Required STRING fields reject empty values
- [ ] STRING fields enforce maxLength constraint
- [ ] INTEGER fields reject non-numeric input
- [ ] DECIMAL fields accept decimal numbers
- [ ] DATE fields validate date format
- [ ] TIME fields validate HH:MM:SS format
- [ ] Email fields (if applicable) validate email format
- [ ] URL fields (if applicable) validate URL format
- [ ] Custom validators apply per field metadata
- [ ] Validation errors display specific messages
- [ ] Form prevents submission while invalid

### Possible Values Autocomplete

- [ ] Input field displays for fields with possibleValueSourceName
- [ ] Typing triggers debounced search (300ms)
- [ ] Search calls POST /possibleValues/{fieldName} API
- [ ] Results display in dropdown list
- [ ] Results show label and optional icon
- [ ] Clicking result selects value
- [ ] Search results cached to avoid duplicates
- [ ] Loading spinner displays during search
- [ ] Empty state message shows "No results"
- [ ] Clear button removes selection

### File Upload

- [ ] File input displays for BLOB fields
- [ ] Drag-and-drop area accepts files
- [ ] File selection input opens file picker
- [ ] Selected files show preview or icon
- [ ] File size displays for each file
- [ ] Remove button deletes selected file
- [ ] Multiple files upload (if metadata allows)
- [ ] File size validation enforces limits
- [ ] File type validation per metadata accept types
- [ ] Files included in FormData on form submit

### Boolean Fields

- [ ] Boolean switch displays three states: null/false/true
- [ ] Clicking cycles through states
- [ ] Null state shows neutral styling
- [ ] False state shows off/unchecked styling
- [ ] True state shows on/checked styling
- [ ] Tri-state support for optional boolean fields

### Date/Time Pickers

- [ ] Date picker shows calendar on focus
- [ ] Calendar allows clicking to select date
- [ ] Keyboard navigation works in calendar
- [ ] Time picker shows HH:MM:SS input
- [ ] DateTime picker combines date + time
- [ ] Invalid dates rejected
- [ ] Min/max date constraints enforced

### Rich Text Editor

- [ ] HTML field displays rich text editor
- [ ] Toolbar shows formatting options
- [ ] Bold, italic, underline formatting works
- [ ] Heading levels 1-6 available
- [ ] Bullet and numbered lists work
- [ ] Links can be inserted
- [ ] HTML rendered on save
- [ ] Full-screen editing available

### Permissions

- [ ] Edit button hidden if !editPermission
- [ ] Edit page inaccessible if !editPermission
- [ ] Delete button hidden if !deletePermission
- [ ] Delete action blocked if !deletePermission
- [ ] Create button hidden if !insertPermission
- [ ] Create page inaccessible if !insertPermission
- [ ] Copy allowed regardless of editPermission
- [ ] Permission check based on record metadata

### Delete Confirmation

- [ ] Delete button opens confirmation dialog
- [ ] Dialog shows record label being deleted
- [ ] Dialog shows associated records warning if relevant
- [ ] Cancel button closes dialog
- [ ] Confirm button executes DELETE API
- [ ] Loading state displays during deletion
- [ ] Success message shows on completion
- [ ] Redirects to record list after deletion
- [ ] Error message shows on failure with retry

### Unsaved Changes Warning

- [ ] Dirty tracking enabled on form
- [ ] Warning displays on page navigation away
- [ ] Warning displays on browser back/refresh
- [ ] Warning only shows if form is dirty
- [ ] Submit button disabled until dirty or form changes
- [ ] Cancel navigates away without warning

### Error Handling

- [ ] 401 Unauthorized redirects to login
- [ ] 400 Bad Request shows validation errors
- [ ] 404 Not Found shows friendly message
- [ ] 500 Server Error shows generic error message
- [ ] Network timeout shows retry button
- [ ] API errors logged to console
- [ ] User-facing errors distinct from server errors

### Responsive Design

- [ ] Form layout responsive on mobile (single column)
- [ ] Form layout responsive on tablet (2-3 columns)
- [ ] Form layout responsive on desktop (4+ columns)
- [ ] Record view single column on mobile
- [ ] Associated records sidebar hidden on mobile
- [ ] Action menu collapses to overflow menu on mobile
- [ ] File upload drag-and-drop works on touch devices
- [ ] Datepicker accessible on mobile
- [ ] Tooltips display accessibly on mobile

### Accessibility

- [ ] All form fields have associated labels
- [ ] Form inputs semantic HTML (input, textarea, select)
- [ ] Error messages linked to fields with aria-describedby
- [ ] Required fields marked with aria-required
- [ ] Disabled fields marked with aria-disabled
- [ ] Loading states announced with aria-live
- [ ] Keyboard navigation works throughout
- [ ] Focus visible indicators on all interactive elements
- [ ] Color not sole means of conveying information
- [ ] Alt text on file/image elements

---

## Summary

This work package delivers complete record view and CRUD capabilities for the QQQ Admin UI modernization. The modular component design supports all 12 field types and all adornment variants, with robust validation, error handling, and permission gating. By following this plan, the team will deliver a production-ready record management system that leverages metadata-driven architecture while maintaining high code quality and comprehensive test coverage.

**Estimated Effort:** 6 weeks with 2-3 engineers
**Key Risks:** File upload handling, form validation complexity, responsive design across field types
**Dependencies:** Package 1 completion, clear API contracts from backend
**Success Metrics:** 95%+ test coverage, zero security vulnerabilities, performance metrics <2s load time on record view
