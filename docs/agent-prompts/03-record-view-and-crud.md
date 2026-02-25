# Agent Prompt: Package 3 — Record View and CRUD

## Your Role

You are an implementation agent. Execute Work Package 3. Follow the plan exactly.

## Before Writing Any Code, Read These Files

1. **Your plan:** `docs/implementation-plans/03-record-view-and-crud.md`
2. **API contract:** `docs/implementation-plans/shared-context/api-contract.md`
3. **Type definitions:** `docs/implementation-plans/shared-context/type-definitions.md`
4. **Coding conventions:** `docs/implementation-plans/shared-context/coding-conventions.md`
5. **Project overview:** `docs/implementation-plans/00-project-overview.md`
6. **CLAUDE.md**

## Reference Code (Read for Behavior Parity)

From `qqq-frontend-material-dashboard`:
- `src/qqq/pages/records/view/RecordView.tsx` — Section rendering, T1/non-T1, widget loading, permission-gated action menu, keyboard shortcuts (n/e/c/d/a)
- `src/qqq/components/forms/EntityForm.tsx` — Form orchestrator with section-based layout
- `src/qqq/components/forms/DynamicForm.tsx` — Formik-based form with dynamic fields
- `src/qqq/components/forms/DynamicFormField.tsx` — Per-field renderer by type
- `src/qqq/components/forms/DynamicSelect.tsx` — Possible values autocomplete
- `src/qqq/components/forms/BooleanFieldSwitch.tsx` — Boolean null/false/true
- `src/qqq/components/forms/FileInputField.tsx` — File upload

From `qqq-frontend-core`:
- `src/controllers/QController.ts` — `get()`, `create()`, `update()`, `delete()` methods
- `src/model/metaData/QFieldMetaData.ts` — Field type, adornments, constraints

## What Package 1 Already Provides (Import From It)

- Types: `import type { QTableMetaData, QFieldMetaData, QRecord, QPossibleValue, QFieldType } from '@/types'`
- API client: `import apiClient from '@/lib/api/client'`
- Metadata: `import { loadTableMetaData } from '@/lib/api/metadata'`
- Context: `import { useQContext } from '@/lib/context/q-context'`

## What You Must Build

1. **Record View page** at `src/app/(dashboard)/app/[tableName]/[recordId]/page.tsx`
   - Section-organized field display (T1 section at top, others below)
   - Field value rendering for ALL 12 QFieldTypes
   - All adornment types (LINK, CHIP, SIZE, FILE_DOWNLOAD, TOOLTIP, etc.)
   - Action menu (edit, delete, copy, launch process)
   - Associated records display
   - Keyboard shortcuts (n=new, e=edit, c=copy, d=delete)

2. **Entity Form** at `src/components/forms/EntityForm.tsx`
   - Dynamic form generation from QFieldMetaData
   - React Hook Form + Zod validation (schemas from metadata: required, maxLength, type)
   - All field types: text, number, boolean, date, time, datetime, select, file, HTML, password
   - Possible values autocomplete with debounced search (300ms)
   - Section-based layout with gridColumns
   - File upload with preview

3. **Create/Edit/Copy pages** using EntityForm
4. **Delete** with confirmation dialog
5. **API functions** in `src/lib/api/tables.ts`: getRecord, insertRecord, updateRecord, deleteRecord
6. **Possible values** in `src/lib/api/possible-values.ts`: fetchPossibleValues

## Verification

After each step: `pnpm tsc --noEmit`
When done: verify ALL acceptance criteria.
Final: `pnpm build && pnpm test`
Commit your work.
