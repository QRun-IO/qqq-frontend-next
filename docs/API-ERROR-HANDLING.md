# API Error Handling Guide

This document describes how API errors flow through the QQQ Frontend Next application and what, if anything, individual components need to do about them.

The short answer is: **most errors require no per-call handling**. The global error handler in the query client toasts an appropriate message automatically, and the 401 interceptor in the Axios client redirects to login. Individual components only need to add their own handling when the generic behavior is insufficient for a specific UX requirement.

---

## Architecture Overview

There are two independent error interception layers:

1. **Axios response interceptor** (`src/lib/api/client.ts`) — fires synchronously on every HTTP response before the promise settles. Handles 401 (unauthorized) only.
2. **TanStack Query global handlers** (`src/lib/query-client.ts`) — `QueryCache.onError` for reads, `MutationCache.onError` for writes. Fire after the interceptor. Handle all other errors by toasting a message.

```
API response
    │
    ▼
Axios interceptor
    │  401 → call unauthorizedCallback() → redirect to login
    │  all others → pass through as rejected promise
    ▼
TanStack Query cache (onError)
    │  401 → silently ignored (already handled)
    │  403 → toast "Permission denied" / "You do not have permission…"
    │  404 → toast "Resource not found"
    │  5xx → toast "Server error — retrying…" / "Server error — please try again"
    │  network → toast "Something went wrong"
    ▼
Component (optional per-query onError)
    │  Only needed when generic toast is wrong for the specific UX
```

---

## The 401 Interceptor

**Location:** `src/lib/api/client.ts`

The singleton `APIClient` registers a response interceptor that fires on every request:

```typescript
this.client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && this.unauthorizedCallback) {
      this.unauthorizedCallback()
    }
    return Promise.reject(error)  // always re-reject so TanStack Query also sees it
  }
)
```

The `unauthorizedCallback` is wired to the auth provider's logout/redirect function during initialization. When a 401 arrives:

1. The callback fires → clears auth state → redirects to the login page.
2. The error is still re-rejected, so TanStack Query's `onError` also fires.
3. The global handler in `query-client.ts` explicitly silences 401s to avoid a redundant toast on top of the redirect.

**Implication for components:** Never handle 401 in a component. The interceptor + auth provider handle it globally. Writing per-component 401 handling will race with the redirect and confuse users.

---

## The Global Query Error Handler

**Location:** `src/lib/query-client.ts` — `handleQueryError` function

```typescript
function handleQueryError(error: unknown, context: 'query' | 'mutation'): void {
  const status = getErrorStatusCode(error)

  if (status === 401) return   // handled by axios interceptor

  if (status === 403) {
    toast.error(
      context === 'mutation'
        ? 'You do not have permission to perform this action'
        : 'Permission denied'
    )
    return
  }

  if (status === 404) {
    toast.error('Resource not found')
    return
  }

  if (status !== undefined && status >= 500) {
    toast.error(
      context === 'mutation'
        ? 'Server error — please try again'
        : 'Server error — retrying…'
    )
    return
  }

  // Network failure or unexpected status
  toast.error('Something went wrong')
}
```

This handler is registered on both `QueryCache` and `MutationCache`:

```typescript
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleQueryError(error, 'query'),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleQueryError(error, 'mutation'),
  }),
})
```

**Implication for components:** For most queries and mutations, you do not need `onError` at all. The global handler covers toasting. Add per-query handling only when you need to do something the global handler cannot — such as mapping a 400 error's field messages back to form fields.

---

## Extracting the Status Code

**Location:** `src/lib/utils/error-utils.ts`

```typescript
import { getErrorStatusCode } from '@/lib/utils/error-utils'

const status = getErrorStatusCode(error)
```

`getErrorStatusCode` handles two shapes:
- `AxiosError` — reads `error.response?.status`
- Plain objects with a numeric `status` property (e.g. fetch-based wrappers)

Returns `undefined` for anything else (non-object errors, null, network failures with no response).

---

## Status-by-Status Guide

### 400 — Validation Error

The global handler does NOT toast on 400 because 400s typically carry field-level validation messages that must be mapped back to individual form fields. Handle 400 explicitly wherever you submit a form.

```typescript
import { getErrorStatusCode } from '@/lib/utils/error-utils'

const mutation = useMutation({
  mutationFn: (data: FieldValues) => saveRecord('order', data),
  onError: (error) => {
    if (getErrorStatusCode(error) === 400) {
      // Map backend validation messages to React Hook Form fields
      const fieldErrors = extractFieldErrors(error)  // your helper
      for (const [field, message] of Object.entries(fieldErrors)) {
        form.setError(field, { type: 'server', message })
      }
    }
    // Non-400 errors are already toasted by the global handler
  },
})
```

If a 400 arrives outside of a form context, add a toast yourself:

```typescript
onError: (error) => {
  if (getErrorStatusCode(error) === 400) {
    toast.error('Invalid request — please check your input')
  }
}
```

### 403 — Permission Denied

The global handler toasts a generic permission-denied message. If the 403 should instead silently hide an action (e.g. a button that should not appear for users without permission), suppress the default behavior by checking permissions from metadata before rendering rather than relying on the API to reject:

```typescript
// Preferred: hide the action before the user tries it
{tableMetaData.capabilities.includes('insert') && (
  <Button onClick={openCreateModal}>New Record</Button>
)}
```

If you need custom handling on a 403, use `onError` and call `toast` yourself — or do nothing if the generic toast is acceptable.

### 404 — Not Found

The global handler toasts "Resource not found". For record-view pages where 404 means the record was deleted, render an empty state instead:

```typescript
const { data: record, error } = useQuery({
  queryKey: queryKeys.tableRecord(tableName, recordId),
  queryFn: () => getRecord(tableName, recordId),
})

if (getErrorStatusCode(error) === 404) {
  return <EmptyState message="This record no longer exists" />
}
```

The global handler will also toast, which is acceptable — the empty state just provides additional UI context.

### 5xx — Server Error

The global handler toasts "Server error — retrying…" for queries and "Server error — please try again" for mutations. Queries are automatically retried up to 3 times with exponential back-off (1 s → 2 s → 4 s, max 30 s) before the error surfaces.

No additional per-component handling is needed for 5xx unless you want a custom retry UI or a structured error state for a specific page.

### Network Failure (no response)

Treated as non-4xx by the retry logic — queries retry up to 3 times. The global handler toasts "Something went wrong" after all retries are exhausted. No per-component handling needed for the common case.

---

## When to Add Per-Query Error Handling

Add `onError` to a specific `useQuery` or `useMutation` call when:

| Scenario | What to do |
|---|---|
| 400 with field-level validation messages | Map errors to form fields with `form.setError()` |
| 403 should render empty state instead of toast | Catch 403, render empty UI, call `toast` yourself if the global one also fires |
| 404 should render a structured empty state page | Check `getErrorStatusCode(error) === 404` and render `<EmptyState>` |
| Error should navigate away (e.g. deleted parent record) | `useRouter().push('/...')` in `onError` |
| The generic toast message is wrong for this specific action | Supply a custom `onError` that calls `toast.error(customMessage)` |

For all other cases, rely on the global handler and write no error-handling code in the component.

---

## Retry Behavior

The `smartRetry` function in `src/lib/query-client.ts` controls when TanStack Query retries:

```typescript
function smartRetry(failureCount: number, error: unknown): boolean {
  const status = getErrorStatusCode(error)
  // Never retry client errors — they are deterministic
  if (status !== undefined && status >= 400 && status < 500) return false
  // Retry server errors and network failures up to 3 times
  return failureCount < 3
}
```

Back-off schedule: 1 s → 2 s → 4 s, capped at 30 s.

4xx errors are never retried. There is no per-component way to opt into retrying 4xx errors — that would be intentional since a 400 with bad field data will not resolve itself on retry.

---

## Complete Example — Form with 400 Handling

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { saveRecord } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { getErrorStatusCode } from '@/lib/utils/error-utils'

export function EditOrderForm({ orderId, schema, defaultValues }: Props) {
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(schema), defaultValues })

  const mutation = useMutation({
    mutationFn: (data: FieldValues) => saveRecord('order', orderId, data),
    onSuccess: () => {
      // Invalidate so the record view refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecord('order', orderId) })
      toast.success('Order saved')
    },
    onError: (error) => {
      if (getErrorStatusCode(error) === 400) {
        // Map field errors from the server response body to form fields.
        // The global handler does NOT toast on 400, so we must do it here or
        // rely on inline field error messages in the form UI.
        const body = (error as AxiosError<{ errors: Record<string, string> }>).response?.data
        if (body?.errors) {
          for (const [field, message] of Object.entries(body.errors)) {
            form.setError(field, { type: 'server', message })
          }
        } else {
          toast.error('Please correct the highlighted fields')
        }
        return
      }
      // 401, 403, 404, 5xx, network — already toasted by the global handler
    },
  })

  return (
    <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
      {/* field components */}
    </form>
  )
}
```

---

## Quick Reference

| Layer | File | Handles |
|---|---|---|
| Axios interceptor | `src/lib/api/client.ts` | 401 → redirect to login |
| Global query handler | `src/lib/query-client.ts` | 403, 404, 5xx, network → toast |
| Per-component `onError` | Your component | 400 field errors, custom empty states, navigation |
| `getErrorStatusCode` | `src/lib/utils/error-utils.ts` | Normalize `AxiosError` and plain-object errors to HTTP status code |
