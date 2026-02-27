# QQQ Frontend Next — Code Review
**Date:** 2026-02-27
**Reviewer:** Claude (automated)
**Scope:** Full `src/` codebase audit
**Commit:** df8e2e6

---

## CRITICAL (7 findings)

---

### CRIT-1: XSS — unsanitized `dangerouslySetInnerHTML` in `FieldValue`

**File:** `src/components/records/FieldValue.tsx:136–143`

Raw backend HTML value injected into DOM with zero sanitization:
```tsx
dangerouslySetInnerHTML={{ __html: String(value) }}
```

**Fix:** Use DOMPurify:
```tsx
import DOMPurify from 'dompurify'
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(value)) }}
```

---

### CRIT-2: XSS — unsanitized `dangerouslySetInnerHTML` in `BlockWidget` (two locations)

**File:** `src/components/widgets/BlockWidget.tsx:40–48, 278–285`

Both the legacy `data.html` path and the `case 'html'` block renderer pass backend HTML directly to the DOM.

**Fix:** Apply `DOMPurify.sanitize()` to both HTML rendering paths.

---

### CRIT-3: XSS — regex script-stripping in `ProcessHtmlStep` is not real sanitization

**File:** `src/components/process/ProcessHtmlStep.tsx:14–17, 100`

```ts
// TODO: Replace with DOMPurify for full sanitization
function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}
```

Bypassed by: `<img onerror="...">`, `<svg onload="...">`, `<a href="javascript:...">`, and dozens of other vectors.

**Fix:** Replace `stripScripts` with `DOMPurify.sanitize()`.

---

### CRIT-4: Auth bypass — `handleOAuthCallback` sets `isAuthenticated=true` without token exchange

**File:** `src/lib/auth/auth-provider.tsx:164–176`

```tsx
async function handleOAuthCallback(code: string, state: string) {
  // For now, just mark as authenticated
  setIsAuthenticated(true)
}
```

`code` and `state` params are accepted but unused. No CSRF state validation, no token exchange, no session creation.

**Fix:** Implement PKCE: validate `state` against `sessionStorage`, exchange `code`+`code_verifier` for tokens via backend `/manageSession`, then set `isAuthenticated` only on success.

---

### CRIT-5: Auth bypass — Auth0/OAuth2 sessions authenticate without server validation

**File:** `src/lib/auth/auth-provider.tsx:123–138`

Both `setupAuth0Session` and `setupOAuth2Session` call no protected endpoint. Any app configured with AUTH_0 or OAUTH2 shows as authenticated for any page load. Default user is hardcoded: `{ name: 'User', email: 'user@example.com' }`.

**Fix:** Call a protected endpoint (e.g., `GET /session`) to validate existing session cookie. Redirect to provider if 401.

---

### CRIT-6: Auth state corruption — 401 interceptor doesn't clear auth metadata cache

**File:** `src/lib/auth/auth-provider.tsx:65–70`

The 401 interceptor redirects to login but does NOT call `clearAuthMetadataCache()`, leaving stale auth metadata. On next page load the cached auth type governs initialization without a fresh server check.

**Fix:** Call `clearAuthMetadataCache()` inside the 401 callback before redirect.

---

### CRIT-7: Silent export failure — `ExportButton` swallows errors with no user feedback

**File:** `src/components/query/ExportButton.tsx:88–89`

```tsx
} catch (err) {
  console.error('[ExportButton] Export failed:', err)
}
```

Users believe export succeeded when it silently failed.

**Fix:** Add `toast.error('Export failed. Please try again.')` in the catch block.

---

## HIGH (8 findings)

---

### HIGH-1: Stale closures — missing deps in URL sync + column persistence effects

**File:** `src/lib/hooks/use-record-query.ts:280–311`

Four `useEffect` hooks suppress `react-hooks/exhaustive-deps`. The URL-sync effect is missing `router` and `pathname` — stale closures can fire URL updates on the wrong route in concurrent mode.

**Fix:** Add `router` and `pathname` to the URL-sync effect deps. Use `useRef` for stable callback references if needed.

---

### HIGH-2: Performance — `JSON.stringify` key comparison on every query cache event in `useProcess`

**File:** `src/lib/hooks/use-process.ts:251–268`

```ts
if (JSON.stringify(key) !== JSON.stringify(expectedKey)) return
```

This serializes two arrays on every cache event during rapid polling intervals.

**Fix:** Use `queryClient.getQueryData(expectedKey)` or shallow key comparison utility.

---

### HIGH-3: Logic bug — `processUUID` unsafe cast falls back to empty string

**File:** `src/lib/hooks/use-process.ts:274–278`

```ts
const pUUID = (response as QJobResponse & { processUUID?: string }).processUUID ?? ''
```

If `processUUID` is absent, all subsequent step calls use `''` as the UUID, producing 404 API calls.

**Fix:** Add `processUUID` to `QJobResponse` type. Validate it is non-empty before proceeding.

---

### HIGH-4: Logic bug — type guard fallthrough on unexpected `QJobResponse` shapes

**File:** `src/lib/hooks/use-process.ts:76–82`

A response with both `error` and `values` fields, or with both `jobUUID` and `values`, falls through all type guards silently. Process state freezes indefinitely.

**Fix:** Use a discriminated union with an explicit `type` field. Add a default catch-all error case.

---

### HIGH-5: Stale auth — metadata cached globally without API base URL scoping

**File:** `src/lib/api/auth.ts:29–37`

Auth metadata cached for 1 hour under a single key `qqqAuthMetadata` regardless of API base URL. Backend auth type changes are ignored for up to 1 hour. Multi-instance deployments cross-contaminate caches.

**Fix:** Include API base URL in cache key. Consider shorter TTL (5–10 min) or TanStack Query instead.

---

### HIGH-6: Auth bypass — `globalSearch` silently swallows 401/403 errors

**File:** `src/lib/api/tables.ts:132–136`

```ts
} catch {
  // If /search endpoint is not available (404), return empty results
  return []
}
```

Catches all errors including 401 (session expired). A search 401 bypasses the global logout interceptor.

**Fix:**
```ts
} catch (err) {
  if (isAxiosError(err) && err.response?.status === 404) return []
  throw err
}
```

---

### HIGH-7: Wrong record selection — `selectedRecordIds` computed from array index, not stable PK

**File:** `src/lib/hooks/use-record-query.ts:411–421`

`rowSelection` is keyed by array index but records can reorder after sort/filter/pagination. Index 5 after a filter may point to a completely different record than before.

**Fix:** Key `rowSelection` by primary key string (same as `getRowId` in DataGrid). Update the `selectedRecordIds` computation to use PK-based lookup.

---

### HIGH-8: Dead retry button — `setPage(rq.pageNum)` is a no-op

**File:** `src/components/query/RecordQuery.tsx:503–508`

The error-state retry button dispatches `SET_PAGE` with the current page number — TanStack Query sees the same query key and does not re-fetch.

**Fix:** Use `queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableName) })`.

---

## MEDIUM (14 findings)

---

### MED-1: `AuthProvider` effect suppresses `onAuthError` dep without documentation

**File:** `src/lib/auth/auth-provider.tsx:121`

**Fix:** Document intent: `// intentional: runs once on mount — auth initialization is not repeatable`

---

### MED-2: CSS injection — raw `customCss` injected into `<style>` tag without validation

**File:** `src/app/(dashboard)/layout.tsx:108–119`

Arbitrary CSS from the backend can overlay phishing forms, exfiltrate keystrokes via CSS selectors, or perform UI redressing.

**Fix:** Use a CSS sanitizer or restrict to CSS custom property overrides only.

---

### MED-3: CSS injection — `accentColor` set on CSS custom properties without format validation

**File:** `src/app/(dashboard)/layout.tsx:71–89`

`accentColor: 'red; --qqq-primary: url(https://evil.com)'` would be applied as-is.

**Fix:** Validate `accentColor` matches `/^#[0-9a-fA-F]{3,8}$|^rgb|^hsl/` before applying.

---

### MED-4: Stale `initialValue` reference in `useLocalStorage.removeValue`

**File:** `src/lib/hooks/use-local-storage.ts:36–43`

`initialValue` is an object passed inline at call sites — new reference on every render. Causes `removeValue` re-creation and downstream `useEffect` churn.

**Fix:** Stabilize with `useRef`: `const initialValueRef = useRef(initialValue)`, use `initialValueRef.current` in `removeValue`, remove `initialValue` from deps.

---

### MED-5: `filterUtils` `btoa`/`atob` may produce overly long base64 for Unicode filter values

**File:** `src/lib/utils/filter-utils.ts:224–256`

Double-encoding (`encodeURIComponent` + `btoa`) produces unnecessarily long strings that may exceed URL limits.

**Fix:** Use `btoa(unescape(encodeURIComponent(json)))` for true Unicode-safe base64.

---

### MED-6: Open redirect — `fromPath` URL param used as `href` without origin validation

**File:** `src/components/records/RecordView.tsx:409–416`

`/app/person/1?from=javascript:alert(1)` creates a clickable XSS link.

**Fix:**
```ts
const safeFromPath = fromPath?.startsWith('/') ? fromPath : null
```

---

### MED-7: Hydration mismatch — `window.innerWidth` in `useState` initializer

**File:** `src/components/query/RecordQuery.tsx:92–97`

Server renders one view mode, client may initialize another, causing React hydration warning.

**Fix:** Initialize from `preferences.tableDefaultViewMode`, apply mobile override in `useEffect`.

---

### MED-8: `goBack` in `useProcess` is client-only, not a server step submission

**File:** `src/lib/hooks/use-process.ts:341–355`

Server-side state is not rolled back. If the server expects a `_goBack` step, the process goes out of sync.

**Fix:** Submit `processStep(processName, processUUID, '_goBack', {})` and let server dictate `nextStep`.

---

### MED-9: Missing `useCallback` on `EntityForm.onSubmit`

**File:** `src/components/forms/EntityForm.tsx:195–197`

`onSubmit` re-created on every render, causing unnecessary re-renders of all form fields.

**Fix:** `const onSubmit = useCallback(async (values) => { await activeMutation.mutateAsync(values) }, [activeMutation])`

---

### MED-10: Unvalidated `JSON.parse` from localStorage in `getStoredUser`

**File:** `src/lib/auth/auth-provider.tsx:150–161`

**Fix:** Add type guard or schema validation.

---

### MED-11: `TOGGLE_COLUMN` initializes from `undefined` for never-toggled columns

**File:** `src/lib/hooks/use-record-query.ts:119–126`

`!undefined === true` means first toggle always shows column, losing the "default" state distinction.

**Fix:**
```ts
const currentVal = state.columnVisibility[action.fieldName] ?? true
return { ...state, columnVisibility: { ...state.columnVisibility, [action.fieldName]: !currentVal } }
```

---

### MED-12: Memory leak — column resize `mousemove`/`mouseup` listeners not removed on unmount

**File:** `src/components/query/DataGrid.tsx:231–253`

If `DataGrid` unmounts during a resize drag, the document event listeners remain.

**Fix:** Track active listeners in a `useRef`; clean them up in a `useEffect` cleanup.

---

### MED-13: Premature error state when `record` is undefined but `isError` is false

**File:** `src/components/records/RecordView.tsx:120–121`

```ts
if (isError || !record) { /* renders error UI */ }
```

Shows error flash before loading state.

**Fix:** Split: `if (isError) { ... }` then `if (!record && !isLoading) { ... }`.

---

### MED-14: Stateful regex in `HighlightedText` — `gi` flag causes incorrect `test()` after `split()`

**File:** `src/components/feedback/SearchDialog.tsx:31–47`

`split(regex)` advances `lastIndex`, making subsequent `regex.test(part)` calls unreliable.

**Fix:** Create a new regex for `test()`, or use `part.toLowerCase() === query.toLowerCase()`.

---

## LOW (8 findings)

- **LOW-1** `auth.ts:64` — Duplicate `clearAuthMetadataCache()` call (harmless)
- **LOW-2** `query-client.ts:55` — Widget cache key unstable with unordered `params` objects
- **LOW-3** `Sidebar.tsx:128` — Missing comment explaining intentional dep omission
- **LOW-4** `RecordView.tsx:37–44` — `getInitials('')` throws TypeError (empty label)
- **LOW-5** `DynamicFormField.tsx` — Unused `SelectField` import (dead code)
- **LOW-6** `RecordQuery.tsx:127–134` — `window.innerWidth` in callback not reactive to resize
- **LOW-7** `ExportButton.tsx:81–86` — Legacy DOM insertion pattern for file download trigger
- **LOW-8** `process-utils.ts`, `use-routes.ts` — Verify `hasPermission`/`readPermission` filtering for nav items

---

## Priority Order for Fixes

1. **CRIT-1, CRIT-2, CRIT-3** — Install DOMPurify, apply to all 4 HTML rendering sites
2. **CRIT-4, CRIT-5** — Auth stub implementations need proper server validation
3. **CRIT-6** — One-line fix: add `clearAuthMetadataCache()` to 401 callback
4. **HIGH-6** — One-line fix: re-throw non-404 errors in `globalSearch`
5. **HIGH-7** — Fix record selection to use stable PKs
6. **HIGH-8** — Fix retry button to call `invalidateQueries`
7. **CRIT-7** — Add error toast to `ExportButton`
8. **MED-6** — Validate `fromPath` starts with `/`
9. **HIGH-1** — Fix stale closures in `useRecordQuery` effects
10. Remaining HIGH/MED items by team priority
