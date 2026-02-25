# Work Package 4: Process Execution

## 1. Prerequisites

### 1.1 Imports from Package 1

```typescript
// From @/types/api-types.ts
import type {
  QRecord,
  QFieldMetaData,
  QFieldType,
  QFieldWidget,
  QPossibleValue,
} from '@/types/api-types'

// From @/lib/api-client.ts
import { apiClient } from '@/lib/api-client'

// From @/hooks/useQContext.ts
import { useQContext } from '@/hooks/useQContext'

// From @/hooks/useAuth.ts
import { useAuth } from '@/hooks/useAuth'

// From @/app/providers.tsx
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
```

### 1.2 Imports from Package 3

```typescript
// From @/components/forms/EntityForm.tsx
import { EntityForm } from '@/components/forms/EntityForm'

// From @/components/forms/DynamicFormField.tsx
import { DynamicFormField } from '@/components/forms/DynamicFormField'

// From @/components/forms/FieldDisplay.tsx
import { FieldDisplay } from '@/components/forms/FieldDisplay'

// From @/lib/form-validation.ts
import { createZodSchemaFromMetadata } from '@/lib/form-validation'

// From @/hooks/usePossibleValues.ts
import { usePossibleValues } from '@/hooks/usePossibleValues'

// From @/hooks/useFileUpload.ts
import { useFileUpload } from '@/hooks/useFileUpload'
```

### 1.3 External Dependencies

```typescript
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

// shadcn/ui
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loading } from '@/components/ui/loading'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Icons
import { AlertCircle, CheckCircle2, XCircle, Download, Pause } from 'lucide-react'
```

---

## 2. Requirements Traceability

### 2.1 Specification Sections

| Section | Requirement | Package 4 Responsibility |
|---------|-------------|---------------------------|
| 5.2.4 | Process Routes | Implement `/app/[processName]/page.tsx` standalone and embed in Record Query table context |
| 5.3.4 | Process Components | Render 14 component types from QFrontendStepMetaData.components |
| 3.5 | Process Endpoints | Implement client wrapper functions for 6 process endpoints (init, step, status, records, cancel, metadata) |
| 3.7 | Possible Values | Leverage Package 3's usePossibleValues hook for field autocomplete in process forms |

### 2.2 Key Requirements Mapping

```
Requirement ID | Requirement | Implementation Component
R4.1           | Process run page at /app/[processName] | ProcessRunPage
R4.2           | Table-scoped process execution | ProcessRunModal
R4.3           | Step wizard with linear flow | ProcessStepper
R4.4           | Support all 14 component types | StepComponentRenderer + 14 type components
R4.5           | Async job polling with exponential backoff | useProcessJobPolling hook
R4.6           | File upload on init and step | useProcessFileUpload hook
R4.7           | ProcessMetaDataAdjustment handling | ProcessRunState manager
R4.8           | Record selection: recordIds and filterJSON | ProcessInitForm
R4.9           | Process results summary | ProcessResultsSummary
R4.10          | Paginated record viewing | ProcessRecordsTable
```

---

## 3. Shared Context Files Required

### 3.1 TypeScript Types (Extend Package 1)

**File:** `/src/types/process-types.ts`

```typescript
/**
 * Process execution types - extends API types with frontend state
 */

// ============================================================================
// PROCESS METADATA
// ============================================================================

export interface QFrontendStepComponent {
  type: ProcessComponentType
  values?: QPossibleValue[] // For select/radio components
  helpContents?: string
  [key: string]: unknown
}

export type ProcessComponentType =
  | 'HELP_TEXT'
  | 'BULK_EDIT_FORM'
  | 'BULK_LOAD_FILE_MAPPING_FORM'
  | 'BULK_LOAD_VALUE_MAPPING_FORM'
  | 'BULK_LOAD_PROFILE_FORM'
  | 'VALIDATION_REVIEW_SCREEN'
  | 'EDIT_FORM'
  | 'VIEW_FORM'
  | 'DOWNLOAD_FORM'
  | 'RECORD_LIST'
  | 'PROCESS_SUMMARY_RESULTS'
  | 'GOOGLE_DRIVE_SELECT_FOLDER'
  | 'WIDGET'
  | 'HTML'

export interface QFrontendStepMetaData {
  name: string
  label: string
  format?: 'screen' | 'modal' // UI presentation hint
  components: QFrontendStepComponent[]
  formFields: QFieldMetaData[] // For EDIT_FORM, BULK_EDIT_FORM
  viewFields: QFieldMetaData[] // For VIEW_FORM
  recordListFields: QFieldMetaData[] // For RECORD_LIST
  helpContents?: string
}

export interface QProcessMetaData {
  name: string
  label: string
  tableName: string
  isHidden: boolean
  iconName: string
  hasPermission: boolean
  stepFlow: 'LINEAR' // Extensible for future flows
  minInputRecords?: number
  maxInputRecords?: number
  frontendSteps: QFrontendStepMetaData[]
}

export interface ProcessMetaDataAdjustment {
  updatedFrontendStepList?: QFrontendStepMetaData[]
  updatedFields?: Record<string, QFieldMetaData>
}

// ============================================================================
// JOB RESPONSES
// ============================================================================

export interface QJobStarted {
  processUUID: string
  jobUUID: string
}

export interface QJobRunning {
  processUUID: string
  message: string
  current?: number
  total?: number
}

export interface QJobComplete {
  processUUID: string
  values?: Record<string, unknown> // Form values for next step
  nextStep?: string
  backStep?: string
  processMetaDataAdjustment?: ProcessMetaDataAdjustment
  results?: {
    totalRecords?: number
    createdRecords?: number
    updatedRecords?: number
    skippedRecords?: number
    errorRecords?: number
    downloadLinks?: Array<{ label: string; href: string }>
  }
}

export interface QJobError {
  processUUID: string
  error: string
  userFacingError?: string
  validationErrors?: Array<{
    field?: string
    message: string
  }>
}

export type JobResponse = QJobStarted | QJobRunning | QJobComplete | QJobError

export function isJobStarted(response: JobResponse): response is QJobStarted {
  return 'jobUUID' in response && !('message' in response)
}

export function isJobRunning(response: JobResponse): response is QJobRunning {
  return 'message' in response && !('values' in response)
}

export function isJobComplete(response: JobResponse): response is QJobComplete {
  return 'nextStep' in response || 'backStep' in response || 'results' in response
}

export function isJobError(response: JobResponse): response is QJobError {
  return 'error' in response && !('jobUUID' in response)
}

// ============================================================================
// PROCESS EXECUTION STATE
// ============================================================================

export interface ProcessRunState {
  processName: string
  processMetadata: QProcessMetaData | null

  // Navigation
  currentStepIndex: number
  currentStepName: string | null

  // Process instance
  processUUID: string | null
  jobUUID: string | null

  // Job polling
  isPolling: boolean
  pollError: string | null
  pollMessage?: string
  pollProgress?: { current?: number; total?: number }

  // Input parameters
  recordsParam?: 'recordIds' | 'filterJSON'
  recordIds?: string[]
  filterJSON?: Record<string, unknown>
  stepTimeoutMillis?: number

  // Form data accumulation
  accumulatedFormValues: Record<string, unknown>

  // File uploads
  pendingFile: File | null
  uploadProgress?: number

  // Meta data adjustments
  adjustedMetadata?: ProcessMetaDataAdjustment

  // Results
  results?: QJobComplete['results']

  // Errors
  error: string | null
  userFacingError: string | null
  validationErrors: Array<{ field?: string; message: string }>

  // UI state
  isLoading: boolean
  isSubmitting: boolean
  canGoBack: boolean
}

export interface ProcessStepComponentProps {
  stepMetadata: QFrontendStepMetaData
  componentMetadata: QFrontendStepComponent
  formValues: Record<string, unknown>
  isReadOnly?: boolean
  onValuesChange?: (values: Record<string, unknown>) => void
  isLoading?: boolean
  processName: string
  processUUID: string | null
}

// ============================================================================
// PROCESS INPUT FORMS
// ============================================================================

export interface ProcessInitFormValues {
  recordsParam?: 'recordIds' | 'filterJSON'
  recordIds?: string[]
  filterJSON?: Record<string, unknown>
  stepTimeoutMillis?: number
  file?: File
  [key: string]: unknown // Additional form fields
}

export interface ProcessStepFormValues {
  stepTimeoutMillis?: number
  file?: File
  [key: string]: unknown // Step-specific fields
}

// ============================================================================
// PROCESS RESULTS
// ============================================================================

export interface ProcessRecordsResponse {
  totalRecords: number
  records: QRecord[]
}

export interface ProcessResultsSummary {
  totalRecords?: number
  createdRecords?: number
  updatedRecords?: number
  skippedRecords?: number
  errorRecords?: number
  downloadLinks?: Array<{ label: string; href: string }>
  validationErrors?: Array<{ field?: string; message: string }>
}
```

### 3.2 API Client Extensions

**File:** `/src/lib/api-client-process.ts`

This file is created as a separate module to keep process API concerns isolated, imported by ProcessRunPage and ProcessRunModal.

---

## 4. Scope: In and Out

### 4.1 In Scope

- **Process Run Page**: Standalone page at `/app/[processName]/page.tsx`
- **Process Run Modal**: Embedded in Record Query/Record View context for table-scoped execution
- **Step Wizard UI**: Linear stepper with forward/back navigation, progress indicator
- **14 Component Types**: Full rendering support for all step component types
- **Async Job Polling**: Exponential backoff (1.5s init, 1.5x multiplier, 12s cap)
- **File Upload**: Multipart/form-data on both init and step submissions
- **Record Selection**: recordIds and filterJSON input modes
- **ProcessMetaDataAdjustment**: Dynamic step/field modification mid-process
- **Results Summary**: Record counts, error lists, download links
- **Process Records Viewing**: Paginated record list from completed process
- **Process Cancellation**: Cancel in-flight or queued processes
- **Form Reuse**: EntityForm, DynamicFormField, FieldDisplay from Package 3
- **Bulk Load Workflows**: File → column mapping → value mapping → profile → validation → execute
- **Validation Review**: Pre-commit review screen with warnings/errors, accept/reject

### 4.2 Out of Scope

- **Record Query Grid**: Implementation in Package 2
- **Record View/CRUD**: Implementation in Package 3
- **Dashboard Widgets**: Implementation in Package 5
- **Storybook Stories**: Implementation in Package 6
- **E2E Tests**: Implementation in Package 6
- **Google Drive Integration**: Stub component, integration deferred
- **Custom Widget Components**: Stub, delegated to Package 5
- **Non-LINEAR Step Flows**: Future enhancement

---

## 5. Detailed Implementation Steps

### Step 1: Create Process API Client Module

**File:** `/src/lib/api-client-process.ts`

Create comprehensive API client functions for all process endpoints with proper error handling, query key factories, and TypeScript typing.

**Tasks:**
1. Implement `getProcessMetadata(processName: string)` with React Query integration
2. Implement `initProcess(processName, values, file, recordIds/filterJSON)` with multipart/form-data
3. Implement `submitProcessStep(processName, processUUID, stepName, values, file)` with multipart/form-data
4. Implement `pollProcessStatus(processName, processUUID, jobUUID)` with polling support
5. Implement `getProcessRecords(processName, processUUID, skip, limit)` with pagination
6. Implement `cancelProcess(processName, processUUID)` with mutation support
7. Create query key factory: `processQueryKeys`
8. Export all functions from `/src/lib/index.ts`

**Error Handling:**
- Catch network errors and timeout errors
- Preserve backend error messages and validation errors
- Map errors to user-facing messages where appropriate

---

### Step 2: Create Custom Hooks for Process State Management

**File:** `/src/hooks/useProcessRunState.ts`

Implement centralized state management hook for process execution flow.

**Tasks:**
1. Initialize state with default ProcessRunState
2. Implement reducer for state transitions: init, startJob, pollUpdate, completeStep, stepBack, error, reset
3. Implement side effects for metadata adjustments
4. Implement form value accumulation across steps
5. Export interface for consumers

**Key Reducer Actions:**
```typescript
type ProcessAction =
  | { type: 'INIT'; payload: { processMetadata: QProcessMetaData } }
  | { type: 'START_JOB'; payload: { processUUID: string; jobUUID: string } }
  | { type: 'POLL_UPDATE'; payload: Partial<ProcessRunState> }
  | { type: 'JOB_COMPLETE'; payload: QJobComplete }
  | { type: 'ADVANCE_STEP'; payload: { stepIndex: number; stepName: string; formValues: Record<string, unknown> } }
  | { type: 'STEP_BACK'; payload: { stepIndex: number; stepName: string } }
  | { type: 'JOB_ERROR'; payload: QJobError }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' }
```

---

### Step 3: Create Job Polling Hook with Exponential Backoff

**File:** `/src/hooks/useProcessJobPolling.ts`

Implement polling hook with exponential backoff algorithm and automatic stop conditions.

**Tasks:**
1. Implement exponential backoff: initial 1.5s, multiplier 1.5x, max 12s cap
2. Implement polling loop with useEffect and useRef for cleanup
3. Implement stop conditions: complete, error, cancellation
4. Implement progress updates from QJobRunning messages
5. Export hook for ProcessStepper

**Signature:**
```typescript
export function useProcessJobPolling(
  processName: string,
  processUUID: string | null,
  jobUUID: string | null,
  onStatusUpdate: (response: JobResponse) => void,
  enabled?: boolean
): { isPolling: boolean; error: string | null }
```

---

### Step 4: Create File Upload Hook

**File:** `/src/hooks/useProcessFileUpload.ts`

Implement file upload hook with multipart/form-data handling and progress tracking.

**Tasks:**
1. Implement file validation (size, type)
2. Implement multipart/form-data construction
3. Implement progress tracking
4. Implement error handling
5. Export hook for ProcessStepper and StepComponentRenderer

**Signature:**
```typescript
export function useProcessFileUpload(
  processName: string,
  processUUID: string | null,
  stepName: string | null
): {
  uploadFile: (file: File, values: Record<string, unknown>) => Promise<JobResponse>
  isUploading: boolean
  progress: number
  error: string | null
}
```

---

### Step 5: Create Step Component Renderer

**File:** `/src/components/process/StepComponentRenderer.tsx`

Implement router component that renders appropriate UI based on component type.

**Tasks:**
1. Create factory function that dispatches to component type handlers
2. Support all 14 component types with proper routing
3. Pass down required props to each handler component
4. Implement error boundary for component errors
5. Export component for ProcessStepper

**Component Signature:**
```typescript
export function StepComponentRenderer({
  component: QFrontendStepComponent
  stepMetadata: QFrontendStepMetaData
  formValues: Record<string, unknown>
  onValuesChange: (values: Record<string, unknown>) => void
  isLoading?: boolean
  processName: string
  processUUID: string | null
}: ProcessStepComponentProps): React.ReactNode
```

---

### Step 6: Implement 14 Step Component Types

Create individual component files for each step type in `/src/components/process/step-components/`:

#### 6.1 HelpTextComponent.tsx
- Display read-only help/instructions text
- Support rich text rendering (HTML safe)
- Use Alert component for visual emphasis

#### 6.2 BulkEditFormComponent.tsx
- Render EntityForm from Package 3 with bulk field editing
- Support multiple field modifications
- Accumulate form values for submission

#### 6.3 BulkLoadFileMappingFormComponent.tsx
- CSV file upload with preview
- Column-to-field mapping UI (drag-drop or select)
- Show header row and sample data
- Preserve mapping in form values

#### 6.4 BulkLoadValueMappingFormComponent.tsx
- Mapping table: source value → target value
- Support add/remove mapping rows
- Validate source/target uniqueness
- Export mapping JSON for step submission

#### 6.5 BulkLoadProfileFormComponent.tsx
- Save current mapping as named profile
- Load saved profiles from list
- Delete profiles
- List profiles with created timestamp

#### 6.6 ValidationReviewScreenComponent.tsx
- Display pre-commit review with warnings/errors list
- Support accept/reject buttons
- Show error details with field context
- Prevent advance on reject

#### 6.7 EditFormComponent.tsx
- Render EntityForm from Package 3
- Load initial values from formValues prop
- Support all field types via DynamicFormField
- Include form validation via react-hook-form + Zod

#### 6.8 ViewFormComponent.tsx
- Render read-only form via FieldDisplay from Package 3
- Display field values without edit capability
- Support nested object/array display

#### 6.9 DownloadFormComponent.tsx
- Render download links/buttons from results
- Support file preview
- Track download analytics (optional)

#### 6.10 RecordListComponent.tsx
- Paginated record list from process results
- Render fields specified in recordListFields
- Support skip/limit pagination
- Show total record count

#### 6.11 ProcessSummaryResultsComponent.tsx
- Display results counts: created, updated, skipped, errors
- Show error details if present
- Display download links
- Summary dashboard view

#### 6.12 GoogleDriveSelectFolderComponent.tsx
- Stub component for now
- Placeholder UI indicating feature not yet available
- TODO comment for Package 5 integration

#### 6.13 WidgetComponent.tsx
- Stub component for custom widgets
- Delegate rendering to Package 5
- Pass through widget metadata

#### 6.14 HtmlComponent.tsx
- Safe HTML rendering (sanitize input)
- Support dynamic content from formValues
- Use dangerouslySetInnerHTML with DOMPurify

---

### Step 7: Implement ProcessStepper Component

**File:** `/src/components/process/ProcessStepper.tsx`

Main orchestrator component for step wizard UI and navigation.

**Tasks:**
1. Initialize process state via useProcessRunState
2. Render Stepper UI from shadcn/ui with step indicator
3. Render current step components via StepComponentRenderer
4. Implement forward/back navigation handlers
5. Implement form submission logic (init on step 0, step endpoint on subsequent steps)
6. Integrate job polling via useProcessJobPolling
7. Handle ProcessMetaDataAdjustment updates
8. Render error/success alerts
9. Implement loading states and spinners
10. Export component

**Key Methods:**
```typescript
const handleAdvanceStep = async (stepFormValues: Record<string, unknown>) => {
  // 1. Accumulate form values
  // 2. Call init endpoint (step 0) or step endpoint (subsequent steps)
  // 3. If QJobStarted: start polling
  // 4. If QJobComplete: accumulate results, advance to nextStep or show results
  // 5. If QJobError: display error, stay on current step
}

const handleStepBack = async () => {
  // 1. If backStep in metadata: navigate to backStep
  // 2. Otherwise: go to previous step index
}
```

---

### Step 8: Implement ProcessRunPage

**File:** `/src/app/(dashboard)/app/[processName]/page.tsx`

Standalone process page that users navigate to directly.

**Tasks:**
1. Extract processName from route params
2. Fetch process metadata via getProcessMetadata
3. Render ProcessStepper with metadata
4. Support recordIds and filterJSON via URL search params
5. Implement breadcrumb navigation (Home > Processes > {processName})
6. Handle permission checks (redirect to 403 if no permission)
7. Implement page layout with sidebar navigation
8. Export as async component (Server Component with dynamic import of Stepper)

**Route Parameters:**
- `processName`: Dynamic route segment
- Search params: `?recordIds=id1,id2` or `?filterJSON={...}`

---

### Step 9: Implement ProcessRunModal

**File:** `/src/components/process/ProcessRunModal.tsx`

Embedded modal component for table-scoped process execution.

**Tasks:**
1. Accept isOpen, onClose props
2. Extract processName, recordIds, filterJSON from context or props
3. Render Modal Dialog from shadcn/ui
4. Embed ProcessStepper inside modal
5. Implement close on cancel/completion
6. Handle mobile responsiveness (fullscreen on mobile)

**Usage in Record Query:**
```typescript
const [processRunOpen, setProcessRunOpen] = useState(false)
const [selectedProcessName, setSelectedProcessName] = useState<string | null>(null)
const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])

return (
  <>
    <Button onClick={() => { setSelectedProcessName('bulkUpdate'); setProcessRunOpen(true) }}>
      Run Process
    </Button>
    <ProcessRunModal
      isOpen={processRunOpen}
      onClose={() => setProcessRunOpen(false)}
      processName={selectedProcessName}
      recordIds={selectedRecordIds}
    />
  </>
)
```

---

### Step 10: Implement ProcessRecordsTable Component

**File:** `/src/components/process/ProcessRecordsTable.tsx`

Paginated table display for process result records.

**Tasks:**
1. Accept processName, processUUID, recordListFields props
2. Implement pagination: skip/limit controls
3. Fetch records via getProcessRecords with pagination
4. Render Table from shadcn/ui with dynamic columns
5. Display FieldDisplay for each cell value
6. Handle loading and error states
7. Support record count and page indicators
8. Export component

**Signature:**
```typescript
export function ProcessRecordsTable({
  processName: string
  processUUID: string
  recordListFields: QFieldMetaData[]
}: ProcessRecordsTableProps): React.ReactNode
```

---

### Step 11: Implement ProcessResultsSummary Component

**File:** `/src/components/process/ProcessResultsSummary.tsx`

Results dashboard showing counts, errors, and downloads.

**Tasks:**
1. Accept results from process completion
2. Render summary counts: created, updated, skipped, errors
3. Show error list with field context if present
4. Render download links from results.downloadLinks
5. Support collapsible error details
6. Render ProcessRecordsTable if records available
7. Export component

---

### Step 12: Implement ProcessInitForm Component

**File:** `/src/components/process/ProcessInitForm.tsx`

Optional initial form for process input parameters (recordIds, filterJSON, file).

**Tasks:**
1. Accept onSubmit callback
2. Support manual recordIds entry (text input or picker)
3. Support filterJSON visualization (JSON editor or filter builder)
4. Support file upload for processes that require it
5. Validate input before submission
6. Export component

---

### Step 13: Create Process Query Hook

**File:** `/src/hooks/useProcessQuery.ts`

Convenience hook for fetching process metadata and managing query state.

**Tasks:**
1. Accept processName parameter
2. Call getProcessMetadata internally
3. Expose loading, error, data, refetch
4. Implement error boundary handling
5. Export hook

**Signature:**
```typescript
export function useProcessQuery(processName: string) {
  return useQuery({
    queryKey: processQueryKeys.metadata(processName),
    queryFn: () => getProcessMetadata(processName),
  })
}
```

---

### Step 14: Update Layout and Navigation

**File:** `/src/app/(dashboard)/app/layout.tsx` and process list integration

**Tasks:**
1. Add process list to sidebar navigation (if applicable)
2. Render process icons from metadata
3. Link to `/app/[processName]` routes
4. Hide hidden processes based on isHidden flag
5. Support permission-based visibility

---

### Step 15: Implement Error Handling and User Feedback

**Tasks:**
1. Create ErrorBoundary component for process pages
2. Implement toast notifications for errors
3. Implement validation error display with field context
4. Support user-facing error messages from backend
5. Implement retry logic for failed jobs

---

### Step 16: Testing Setup and Documentation

**Tasks:**
1. Create test stubs for all components
2. Document component prop interfaces in JSDoc
3. Document API client functions and error scenarios
4. Create example process execution flows in comments
5. Document ProcessMetaDataAdjustment handling

---

## 6. Component Specifications

### 6.1 Process Type Definitions

**File:** `/src/types/process-types.ts` (Full Reference)

```typescript
/**
 * Complete type definitions for process execution
 * This is the single source of truth for all process-related types
 */

import type { QRecord, QFieldMetaData, QPossibleValue } from '@/types/api-types'

// ============================================================================
// PROCESS METADATA TYPES
// ============================================================================

/**
 * Step component type enumeration - all 14 supported types
 */
export type ProcessComponentType =
  | 'HELP_TEXT'
  | 'BULK_EDIT_FORM'
  | 'BULK_LOAD_FILE_MAPPING_FORM'
  | 'BULK_LOAD_VALUE_MAPPING_FORM'
  | 'BULK_LOAD_PROFILE_FORM'
  | 'VALIDATION_REVIEW_SCREEN'
  | 'EDIT_FORM'
  | 'VIEW_FORM'
  | 'DOWNLOAD_FORM'
  | 'RECORD_LIST'
  | 'PROCESS_SUMMARY_RESULTS'
  | 'GOOGLE_DRIVE_SELECT_FOLDER'
  | 'WIDGET'
  | 'HTML'

/**
 * Component rendering configuration within a step
 */
export interface QFrontendStepComponent {
  type: ProcessComponentType
  values?: QPossibleValue[] // For components with predefined options
  helpContents?: string // Help text for the component
  [key: string]: unknown // Extensible for component-specific config
}

/**
 * Step definition with all rendering and validation metadata
 */
export interface QFrontendStepMetaData {
  name: string // Unique step identifier within process
  label: string // User-facing step label
  format?: 'screen' | 'modal' // Rendering format hint (default: screen)
  components: QFrontendStepComponent[] // Components to render in this step
  formFields: QFieldMetaData[] // Field definitions for EDIT_FORM/BULK_EDIT_FORM
  viewFields: QFieldMetaData[] // Field definitions for VIEW_FORM
  recordListFields: QFieldMetaData[] // Field definitions for RECORD_LIST
  helpContents?: string // Help text for the entire step
}

/**
 * Process metadata from backend - defines the complete process structure
 */
export interface QProcessMetaData {
  name: string // Unique process identifier
  label: string // User-facing process name
  tableName: string // Associated table name
  isHidden: boolean // Whether to show in process list
  iconName: string // Icon reference (Material Design or custom)
  hasPermission: boolean // User permission check result
  stepFlow: 'LINEAR' // Step flow type (extensible for future)
  minInputRecords?: number // Minimum record count for table-scoped execution
  maxInputRecords?: number // Maximum record count for table-scoped execution
  frontendSteps: QFrontendStepMetaData[] // Ordered step sequence
}

/**
 * Dynamic metadata adjustments sent by backend during execution
 * Allows backend to modify step flow and field definitions mid-process
 */
export interface ProcessMetaDataAdjustment {
  updatedFrontendStepList?: QFrontendStepMetaData[] // Replace step list
  updatedFields?: Record<string, QFieldMetaData> // Update field definitions
}

// ============================================================================
// JOB RESPONSE TYPES
// ============================================================================

/**
 * Response when process/job initialization starts
 * Indicates backend is processing the request asynchronously
 */
export interface QJobStarted {
  processUUID: string // Unique process instance identifier
  jobUUID: string // Unique async job identifier for polling
}

/**
 * Response during job execution - status update with progress
 */
export interface QJobRunning {
  processUUID: string // Echoes process UUID
  message: string // Status message for display
  current?: number // Current progress (e.g., records processed)
  total?: number // Total items to process
}

/**
 * Response when job completes successfully
 * May contain next step definition or process results
 */
export interface QJobComplete {
  processUUID: string // Echoes process UUID
  values?: Record<string, unknown> // Form values for next step
  nextStep?: string // Name of next step to advance to
  backStep?: string // Name of previous step (allows going back)
  processMetaDataAdjustment?: ProcessMetaDataAdjustment // Dynamic step/field changes
  results?: {
    totalRecords?: number // Total records processed
    createdRecords?: number // Records created
    updatedRecords?: number // Records updated
    skippedRecords?: number // Records skipped
    errorRecords?: number // Records with errors
    downloadLinks?: Array<{ label: string; href: string }> // Download URLs
  }
}

/**
 * Response when job fails
 */
export interface QJobError {
  processUUID: string // Echoes process UUID
  error: string // Technical error message
  userFacingError?: string // User-friendly error message
  validationErrors?: Array<{
    field?: string // Field name if field-specific
    message: string // Validation error message
  }>
}

/**
 * Discriminated union of all possible job responses
 */
export type JobResponse = QJobStarted | QJobRunning | QJobComplete | QJobError

/**
 * Type guards for runtime job response discrimination
 */
export function isJobStarted(response: JobResponse): response is QJobStarted {
  return 'jobUUID' in response && !('message' in response)
}

export function isJobRunning(response: JobResponse): response is QJobRunning {
  return 'message' in response && !('values' in response) && !('error' in response)
}

export function isJobComplete(response: JobResponse): response is QJobComplete {
  return ('nextStep' in response || 'backStep' in response || 'results' in response) && !('error' in response)
}

export function isJobError(response: JobResponse): response is QJobError {
  return 'error' in response && 'processUUID' in response
}

// ============================================================================
// EXECUTION STATE
// ============================================================================

/**
 * Complete execution state for a process run
 * Managed by useProcessRunState hook
 */
export interface ProcessRunState {
  // Metadata
  processName: string // Process being executed
  processMetadata: QProcessMetaData | null // Full process definition

  // Step navigation
  currentStepIndex: number // 0-based index of current step
  currentStepName: string | null // Name of current step

  // Process instance
  processUUID: string | null // Instance ID for this execution
  jobUUID: string | null // Current job ID (changes per step)

  // Job polling
  isPolling: boolean // True while polling for status
  pollError: string | null // Error from last poll attempt
  pollMessage?: string // Current status message from QJobRunning
  pollProgress?: { current?: number; total?: number } // Progress from QJobRunning

  // Input parameters
  recordsParam?: 'recordIds' | 'filterJSON' // Which input mode was used
  recordIds?: string[] // Specific record IDs (table-scoped)
  filterJSON?: Record<string, unknown> // Filter criteria (table-scoped)
  stepTimeoutMillis?: number // Timeout for this step

  // Form data
  accumulatedFormValues: Record<string, unknown> // Form values across steps

  // File upload
  pendingFile: File | null // File to upload with next step
  uploadProgress?: number // Upload progress percentage

  // Dynamic adjustments
  adjustedMetadata?: ProcessMetaDataAdjustment // Metadata changes from backend

  // Results
  results?: QJobComplete['results'] // Process results summary

  // Errors
  error: string | null // Technical error message
  userFacingError: string | null // User-friendly error message
  validationErrors: Array<{ field?: string; message: string }> // Field-level errors

  // UI
  isLoading: boolean // True during data fetching
  isSubmitting: boolean // True during form submission
  canGoBack: boolean // True if back step is available
}

/**
 * Reducer action for ProcessRunState
 */
export type ProcessAction =
  | {
      type: 'INIT'
      payload: { processMetadata: QProcessMetaData }
    }
  | {
      type: 'START_JOB'
      payload: { processUUID: string; jobUUID: string }
    }
  | {
      type: 'POLL_UPDATE'
      payload: Partial<ProcessRunState>
    }
  | {
      type: 'JOB_COMPLETE'
      payload: QJobComplete
    }
  | {
      type: 'ADVANCE_STEP'
      payload: { stepIndex: number; stepName: string; formValues: Record<string, unknown> }
    }
  | {
      type: 'STEP_BACK'
      payload: { stepIndex: number; stepName: string }
    }
  | {
      type: 'JOB_ERROR'
      payload: QJobError
    }
  | {
      type: 'SET_ERROR'
      payload: string
    }
  | {
      type: 'RESET'
    }

// ============================================================================
// STEP COMPONENT PROPS
// ============================================================================

/**
 * Base props passed to all step component renderers
 */
export interface ProcessStepComponentProps {
  stepMetadata: QFrontendStepMetaData // Current step definition
  componentMetadata: QFrontendStepComponent // Specific component config
  formValues: Record<string, unknown> // Accumulated form values
  isReadOnly?: boolean // If true, components should not allow editing
  onValuesChange?: (values: Record<string, unknown>) => void // Callback when values change
  isLoading?: boolean // If true, show loading state
  processName: string // Process being executed
  processUUID: string | null // Current process instance ID
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

/**
 * Values submitted during process initialization
 * Combines system parameters with user input
 */
export interface ProcessInitFormValues {
  recordsParam?: 'recordIds' | 'filterJSON' // Input mode selection
  recordIds?: string[] // Specific records
  filterJSON?: Record<string, unknown> // Filter object
  stepTimeoutMillis?: number // Optional timeout
  file?: File // Optional file upload
  [key: string]: unknown // Additional fields from first step
}

/**
 * Values submitted during step progression
 */
export interface ProcessStepFormValues {
  stepTimeoutMillis?: number // Optional timeout override
  file?: File // Optional file upload
  [key: string]: unknown // Step-specific fields
}

// ============================================================================
// RESULTS AND RECORDS
// ============================================================================

/**
 * Response from GET /processes/{p}/{uuid}/records endpoint
 */
export interface ProcessRecordsResponse {
  totalRecords: number // Total records in this process result set
  records: QRecord[] // Page of records
}

/**
 * Process results summary derived from QJobComplete
 */
export interface ProcessResultsSummary {
  totalRecords?: number // Total processed
  createdRecords?: number // Created count
  updatedRecords?: number // Updated count
  skippedRecords?: number // Skipped count
  errorRecords?: number // Error count
  downloadLinks?: Array<{ label: string; href: string }> // Downloadable files
  validationErrors?: Array<{ field?: string; message: string }> // Errors that occurred
}
```

### 6.2 Component Props Interfaces

```typescript
/**
 * Props for ProcessStepper component
 */
export interface ProcessStepperProps {
  processName: string
  recordIds?: string[]
  filterJSON?: Record<string, unknown>
  onComplete?: (results: ProcessResultsSummary) => void
  onCancel?: () => void
}

/**
 * Props for ProcessRunPage
 */
export interface ProcessRunPageProps {
  params: { processName: string }
  searchParams: Record<string, string | string[] | undefined>
}

/**
 * Props for ProcessRunModal
 */
export interface ProcessRunModalProps {
  isOpen: boolean
  onClose: () => void
  processName: string | null
  recordIds?: string[]
  filterJSON?: Record<string, unknown>
  onComplete?: (results: ProcessResultsSummary) => void
}

/**
 * Props for ProcessRecordsTable
 */
export interface ProcessRecordsTableProps {
  processName: string
  processUUID: string
  recordListFields: QFieldMetaData[]
}

/**
 * Props for ProcessResultsSummary
 */
export interface ProcessResultsSummaryProps {
  results: ProcessResultsSummary
  processName: string
  processUUID: string
  recordListFields?: QFieldMetaData[]
  showRecordsTable?: boolean
}

/**
 * Props for StepComponentRenderer
 */
export interface StepComponentRendererProps extends ProcessStepComponentProps {
  // Inherited from ProcessStepComponentProps
}

/**
 * Props for individual step component types
 */
export interface HelpTextComponentProps extends ProcessStepComponentProps {}
export interface BulkEditFormComponentProps extends ProcessStepComponentProps {}
export interface BulkLoadFileMappingFormComponentProps extends ProcessStepComponentProps {}
export interface BulkLoadValueMappingFormComponentProps extends ProcessStepComponentProps {}
export interface BulkLoadProfileFormComponentProps extends ProcessStepComponentProps {}
export interface ValidationReviewScreenComponentProps extends ProcessStepComponentProps {}
export interface EditFormComponentProps extends ProcessStepComponentProps {}
export interface ViewFormComponentProps extends ProcessStepComponentProps {}
export interface DownloadFormComponentProps extends ProcessStepComponentProps {}
export interface RecordListComponentProps extends ProcessStepComponentProps {}
export interface ProcessSummaryResultsComponentProps extends ProcessStepComponentProps {}
export interface GoogleDriveSelectFolderComponentProps extends ProcessStepComponentProps {}
export interface WidgetComponentProps extends ProcessStepComponentProps {}
export interface HtmlComponentProps extends ProcessStepComponentProps {}
```

---

## 7. API Client Functions

### 7.1 Process API Client Module

**File:** `/src/lib/api-client-process.ts`

```typescript
/**
 * Process execution API client
 * Wraps all process-related endpoints with proper error handling and typing
 */

import { apiClient } from '@/lib/api-client'
import {
  QProcessMetaData,
  QJobStarted,
  QJobRunning,
  QJobComplete,
  QJobError,
  JobResponse,
  ProcessInitFormValues,
  ProcessStepFormValues,
  ProcessRecordsResponse,
  isJobStarted,
  isJobRunning,
  isJobComplete,
  isJobError,
} from '@/types/process-types'

/**
 * Query key factory for React Query
 */
export const processQueryKeys = {
  all: ['processes'] as const,
  metadata: (processName: string) => [...processQueryKeys.all, 'metadata', processName] as const,
  status: (processName: string, processUUID: string, jobUUID: string) =>
    [...processQueryKeys.all, 'status', processName, processUUID, jobUUID] as const,
  records: (processName: string, processUUID: string) =>
    [...processQueryKeys.all, 'records', processName, processUUID] as const,
  recordsPage: (processName: string, processUUID: string, skip: number, limit: number) =>
    [...processQueryKeys.records(processName, processUUID), skip, limit] as const,
}

// ============================================================================
// GET PROCESS METADATA
// ============================================================================

/**
 * Fetch process metadata including step definitions and fields
 * GET /qqq/v1/metaData/process/{processName}
 *
 * @param processName - Name of the process to fetch metadata for
 * @returns Process metadata including step flow and field definitions
 * @throws Error if process not found or user lacks permission
 */
export async function getProcessMetadata(processName: string): Promise<QProcessMetaData> {
  try {
    const response = await apiClient.get<QProcessMetaData>(
      `/qqq/v1/metaData/process/${encodeURIComponent(processName)}`
    )
    return response.data
  } catch (error) {
    console.error(`Failed to fetch metadata for process ${processName}:`, error)
    throw new Error(`Failed to load process: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================================================
// INITIALIZE PROCESS
// ============================================================================

/**
 * Initialize a process with input parameters and optional file
 * POST /qqq/v1/processes/{processName}/init
 * Content-Type: multipart/form-data
 *
 * @param processName - Name of the process to initialize
 * @param values - Form values and parameters as JSON string
 * @param options - Initialization options including file, timeout, record selection
 * @returns Job started response with processUUID and jobUUID, or immediate completion/error
 */
export async function initProcess(
  processName: string,
  values: Record<string, unknown>,
  options?: {
    file?: File
    recordIds?: string[]
    filterJSON?: Record<string, unknown>
    stepTimeoutMillis?: number
  }
): Promise<JobResponse> {
  try {
    const formData = new FormData()

    // Add values as JSON string
    formData.append('values', JSON.stringify(values))

    // Add optional parameters
    if (options?.recordIds && options.recordIds.length > 0) {
      formData.append('recordsParam', 'recordIds')
      formData.append('recordIds', JSON.stringify(options.recordIds))
    } else if (options?.filterJSON) {
      formData.append('recordsParam', 'filterJSON')
      formData.append('filterJSON', JSON.stringify(options.filterJSON))
    }

    if (options?.stepTimeoutMillis) {
      formData.append('stepTimeoutMillis', options.stepTimeoutMillis.toString())
    }

    // Add file if provided
    if (options?.file) {
      formData.append('file', options.file)
    }

    const response = await apiClient.post<JobResponse>(
      `/qqq/v1/processes/${encodeURIComponent(processName)}/init`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    return response.data
  } catch (error) {
    console.error(`Failed to initialize process ${processName}:`, error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      processUUID: '',
      error: message,
      userFacingError: `Failed to start process: ${message}`,
    } as QJobError
  }
}

// ============================================================================
// SUBMIT PROCESS STEP
// ============================================================================

/**
 * Submit values for a process step and advance execution
 * POST /qqq/v1/processes/{processName}/{processUUID}/step/{stepName}
 * Content-Type: multipart/form-data
 *
 * @param processName - Name of the process
 * @param processUUID - Unique identifier for this process instance
 * @param stepName - Name of the step being submitted
 * @param values - Form values and parameters as JSON string
 * @param options - Submission options including file and timeout
 * @returns Job response (started, running, complete, or error)
 */
export async function submitProcessStep(
  processName: string,
  processUUID: string,
  stepName: string,
  values: Record<string, unknown>,
  options?: {
    file?: File
    stepTimeoutMillis?: number
  }
): Promise<JobResponse> {
  try {
    const formData = new FormData()

    // Add values as JSON string
    formData.append('values', JSON.stringify(values))

    if (options?.stepTimeoutMillis) {
      formData.append('stepTimeoutMillis', options.stepTimeoutMillis.toString())
    }

    // Add file if provided
    if (options?.file) {
      formData.append('file', options.file)
    }

    const response = await apiClient.post<JobResponse>(
      `/qqq/v1/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/step/${encodeURIComponent(stepName)}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    return response.data
  } catch (error) {
    console.error(`Failed to submit step ${stepName} for process ${processName}:`, error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      processUUID,
      error: message,
      userFacingError: `Failed to process step: ${message}`,
    } as QJobError
  }
}

// ============================================================================
// POLL PROCESS STATUS
// ============================================================================

/**
 * Poll for process job status (for async operations)
 * GET /qqq/v1/processes/{processName}/{processUUID}/status/{jobUUID}
 *
 * @param processName - Name of the process
 * @param processUUID - Unique identifier for this process instance
 * @param jobUUID - Unique identifier for the async job
 * @returns Job status response (running, complete, or error)
 */
export async function pollProcessStatus(
  processName: string,
  processUUID: string,
  jobUUID: string
): Promise<JobResponse> {
  try {
    const response = await apiClient.get<JobResponse>(
      `/qqq/v1/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/status/${encodeURIComponent(jobUUID)}`
    )

    return response.data
  } catch (error) {
    console.error(`Failed to poll status for job ${jobUUID}:`, error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      processUUID,
      error: message,
      userFacingError: `Failed to get job status: ${message}`,
    } as QJobError
  }
}

// ============================================================================
// GET PROCESS RECORDS
// ============================================================================

/**
 * Fetch paginated records from a completed process
 * GET /qqq/v1/processes/{processName}/{processUUID}/records
 *
 * @param processName - Name of the process
 * @param processUUID - Unique identifier for this process instance
 * @param skip - Number of records to skip (for pagination)
 * @param limit - Number of records to fetch
 * @returns Paginated records response
 */
export async function getProcessRecords(
  processName: string,
  processUUID: string,
  skip: number = 0,
  limit: number = 50
): Promise<ProcessRecordsResponse> {
  try {
    const response = await apiClient.get<ProcessRecordsResponse>(
      `/qqq/v1/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/records`,
      {
        params: {
          skip,
          limit,
        },
      }
    )

    return response.data
  } catch (error) {
    console.error(`Failed to fetch records for process ${processName}:`, error)
    throw new Error(`Failed to load process records: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================================================
// CANCEL PROCESS
// ============================================================================

/**
 * Cancel an in-flight or queued process
 * GET /qqq/v1/processes/{processName}/{processUUID}/cancel
 *
 * @param processName - Name of the process
 * @param processUUID - Unique identifier for this process instance
 * @returns True if cancellation was successful
 */
export async function cancelProcess(processName: string, processUUID: string): Promise<boolean> {
  try {
    const response = await apiClient.get<{ success: boolean }>(
      `/qqq/v1/processes/${encodeURIComponent(processName)}/${encodeURIComponent(processUUID)}/cancel`
    )

    return response.data.success ?? true
  } catch (error) {
    console.error(`Failed to cancel process ${processName}:`, error)
    throw new Error(`Failed to cancel process: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================================================
// MUTATION WRAPPERS FOR REACT QUERY
// ============================================================================

/**
 * React Query mutation hook configuration for initializing process
 */
export const initProcessMutation = {
  mutationFn: (params: {
    processName: string
    values: Record<string, unknown>
    options?: Parameters<typeof initProcess>[2]
  }) => initProcess(params.processName, params.values, params.options),
}

/**
 * React Query mutation hook configuration for submitting process step
 */
export const submitProcessStepMutation = {
  mutationFn: (params: {
    processName: string
    processUUID: string
    stepName: string
    values: Record<string, unknown>
    options?: Parameters<typeof submitProcessStep>[4]
  }) => submitProcessStep(params.processName, params.processUUID, params.stepName, params.values, params.options),
}

/**
 * React Query mutation hook configuration for canceling process
 */
export const cancelProcessMutation = {
  mutationFn: (params: { processName: string; processUUID: string }) =>
    cancelProcess(params.processName, params.processUUID),
}
```

---

## 8. Testing Requirements

### 8.1 Unit Tests

**Files:** `__tests__/` directory alongside each component

1. **useProcessRunState Hook**
   - Initial state is correct
   - INIT action loads metadata
   - START_JOB action sets processUUID and jobUUID
   - ADVANCE_STEP action increments step and accumulates values
   - STEP_BACK action decrements step
   - JOB_ERROR action sets error state
   - RESET action clears all state

2. **useProcessJobPolling Hook**
   - Starts polling when enabled
   - Implements exponential backoff correctly (1.5s, 2.25s, 3.375s, etc., capped at 12s)
   - Stops polling on QJobComplete
   - Stops polling on QJobError
   - Stops polling when disabled
   - Calls onStatusUpdate for each response

3. **useProcessFileUpload Hook**
   - Validates file size and type
   - Constructs multipart/form-data correctly
   - Reports upload progress
   - Handles upload errors

4. **StepComponentRenderer**
   - Routes to correct component for each of 14 types
   - Passes props correctly
   - Handles unknown component types gracefully
   - Renders error boundary on component error

5. **Each Step Component Type**
   - Renders without crashing
   - Accepts initial form values
   - Calls onValuesChange with updated values
   - Respects isReadOnly prop
   - Respects isLoading prop

6. **ProcessStepper**
   - Loads process metadata
   - Renders first step
   - Advances to next step on form submission
   - Goes back on back button
   - Stops on last step (shows results)
   - Handles job polling completion
   - Handles job errors
   - Calls onComplete callback with results
   - Calls onCancel callback on cancel

7. **API Client Functions**
   - getProcessMetadata makes correct GET request
   - initProcess constructs multipart/form-data correctly
   - submitProcessStep constructs multipart/form-data correctly
   - pollProcessStatus makes correct GET request
   - getProcessRecords passes skip/limit params
   - cancelProcess makes correct GET request
   - All functions handle and return errors correctly

### 8.2 Integration Tests

1. **Full Process Flow**
   - User navigates to /app/{processName}
   - Process metadata loads
   - First step renders with correct components
   - User submits form
   - Backend returns QJobStarted
   - Polling begins
   - Polling returns QJobRunning with progress
   - Polling returns QJobComplete
   - Next step renders with accumulated values
   - User submits second step
   - Process completes with results
   - Results summary displays correctly

2. **Table-Scoped Process**
   - User selects records in Record Query grid
   - User clicks "Run Process" action
   - ProcessRunModal opens with selectedRecordIds
   - Process executes with recordIds param
   - Process completes and closes modal

3. **Error Handling**
   - Network error during metadata fetch shows error message
   - Network error during init shows error message
   - Job error response displays userFacingError
   - Validation errors display field-level errors
   - Polling timeout shows timeout error

4. **ProcessMetaDataAdjustment**
   - Backend returns updatedFrontendStepList
   - Step list is updated mid-process
   - New steps appear in stepper
   - Backend returns updatedFields
   - Field definitions are updated for next step

5. **File Upload**
   - User uploads file on init
   - File is sent in multipart/form-data
   - File upload progress is tracked
   - File upload error is displayed
   - User uploads file on step
   - File is sent with step submission

### 8.3 Component Testing Coverage

```
Coverage Target: 80%+

ProcessStepper.tsx:           85%
ProcessRunPage.tsx:           80%
ProcessRunModal.tsx:          80%
StepComponentRenderer.tsx:    85%
HelpTextComponent.tsx:        90%
BulkEditFormComponent.tsx:    85%
EditFormComponent.tsx:        85%
ViewFormComponent.tsx:        90%
ValidationReviewScreenComponent.tsx: 85%
ProcessRecordsTable.tsx:      85%
ProcessResultsSummary.tsx:    85%
useProcessRunState.ts:        90%
useProcessJobPolling.ts:      85%
useProcessFileUpload.ts:      85%
api-client-process.ts:        90%
```

### 8.4 E2E Test Scenarios (Storybook/Manual)

1. **Happy Path: Simple Form Process**
   - Process with single EDIT_FORM step
   - Submit form with valid data
   - See results summary

2. **Multi-Step Process**
   - Process with 5 steps
   - Navigate forward through all steps
   - Navigate backward through steps
   - Submit final step and see results

3. **Bulk Load Workflow**
   - Process with file upload → column mapping → value mapping → validation → execute
   - Upload CSV file
   - Map columns to fields
   - Map source values to target values
   - Review and accept validation
   - Execute and see results

4. **Table-Scoped Process**
   - Open Record Query with multiple records
   - Select subset of records
   - Launch process from toolbar
   - Process executes with selected recordIds
   - Modal closes on completion

5. **Process with Results**
   - Process that creates records
   - See summary with record counts
   - View paginated result records
   - Download result files

6. **Error and Retry**
   - Process fails with validation error
   - Error message displays
   - User corrects form
   - Retry succeeds

---

## 9. Acceptance Criteria

### 9.1 Process Metadata and Discovery (4 criteria)

1. ✓ GET /qqq/v1/metaData/process/{processName} returns QProcessMetaData with all required fields: name, label, tableName, isHidden, iconName, hasPermission, stepFlow, frontendSteps
2. ✓ Process metadata loading in ProcessStepper sets currentStepIndex to 0 and currentStepName to first step name
3. ✓ Process with isHidden=true is not shown in process navigation/lists
4. ✓ Process with hasPermission=false shows permission denied error instead of execution UI

### 9.2 Process Run Page (3 criteria)

5. ✓ Route /app/[processName] loads process metadata and renders ProcessStepper
6. ✓ Breadcrumb navigation shows: Home > Processes > {processLabel}
7. ✓ Search params ?recordIds=id1,id2 are passed to init endpoint; ?filterJSON={...} is passed to init endpoint

### 9.3 Step Wizard Navigation (5 criteria)

8. ✓ ProcessStepper renders Stepper component showing all steps with current step highlighted
9. ✓ Forward button advances to next step after form submission and successful job completion
10. ✓ Back button navigates to previous step (if backStep not provided) or to backStep (if provided)
11. ✓ Current step indicator shows "Step X of Y" with progress bar
12. ✓ Last step shows "Complete" button instead of "Next" and displays results summary instead of form

### 9.4 Form Component Rendering (8 criteria)

13. ✓ HELP_TEXT component renders helpContents as read-only text in Alert component
14. ✓ EDIT_FORM component renders EntityForm from Package 3 with formFields from step metadata
15. ✓ VIEW_FORM component renders read-only form via FieldDisplay from Package 3
16. ✓ BULK_EDIT_FORM component renders EntityForm with bulk field editing capability
17. ✓ DOWNLOAD_FORM component renders download links/buttons from results
18. ✓ RECORD_LIST component renders paginated table of records with recordListFields
19. ✓ PROCESS_SUMMARY_RESULTS component displays record counts and error list
20. ✓ HTML component renders safe HTML content from helpContents

### 9.5 Validation and Bulk Load Components (5 criteria)

21. ✓ BULK_LOAD_FILE_MAPPING_FORM renders CSV upload with column-to-field mapping UI
22. ✓ BULK_LOAD_VALUE_MAPPING_FORM renders mapping table for source-to-target value transformation
23. ✓ BULK_LOAD_PROFILE_FORM allows save/load/delete of mapping profiles with timestamps
24. ✓ VALIDATION_REVIEW_SCREEN displays validation errors and warnings with accept/reject buttons
25. ✓ Reject button on validation screen prevents step advancement

### 9.6 Stub/Future Components (2 criteria)

26. ✓ GOOGLE_DRIVE_SELECT_FOLDER renders placeholder UI indicating feature not yet available
27. ✓ WIDGET component renders placeholder and logs TODO for Package 5 integration

### 9.7 Async Job Handling (7 criteria)

28. ✓ POST /qqq/v1/processes/{p}/init with multipart/form-data returns QJobStarted with processUUID and jobUUID
29. ✓ POST /qqq/v1/processes/{p}/{uuid}/step/{step} with multipart/form-data returns QJobStarted, QJobRunning, QJobComplete, or QJobError
30. ✓ Exponential backoff polling: initial 1.5s, multiplier 1.5x, max cap 12s (sequence: 1.5s, 2.25s, 3.375s, 5.06s, 7.59s, 11.39s, 12s, 12s...)
31. ✓ GET /qqq/v1/processes/{p}/{uuid}/status/{jobUUID} called on polling interval
32. ✓ QJobRunning response with message and progress (current/total) updates UI progress display
33. ✓ QJobComplete response advances to nextStep or shows results
34. ✓ QJobError response displays error message and userFacingError, prevents advancement

### 9.8 Process Metadata Adjustment (2 criteria)

35. ✓ QJobComplete with processMetaDataAdjustment.updatedFrontendStepList replaces step sequence
36. ✓ QJobComplete with processMetaDataAdjustment.updatedFields updates field definitions for subsequent steps

### 9.9 File Upload (3 criteria)

37. ✓ File uploaded on init is sent via multipart/form-data with key 'file'
38. ✓ File uploaded on step submission is sent via multipart/form-data with key 'file'
39. ✓ File upload progress is tracked and displayed to user during upload

### 9.10 Record Selection (4 criteria)

40. ✓ ProcessInitForm or search params support recordIds array: ["rec1", "rec2", ...]
41. ✓ recordIds passed to init endpoint in POST body
42. ✓ ProcessInitForm or search params support filterJSON: { field: "value", ... }
43. ✓ filterJSON passed to init endpoint in POST body

### 9.11 Process Results (5 criteria)

44. ✓ ProcessResultsSummary displays totalRecords, createdRecords, updatedRecords, skippedRecords, errorRecords
45. ✓ GET /qqq/v1/processes/{p}/{uuid}/records returns paginated records with skip/limit
46. ✓ ProcessRecordsTable renders paginated table with forward/back pagination controls
47. ✓ Download links from results are clickable and functional
48. ✓ Validation errors from results are displayed with field context

### 9.12 Form Value Accumulation (2 criteria)

49. ✓ Form values from step N are accumulated and available to step N+1 (accumulatedFormValues passed to next step)
50. ✓ Form values from previous steps are displayed as initial values in EDIT_FORM and BULK_EDIT_FORM

### 9.13 Process Cancellation (1 criterion)

51. ✓ GET /qqq/v1/processes/{p}/{uuid}/cancel stops in-flight process and returns boolean success

### 9.14 Process Run Modal (3 criteria)

52. ✓ ProcessRunModal opens from Record Query toolbar/context menu
53. ✓ ProcessRunModal accepts processName, recordIds, filterJSON, onClose props
54. ✓ ProcessRunModal closes on process completion or user cancel

### 9.15 Error Handling (5 criteria)

55. ✓ Network errors during metadata fetch show error alert with retry button
56. ✓ Network errors during job submission show error alert
57. ✓ Job error responses (QJobError) display userFacingError to user
58. ✓ Validation errors display field-level messages next to relevant fields
59. ✓ Polling errors show error message and offer retry

### 9.16 UI Polish and Accessibility (3 criteria)

60. ✓ Loading states show spinner while job is polling
61. ✓ Form buttons are disabled during submission
62. ✓ Process page title and meta tags set from process metadata

### 9.17 Data Integrity (2 criteria)

63. ✓ accumulatedFormValues are preserved across back/forward navigation (not lost when stepping back)
64. ✓ Job responses are validated against expected type schema before use

---

## Summary

This work package delivers a production-ready process execution system that:

- Supports 14 distinct step component types for flexible workflow design
- Implements proper async job polling with intelligent backoff
- Reuses form components from Package 3 for consistency
- Handles dynamic metadata adjustments from backend
- Supports both standalone and table-scoped process execution
- Provides comprehensive error handling and user feedback
- Accumulates form data across multi-step workflows
- Renders process results with pagination and downloads
- Maintains clean type safety with TypeScript throughout

The implementation prioritizes user experience, type safety, and code reusability while maintaining clear separation of concerns and testability.
