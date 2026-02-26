# QQQ Admin UI Coding Conventions

This document establishes the foundational coding standards for the QQQ Admin UI modernization. All implementation agents must follow these conventions strictly to ensure consistency, maintainability, and compatibility across the codebase.

---

## Server Components vs Client Components

**Context:** The new UI will use Next.js App Router, which supports both Server Components (default) and Client Components.

### Server Components (Default in App Router)

Use Server Components for:
- Route pages (`page.tsx` files) that fetch metadata, layout wrappers, and static content
- Components that access server-side resources (databases, private APIs, files)
- Authentication checks and permission gating
- Data that doesn't require client-side interactivity

**Characteristics:**
- No JavaScript shipped to client for these components
- Can directly query databases, call private APIs, and access secrets
- Cannot use hooks (useState, useEffect, useContext)
- Cannot use browser APIs (window, localStorage, DOM events)
- Reduces initial bundle size and improves Time to Interactive

**Example:**
```typescript
// app/records/page.tsx - Server Component
import { fetchMetadata, fetchRecords } from "@/lib/api";
import RecordGrid from "@/components/RecordGrid";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { table: string };
}) {
  const tableMetadata = await fetchMetadata(searchParams.table);
  const records = await fetchRecords(searchParams.table);

  return <RecordGrid metadata={tableMetadata} records={records} />;
}
```

### Client Components (`"use client"`)

Use Client Components for:
- Any component with `useState`, `useEffect`, `useReducer`, or other hooks
- Any component with `onClick`, `onChange`, form handlers, or user events
- Components using `useContext`, `useQuery`, `useMutation`, or custom hooks
- Data grids, forms, modals, dropdowns—any interactive UI

**Characteristics:**
- Include `"use client"` directive at top of file
- Ship JavaScript to client (included in bundle)
- Can use React hooks and browser APIs
- Can subscribe to context and use custom hooks
- Most QQQ components will be Client Components

**Boundary Pattern:**
```typescript
// page.tsx - Server Component fetches data
export default async function Page({ params }) {
  const data = await fetchServerData(params.id);
  return <ClientComponent initialData={data} />;
}

// components/ClientComponent.tsx - Client Component handles interaction
"use client";
import { useState } from "react";

export default function ClientComponent({ initialData }) {
  const [state, setState] = useState(initialData);
  return <div onClick={() => setState(...)}>{state}</div>;
}
```

**Decision Tree:**
- Does this component use hooks (useState, useEffect, useContext)? → Client Component
- Does this component have onClick, onChange, or other event handlers? → Client Component
- Is this a layout wrapper or data-fetching shell? → Consider Server Component
- Does this component render other Client Components? → Can be Server Component
- Does this component need browser APIs? → Client Component

---

## State Management Approach

QQQ's state management uses multiple complementary patterns depending on scope and lifecycle.

### TanStack Query for Server State

Use **TanStack Query** (`react-query` or `@tanstack/react-query`) for all server-side data:
- API responses (metadata, records, counts)
- Asynchronous data fetching with loading/error states
- Automatic caching and invalidation
- Optimistic updates
- Background refetching

**Read Data Pattern (useQuery):**
```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export default function RecordList({ tableName }: { tableName: string }) {
  const { data: records, isLoading, error } = useQuery({
    queryKey: ["table", tableName, "query"],
    queryFn: () => api.query(tableName, filter),
    staleTime: 30 * 1000, // 30 seconds
  });

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;
  return <Grid records={records} />;
}
```

**Mutate Data Pattern (useMutation):**
```typescript
"use client";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

export default function CreateButton() {
  const createMutation = useMutation({
    mutationFn: (values) => api.create(tableName, values),
    onSuccess: (newRecord) => {
      // Invalidate list to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ["table", tableName, "query"],
      });
    },
  });

  return (
    <button onClick={() => createMutation.mutate(formValues)}>
      {createMutation.isPending ? "Saving..." : "Create"}
    </button>
  );
}
```

**Configuration:**
```typescript
// lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### React Context for Global UI State

Use **React Context** for application-wide UI state that doesn't need server persistence:
- Current theme (light/dark mode)
- Sidebar open/closed state
- Modal stack (which modals are open)
- Authenticated user info
- UI layout preferences (density, sidebar width)

**Example:**
```typescript
// context/ThemeContext.tsx
"use client";
import { createContext, useContext, useState } from "react";

const ThemeContext = createContext<{
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
} | null>(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

### React Hook Form for Form State

Use **React Hook Form** for all form state management:
- Field values, dirty tracking, validation state
- Integrates with Zod schemas for validation
- Minimal re-renders
- Efficient field-level updates
- Built-in submit handling

**Example:**
```typescript
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email(),
});

export default function RecordForm({ initialValues }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name")} />
      {errors.name && <span>{errors.name.message}</span>}
      <button disabled={!isDirty}>Save</button>
    </form>
  );
}
```

### URL SearchParams for Shareable State

Use **URL search parameters** for state that should be shareable and bookmarkable:
- Table filters, sort order, pagination
- View/variant selection
- Record ID (current record being viewed)
- Tab/section selection

**Example:**
```typescript
"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function RecordTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1");
  const filter = searchParams.get("filter");

  const handleSort = (field: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", field);
    params.set("page", "1"); // Reset to page 1
    router.push(`?${params.toString()}`);
  };

  return <Grid onSort={handleSort} />;
}
```

### localStorage for User Preferences

Use **localStorage** for persistent user preferences (not synced to server):
- Column widths and ordering
- UI density (compact/normal/spacious)
- Sidebar width
- Last selected view per table
- Expanded/collapsed section preferences

**Example:**
```typescript
"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "qqq-table-column-widths";

export function useColumnWidths(tableId: string) {
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    // Hydrate from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const all = JSON.parse(stored);
      setWidths(all[tableId] ?? {});
    }
  }, [tableId]);

  const updateWidth = (fieldName: string, width: number) => {
    const updated = { ...widths, [fieldName]: width };
    setWidths(updated);

    // Persist to localStorage
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    all[tableId] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  return { widths, updateWidth };
}
```

---

## Error Handling Patterns

### API Errors: TanStack Query Error States

Errors from API calls are automatically caught by TanStack Query. Always display feedback:

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";

export default function RecordList({ tableName }) {
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["table", tableName],
    queryFn: () => api.query(tableName, {}),
  });

  if (isError) {
    return (
      <Alert severity="error">
        Failed to load records: {error instanceof Error ? error.message : "Unknown error"}
      </Alert>
    );
  }

  if (isLoading) return <Skeleton />;
  return <Grid records={data} />;
}
```

### Form Validation: Zod + React Hook Form

Validation errors are tied to fields and displayed inline:

```typescript
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  age: z.number().min(18, "Must be 18+"),
});

export default function Form() {
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register("name")}
        placeholder="Name"
        error={!!errors.name}
        helperText={errors.name?.message}
      />
      <Input
        {...register("email")}
        placeholder="Email"
        error={!!errors.email}
        helperText={errors.email?.message}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Route Errors: Next.js error.tsx Boundary

Each route segment can have an `error.tsx` file that creates an error boundary:

```typescript
// app/records/[id]/error.tsx
"use client";

export default function RecordError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold mb-4">Error Loading Record</h2>
      <p className="text-red-600 mb-4">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-500 text-white">
        Try Again
      </button>
    </div>
  );
}
```

### Widget Errors: ErrorBoundary Component

Wrap interactive components that may fail in an error boundary:

```typescript
"use client";
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <p className="font-bold">Failed to load widget</p>
      <p className="text-sm text-gray-600">{error.message}</p>
      <button onClick={resetErrorBoundary} className="mt-2 text-blue-600 underline">
        Reload
      </button>
    </div>
  );
}

export default function WidgetContainer() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <MyWidget />
    </ErrorBoundary>
  );
}
```

### 401 Handling: Axios Interceptor

Set up a global interceptor to catch 401 responses and redirect to login:

```typescript
// lib/axiosInstance.ts
import axios from "axios";
import { useRouter } from "next/navigation";

export function setupAxios(router: ReturnType<typeof useRouter>) {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const returnTo = encodeURIComponent(window.location.pathname);
        router.push(`/login?returnTo=${returnTo}`);
      }
      return Promise.reject(error);
    }
  );
}
```

### General Rule

Never swallow errors silently. Always surface them to the user via one of: Alert component, toast notification, field-level error, or error page.

---

## Tailwind Class Ordering Convention

Follow the official **Tailwind CSS IntelliSense** convention for class ordering:
`Position → Display → Sizing → Spacing → Typography → Visual → Animation`

**Example:**
```html
<div class="relative flex w-full p-4 text-sm font-medium text-gray-900 bg-white border rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
  Content
</div>
```

**Breakdown:**
- `relative` — Position
- `flex` — Display
- `w-full` — Sizing
- `p-4` — Spacing
- `text-sm font-medium text-gray-900` — Typography
- `bg-white border rounded-lg shadow-sm` — Visual
- `hover:bg-gray-50 transition-colors` — Animation/Interaction

**Multi-line (for long class lists):**
```tsx
<button
  className={cn(
    // Position & Display
    "relative inline-flex items-center justify-center",
    // Sizing
    "w-full px-4 py-2",
    // Typography
    "text-sm font-medium text-white",
    // Visual
    "bg-blue-600 border border-blue-700 rounded-lg shadow-sm",
    // Interaction
    "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    // Animation
    "transition-colors duration-200"
  )}
>
  Click Me
</button>
```

---

## Accessibility Requirements

All QQQ components must meet **WCAG 2.1 AA** standards minimum:

### Form Inputs and Labels

- Every form input must have an associated label
- Use `htmlFor` to link labels to inputs by ID
- For icon-only buttons, use `aria-label`

```typescript
<label htmlFor="name-input">Name:</label>
<input id="name-input" type="text" />

<button aria-label="Delete record" title="Delete record">
  <TrashIcon />
</button>
```

### Keyboard Navigation

- All interactive elements (buttons, links, inputs) must be reachable via Tab key
- Tab order should follow visual left-to-right, top-to-bottom flow
- Escape key should close modals
- Enter/Space should activate buttons

```typescript
<input type="text" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
<Modal onEscapePress={closeModal} />
```

### Focus Visibility

- All interactive elements must have visible focus rings
- Use Tailwind's `focus:ring-2 focus:ring-offset-2 focus:ring-blue-500` pattern
- Never remove focus rings without providing an alternative

```html
<button class="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
  Click
</button>
```

### ARIA Attributes

- Use `aria-label` on icon buttons (e.g., `<button aria-label="Close">×</button>`)
- Use `aria-live="polite"` for dynamic content updates
- Use `aria-expanded` for collapsible sections
- Use `aria-disabled` for disabled elements
- Use `aria-hidden="true"` for decorative icons

```typescript
<button
  aria-label="Toggle sidebar"
  aria-expanded={sidebarOpen}
  onClick={toggleSidebar}
>
  <MenuIcon />
</button>

<div aria-live="polite" aria-atomic="true">
  {message}
</div>
```

### Color Contrast

- Minimum 4.5:1 contrast ratio for normal text (14px or smaller)
- Minimum 3:1 contrast ratio for large text (18px+ or 14px+ bold)
- Never rely on color alone to convey meaning (always add icon/text)

Use tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to verify.

### Images and Icons

- All images must have meaningful alt text or `aria-hidden="true"` if decorative
- SVG icons should have a title element or aria-label on parent

```tsx
<img src="avatar.jpg" alt="User: John Doe" />
<svg aria-label="Star" className="w-5 h-5">
  <title>Star icon</title>
  <path d="..." />
</svg>
```

---

## data-qqq-id Naming Convention

All QQQ components must include `data-qqq-id` attributes for:
- Automated testing (selector stability)
- Custom CSS injection via `customCss` metadata
- Accessibility tooling integration

**Pattern:** `{component-type}-{metadata-name}`

Where `{metadata-name}` is the `name` property from the metadata object (not the `label`).

### Examples by Component Type

**Navigation:**
```html
<nav data-qqq-id="sidebar-nav">
  <button data-qqq-id="sidebar-item-employees">Employees</button>
  <button data-qqq-id="sidebar-item-projects">Projects</button>
</nav>
```

**Fields (Forms and Grids):**
```html
<label htmlFor="field-email" data-qqq-id="field-label-email">Email</label>
<input id="field-email" data-qqq-id="field-email" type="email" />

<th data-qqq-id="grid-header-email">Email</th>
<td data-qqq-id="grid-cell-email">user@example.com</td>
```

**Buttons:**
```html
<button data-qqq-id="button-create">Create Record</button>
<button data-qqq-id="button-save">Save</button>
<button data-qqq-id="button-delete">Delete</button>
<button data-qqq-id="button-cancel">Cancel</button>
```

**Filters:**
```html
<div data-qqq-id="filter-row-0">
  <select data-qqq-id="filter-field-0">Field</select>
  <select data-qqq-id="filter-operator-0">Operator</select>
  <input data-qqq-id="filter-value-0" type="text" />
</div>
```

**Widgets:**
```html
<section data-qqq-id="widget-salesChart">
  <h3 data-qqq-id="widget-label-salesChart">Sales Chart</h3>
  <canvas data-qqq-id="widget-content-salesChart"></canvas>
</section>
```

**General Rule:** If metadata has a `name: "employeeId"`, use `data-qqq-id="field-employeeId"` or `data-qqq-id="grid-header-employeeId"`, never `data-qqq-id="field-Employee ID"` or `data-qqq-id="field-employee_id"`.

---

## QQQ Theme Token System

The application defines **60+ CSS custom properties** in `src/styles/qqq-theme.css` for theming and customization.

### Core Color Tokens

```css
:root {
  /* Primary & Accent */
  --qqq-primary-color: #1976d2;
  --qqq-secondary-color: #9c27b0;
  --qqq-accent-color: var(--qqq-primary-color); /* From QBrandingMetaData.accentColor */
  --qqq-success-color: #4caf50;
  --qqq-warning-color: #ff9800;
  --qqq-error-color: #f44336;
  --qqq-info-color: #2196f3;
}
```

### Sidebar Tokens

```css
:root {
  --qqq-sidebar-background: #1e293b; /* Dark slate */
  --qqq-sidebar-text: #e2e8f0; /* Light text */
  --qqq-sidebar-hover: rgba(255, 255, 255, 0.1);
  --qqq-sidebar-active: var(--qqq-accent-color);
  --qqq-sidebar-border: #334155;
}
```

### Table/Grid Tokens

```css
:root {
  --qqq-grid-header-bg: #f8fafc; /* Light gray header */
  --qqq-grid-row-hover: #f1f5f9;
  --qqq-grid-border: #e2e8f0;
  --qqq-grid-text: #1e293b;
  --qqq-grid-text-muted: #64748b;
}
```

### Dark Mode Overrides

```css
[data-theme="dark"] {
  --qqq-grid-header-bg: #1e293b;
  --qqq-grid-row-hover: #334155;
  --qqq-grid-border: #475569;
  --qqq-grid-text: #f1f5f9;
  --qqq-grid-text-muted: #cbd5e1;
}
```

### Usage in Components

Reference these tokens via CSS custom properties in Tailwind or inline styles:

```tsx
// In Tailwind (configure in tailwind.config.ts)
<div className="bg-[var(--qqq-primary-color)] text-[var(--qqq-sidebar-text)]">
  Content
</div>

// Or in inline styles
<div style={{ color: "var(--qqq-accent-color)" }}>
  Content
</div>
```

**Tailwind Config Integration:**
```typescript
// tailwind.config.ts
export default {
  theme: {
    colors: {
      qqq: {
        primary: "var(--qqq-primary-color)",
        secondary: "var(--qqq-secondary-color)",
        accent: "var(--qqq-accent-color)",
      },
    },
  },
};
```

---

## How to Handle QQQ customCss

QQQ allows backend to inject custom CSS via the `customCss` metadata field. The mechanism:

1. **Backend provides CSS:** Custom CSS rules are defined targeting `[data-qqq-id="..."]` selectors
2. **Frontend injects dynamically:** Create a `<style>` tag in the document head and insert the CSS
3. **All components must have data-qqq-id:** Without these identifiers, custom selectors won't match

### Implementation

```typescript
// hooks/useCustomCSS.ts
"use client";
import { useEffect } from "react";

export function useCustomCSS(customCss: string | undefined) {
  useEffect(() => {
    if (!customCss) return;

    // Create or update style tag
    let styleTag = document.getElementById("qqq-custom-css");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "qqq-custom-css";
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = customCss;

    return () => {
      // Keep style tag in DOM (don't remove on unmount)
      // Custom CSS should persist for the session
    };
  }, [customCss]);
}
```

### Example Backend-Provided CSS

```css
/* From backend customCss field */
[data-qqq-id="field-salary"] {
  font-weight: bold;
  color: #2e7d32;
}

[data-qqq-id="button-delete"] {
  background-color: #d32f2f !important;
}

[data-qqq-id="grid-header-status"] {
  background-color: #1976d2 !important;
  color: white;
}
```

### Best Practices

- Always include `!important` in custom CSS (to override component styles)
- Selectors should use exact `data-qqq-id` matches, not partial/complex selectors
- Never allow inline `style` attributes from backend (XSS vulnerability)
- Validate custom CSS syntax and length before injection
- Log any CSS injection errors to console for debugging

---

## Mock API Layer (MSW)

A full **MSW (Mock Service Worker) v2** mock is implemented at `src/mocks/`. It intercepts all `/qqq/v1/*` requests and returns realistic fixture data, enabling frontend development with no backend required.

### Activating the Mock

```bash
cp .env.mock .env.local && pnpm dev
# OR
NEXT_PUBLIC_MOCK_API=true pnpm dev
```

### Mock Data Available

| App | Table | Records |
|-----|-------|---------|
| CRM | `person` (People) | 25 |
| CRM | `company` (Companies) | 10 |
| CRM | `order` (Orders) | 20 |
| Inventory | `product` (Products) | 15 |
| Inventory | `supplier` (Suppliers) | 8 |

Auth type is `FULLY_ANONYMOUS` — the app auto-sessions with no login interaction.

Dashboard widgets: 4 statistics tiles, bar chart, line chart, record grid.

### Adding Handlers for New Packages

When a new package introduces new API endpoints (e.g., a new process, a new widget type), **add a corresponding handler** in `src/mocks/handlers/`. The existing handlers show the pattern:

```
src/mocks/handlers/
├── auth.ts           # /metaData/authentication, /manageSession, /logout
├── metadata.ts       # /metaData, /metaData/table/:name, /metaData/process/:name
├── tables.ts         # /table/:name/query|count|:pk (full CRUD, in-memory store)
├── processes.ts      # /processes/:name/init|step|status|cancel
├── widgets.ts        # /widget/:widgetName
├── possible-values.ts
└── index.ts          # combines all handlers
```

In-memory mutations (POST/PUT/DELETE) persist within the browser session and reset on reload.

### Vitest Integration

The MSW node server is wired into the Vitest setup (`tests/setup.ts`). Unit tests automatically intercept API calls — no real network requests are made.

---

## Summary

These conventions ensure:
- **Consistency:** All code follows the same patterns
- **Type Safety:** Full TypeScript coverage with strict mode
- **Maintainability:** Shared understanding of architecture and patterns
- **Accessibility:** WCAG 2.1 AA compliance across all components
- **Customizability:** Custom CSS injection, theming, and metadata-driven UI
- **Performance:** Strategic use of Server Components, TanStack Query caching, and code splitting

Every implementation agent must adhere to these standards. Deviations require explicit justification and team consensus.
