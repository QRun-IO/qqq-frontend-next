<!--
  Copyright 2026 QRun.IO, Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

# QQQ Frontend Next — Documentation Review
**Date:** 2026-03-01
**Scope:** Full `src/` + `docs/` + project root
**Commit:** 12edc4c

---

## Overall Score: 7.5 / 10

**Strengths:** JSDoc coverage is high across the API client, utilities, and most hooks. Type definitions are well-documented. `CLAUDE.md` and the implementation plans give a strong architectural overview.

**Key gaps:** `README.md` is essentially empty, `useRecordQuery` has no return-type documentation, and there are no architecture guides for state management or component composition patterns — the two things a new contributor needs most.

---

## CRITICAL — Must Address

### DOC-CRIT-1: README.md is empty

**File:** `README.md`
**Issue:** The file contains only a title. No setup instructions, command list, project overview, or links to docs.
**Impact:** A new developer cannot start contributing without reading `CLAUDE.md` and inferring the rest.

**Fix:** Add the following sections at minimum:
- What this project is (2–3 sentences)
- Prerequisites (Node.js version, pnpm)
- Quick start (`git clone` → `pnpm install` → `pnpm dev`)
- Available commands (dev, build, test, test:e2e, lint, tsc)
- Pointer to `CLAUDE.md` for architecture and conventions
- Pointer to `docs/` for implementation plans

---

### DOC-CRIT-2: `useRecordQuery` return type is undocumented

**File:** `src/lib/hooks/use-record-query.ts` (~line 60, main hook export)
**Issue:** The hook returns a large composite object (pagination, filter, selection, sort, query state, plus delegated `columns` and `views` namespaces from sub-hooks). None of the return properties are documented. Only two components consume this hook today, but that will grow.
**Impact:** Callers must trace through 685 lines of source to discover which properties exist.

**Fix:** Add a `@returns` block enumerating the top-level namespaces and key properties, or define an explicit `UseRecordQueryResult` interface with JSDoc on each field.

---

### DOC-CRIT-3: No state-management decision guide

**Issue:** The project uses five different state containers (React Context, TanStack Query, React Hook Form, URL search params, localStorage), each for different purposes. There is a brief table in `CLAUDE.md` but no guidance on the decision criteria.
**Impact:** New contributors pick the wrong state container; inconsistent patterns accumulate over time.

**Fix:** Create `docs/STATE-MANAGEMENT.md` covering:
- TanStack Query: all server state (records, metadata, widgets)
- React Hook Form: form field state only
- URL search params: filters, pagination, sort (shareable links)
- localStorage: user preferences, column config, saved views
- QContext: application-level UI state (modals, toast queue)
- When NOT to use useState for server-derived state

---

## SIGNIFICANT — Should Address

### DOC-SIG-1: No component composition patterns guide

**Issue:** The codebase uses several non-obvious patterns not documented anywhere outside of scattered code comments:
- Metadata-driven rendering (metadata always flows down; children never fetch)
- `data-qqq-id` naming convention (`{component-type}-{identifier}`)
- Async combobox pattern (`useAsyncCombobox` wrapping)
- Field adornment priority chain (documented in `FieldValue.tsx` but not shared)

**Fix:** Create `docs/COMPONENT-PATTERNS.md` with each pattern described, the rationale, and a code example.

---

### DOC-SIG-2: No type glossary

**Issue:** The `src/types/` directory exports ~40 interfaces and type aliases. There is no index or glossary. Finding the right type requires `grep`-ing.
**Impact:** Types are duplicated or approximated when developers can't find the canonical definition.

**Fix:** Create `docs/TYPE-GLOSSARY.md` with a table: Type | File | Purpose | Example usage. Focus on the ~15 most-used types (`QInstance`, `QTableMetaData`, `QFieldMetaData`, `SavedView`, `QProcessMetaData`, `StatTile`, `FilterModel`, etc.).

---

### DOC-SIG-3: API error handling patterns undocumented

**File:** `src/lib/api/client.ts` (referenced)
**Issue:** The 401 interceptor is documented, but there is no guide to how callers should handle 400 (validation), 403 (permission), 404 (not found), and 500 (server error) responses. Components handle these inconsistently today.

**Fix:** Add a section to the API client file header or create `docs/API-ERROR-HANDLING.md` with the standard response patterns per HTTP status code.

---

### DOC-SIG-4: Zod schema generation lacks examples

**File:** `src/lib/utils/zod-from-metadata.ts`
**Issue:** The function and helpers are well-documented, but there is no `@example` showing how a field metadata object maps to a generated Zod schema. This is the most opaque part of the form validation pipeline.

**Fix:** Add a 6-line `@example` to `zodFieldFromMetadata` showing an input `QFieldMetaData` object and the corresponding schema.

---

### DOC-SIG-5: Form validation strategy not centralized

**Issue:** Zod schema generation is in `zod-from-metadata.ts`, field-level validation rules are in individual field components, and server-side validation errors are mapped in `EntityForm.tsx`. No single document explains the end-to-end validation strategy.

**Fix:** Create `docs/FORM-VALIDATION.md` covering schema generation, custom refinements, and mapping server errors to form fields.

---

### DOC-SIG-6: TanStack Query key factory undocumented

**File:** `src/lib/query-client.ts`
**Issue:** The query key factory pattern is used throughout the codebase but the naming convention and invalidation patterns are not documented. Developers risk creating overlapping keys.

**Fix:** Document the key structure and add `@example` tags showing how to invalidate a table's record list after a mutation.

---

## MINOR — Nice to Have

### DOC-MIN-1: Test file headers are sparse

Many test files (`*.test.tsx`) have no JSDoc file header explaining what behavior is under test and what is explicitly out of scope. This makes it harder to assess test coverage gaps at a glance.

**Files:** Most files in `src/components/**/*.test.tsx`, `src/lib/hooks/*.test.ts`

---

### DOC-MIN-2: Performance decisions lack inline rationale

Files like `use-record-query.ts` have several `useMemo` / `useCallback` / `useRef` optimizations with comments referencing ticket numbers but no explanation of the underlying performance problem being solved.

---

### DOC-MIN-3: Accessibility decisions not consolidated

WCAG compliance work is scattered across code comments and the design review document. A single `docs/ACCESSIBILITY.md` checklist would make it easy to see what has been done and what remains.

---

### DOC-MIN-4: Widget creation guide missing

The widget rendering pipeline (`WidgetBlock` → `WidgetRenderer` → specific widget component) is non-obvious. A short guide in `docs/` or a code comment in `WidgetRenderer` explaining how to add a new widget type would help.

---

## Already Excellent

| Area | Quality | Notes |
|------|---------|-------|
| API client (`src/lib/api/`) | 9/10 | 100% JSDoc; error conditions noted; param types clear |
| Utilities (`src/lib/utils/`) | 8.5/10 | `filter-utils`, `process-utils`, `zod-from-metadata` all thorough |
| Sub-hooks (`use-column-config`, `use-saved-views`, `use-async-combobox`) | 9/10 | Return shapes documented; edge cases noted |
| Type definitions (`src/types/metadata.ts`) | 8.5/10 | All major interfaces have field-level JSDoc |
| Core query components (`DataGrid`, `FilterBuilder`, `Pagination`, `ColumnConfig`) | 8/10 | Props and behavior well-described |
| Records components (`FieldValue`, `RecordView`, `EntityForm`) | 7.5/10 | Good headers; adornment priority documented |
| `CLAUDE.md` | 9/10 | Architecture, conventions, file structure all clear |
| Implementation plans (`docs/implementation-plans/`) | 8/10 | Phased clearly; shared context well-organized |

---

## Recommended Work Order

### Phase 1 — Unblock contributors (half day)
1. **DOC-CRIT-1** — Expand README.md
2. **DOC-CRIT-2** — Document `useRecordQuery` return type

### Phase 2 — Improve onboarding (1 day)
3. **DOC-CRIT-3** — Create `docs/STATE-MANAGEMENT.md`
4. **DOC-SIG-1** — Create `docs/COMPONENT-PATTERNS.md`
5. **DOC-SIG-2** — Create `docs/TYPE-GLOSSARY.md`

### Phase 3 — Fill API/validation gaps (half day)
6. **DOC-SIG-3** — API error handling guide
7. **DOC-SIG-4** — Add `@example` to `zodFieldFromMetadata`
8. **DOC-SIG-5** — Create `docs/FORM-VALIDATION.md`
9. **DOC-SIG-6** — Document query key factory

### Phase 4 — Polish (as time allows)
10–13. **DOC-MIN-1 through DOC-MIN-4** — Test headers, perf rationale, a11y checklist, widget guide
