# Agent Prompt: Package 4 — Process Execution

## Your Role

You are an implementation agent. Execute Work Package 4. Follow the plan exactly.

## Before Writing Any Code, Read These Files

1. **Your plan:** `docs/implementation-plans/04-process-execution.md`
2. **API contract:** `docs/implementation-plans/shared-context/api-contract.md`
3. **Type definitions:** `docs/implementation-plans/shared-context/type-definitions.md`
4. **Coding conventions:** `docs/implementation-plans/shared-context/coding-conventions.md`
5. **CLAUDE.md**

## Reference Code (Read for Behavior Parity)

From `qqq-frontend-material-dashboard`:
- `src/qqq/pages/processes/ProcessRun.tsx` — THE process page. Read the whole thing. Note: step state machine, 14 component types, async job polling with exponential backoff (1.5s initial, 1.5x multiplier, 12s max), file upload, record selection modes
- `src/qqq/components/processes/` — All process components
- `src/qqq/components/processes/ProcessViewForm.tsx` — View-only form steps
- `src/qqq/components/processes/ProcessSummaryResults.tsx` — Results display
- `src/qqq/components/processes/ValidationReview.tsx` — Pre-commit validation
- `src/qqq/components/processes/BulkLoadFileMappingForm.tsx` — Column-to-field mapping
- `src/qqq/components/processes/BulkLoadValueMappingForm.tsx` — Value mapping
- `src/qqq/components/processes/SavedBulkLoadProfiles.tsx` — Profile save/load

From `qqq-frontend-core`:
- `src/controllers/QController.ts` — processInit, processStep, processJobStatus, processRecords, processCancel
- `src/model/processes/` — QJobStarted, QJobRunning, QJobComplete, QJobError, ProcessMetaDataAdjustment

## What Previous Packages Provide (Import From Them)

From Package 1: types, API client, context, layout
From Package 3 (CRITICAL — reuse these):
- `import { EntityForm } from '@/components/forms/EntityForm'` — For form steps
- `import { DynamicFormField } from '@/components/forms/DynamicFormField'` — For individual fields
- `import { fetchPossibleValues } from '@/lib/api/possible-values'` — For select fields in process forms
- Form validation patterns from Package 3

## What You Must Build

1. **Process Run page** at `src/app/(dashboard)/app/[processName]/page.tsx`
   - Step wizard with stepper UI showing progress
   - Dynamic step rendering from QFrontendStepMetaData.components

2. **All 14 component types:** HELP_TEXT, BULK_EDIT_FORM, BULK_LOAD_FILE_MAPPING_FORM, BULK_LOAD_VALUE_MAPPING_FORM, BULK_LOAD_PROFILE_FORM, VALIDATION_REVIEW_SCREEN, EDIT_FORM, VIEW_FORM, DOWNLOAD_FORM, RECORD_LIST, PROCESS_SUMMARY_RESULTS, GOOGLE_DRIVE_SELECT_FOLDER, WIDGET, HTML

3. **Async job handling:**
   - Detect QJobStarted → start polling GET /status/{jobUUID}
   - Exponential backoff: 1.5s initial, 1.5x multiplier, 12s max cap
   - Display QJobRunning progress (message, current/total)
   - Handle QJobComplete (advance to next step or show results)
   - Handle QJobError (display error, allow retry)

4. **Bulk load workflows:** file upload, column-to-field mapping, value mapping, profile save/load

5. **Process records** endpoint for paginated result viewing

6. **Process cancellation**

7. **Both launch modes:** standalone (/app/{processName}) and table-scoped (with recordIds or filterJSON)

8. **API functions** in `src/lib/api/processes.ts`: processInit, processStep, processStatus, processRecords, processCancel

## Verification

After each step: `pnpm tsc --noEmit`
When done: verify ALL acceptance criteria.
Final: `pnpm build && pnpm test`
Commit your work.
