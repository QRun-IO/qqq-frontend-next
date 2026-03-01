# Form Validation

This guide covers how forms are validated in QQQ Frontend Next. Validation is schema-driven: Zod schemas are generated automatically from the same backend field metadata that drives rendering, so there is no need to maintain a separate validation definition alongside the form.

---

## Overview

The validation stack is:

- **Zod** — runtime schema definition and validation.
- **React Hook Form** + `@hookform/resolvers/zod` — drives form state; the Zod schema is passed as the resolver.
- **`zodFieldFromMetadata`** — the core function that maps a single `QFieldMetaData` to a Zod validator.
- **`zodSchemaFromTableMetadata`** — builds a full `z.ZodObject` from all editable fields in a table.
- **`zodSchemaFromFields`** — builds a `z.ZodObject` from a flat array of fields (used for process steps).

The source for the schema generation utilities is `src/lib/utils/zod-from-metadata.ts`.

---

## Schema generation

### For table-based forms

`EntityForm` (`src/components/forms/EntityForm.tsx`) builds its schema on mount:

```tsx
const schema = useMemo(
  () => zodSchemaFromTableMetadata(tableMetaData, fieldNamesToInclude),
  [tableMetaData, fieldNamesToInclude]
)

const { register, control, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  defaultValues: mergedDefaults,
})
```

`zodSchemaFromTableMetadata` iterates the table's fields, skips hidden (`isHidden`) and non-editable (`!isEditable`) fields, and calls `zodFieldFromMetadata` for each remaining field:

```tsx
export function zodSchemaFromTableMetadata(
  tableMetaData: QTableMetaData,
  fieldNamesToInclude?: string[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const fieldName of fieldsToProcess) {
    const field = tableMetaData.fields[fieldName]
    if (!field) continue
    if (field.isHidden) continue
    if (!field.isEditable) continue
    shape[fieldName] = zodFieldFromMetadata(field)
  }

  return z.object(shape)
}
```

When `fieldNamesToInclude` is provided, only those fields are included. This is useful for partial-edit dialogs or multi-step wizards where only a subset of fields are shown per step.

### For process step forms

Process steps receive an ordered array of fields rather than a table metadata object. Use `zodSchemaFromFields`:

```tsx
import { zodSchemaFromFields } from '@/lib/utils/zod-from-metadata'

const schema = zodSchemaFromFields(stepFields) // QFieldMetaData[]
```

Hidden fields are excluded automatically. The resulting schema shape is identical to the table-based variant.

### For single fields

Call `zodFieldFromMetadata` directly when you need the Zod type for a single field:

```tsx
import { zodFieldFromMetadata } from '@/lib/utils/zod-from-metadata'

const fieldSchema = zodFieldFromMetadata(tableMetaData.fields['email'])
```

---

## Field type to Zod type mapping

The table below shows exactly how each QQQ field type is converted. All mappings are implemented in `zodFieldFromMetadata`.

| QQQ field type | Zod type (required) | Zod type (optional) | Notes |
|---|---|---|---|
| `STRING` | `z.string().min(1, ...)` | `z.string().optional()` | `maxLength` adds `.max()` when set |
| `TEXT` | `z.string().min(1, ...)` | `z.string().optional()` | Same as STRING |
| `HTML` | `z.string().min(1, ...)` | `z.string().optional()` | Same as STRING |
| `PASSWORD` | `z.string().min(1, ...)` | `z.string().optional()` | Same as STRING |
| `INTEGER` | `z.coerce.number().int(...)` | `z.union([z.literal(''), z.coerce.number().int(...)]).optional()` | Empty `<input type="number">` submits `""` |
| `LONG` | `z.coerce.number().int(...)` | `z.union([z.literal(''), z.coerce.number().int(...)]).optional()` | Same as INTEGER |
| `DECIMAL` | `z.coerce.number(...)` | `z.union([z.literal(''), z.coerce.number(...)]).optional()` | No `.int()` — allows fractional values |
| `BOOLEAN` | `z.boolean().optional()` | `z.boolean().optional()` | Always optional — checkboxes are never "required" |
| `DATE` | `z.string().min(1, ...)` | `z.string().optional()` | HTML date inputs submit ISO-8601 strings |
| `TIME` | `z.string().min(1, ...)` | `z.string().optional()` | Same as DATE |
| `DATE_TIME` | `z.string().min(1, ...)` | `z.string().optional()` | Same as DATE |
| `BLOB` | `z.union([z.instanceof(File), z.string()]).optional()` | same | Accepts File objects or existing URL strings |

### Why numbers use `z.literal('')` in the optional case

An `<input type="number">` submits an empty string (`""`) when left blank, not `null` or `undefined`. A plain `z.coerce.number()` would coerce `""` to `0`, silently making an empty field appear as zero. The `z.union([z.literal(''), schema])` pattern allows the empty string to pass through as-is so the form can distinguish "nothing entered" from "zero entered".

### Why dates stay as strings

Date and time values come from `<input type="date">` and `<input type="datetime-local">` as ISO-8601 strings (`"2026-03-01"`, `"2026-03-01T14:30"`). The schema validates them as strings. Any coercion to JavaScript `Date` objects — if required by the API — happens in the submit handler, not in the Zod schema.

---

## Required vs optional

The `isRequired` flag on `QFieldMetaData` is the single source of truth for whether a field is required:

- **`isRequired: true`** → `.min(1, "${label} is required")` for string types; plain `z.coerce.number()` for numeric types (empty string fails coercion).
- **`isRequired: false` or absent** → `.optional()` for string types; `z.union([z.literal(''), ...]).optional()` for numeric types.

All error messages use the human-readable `field.label` (not `field.name`), so they read naturally in the UI: `"First Name is required"`, not `"firstName is required"`.

---

## Number bounds

When a field's metadata declares `minValue` or `maxValue`, those bounds are applied to the Zod schema:

```tsx
function buildNumberSchema(isRequired, label, isInteger, minValue, maxValue) {
  let schema = isInteger
    ? z.coerce.number().int(`${label} must be a whole number`)
    : z.coerce.number({ message: `${label} must be a number` })

  if (minValue !== undefined && minValue !== null) {
    schema = schema.min(Number(minValue), `${label} must be at least ${minValue}`)
  }
  if (maxValue !== undefined && maxValue !== null) {
    schema = schema.max(Number(maxValue), `${label} must be at most ${maxValue}`)
  }
  // ...
}
```

The bounds come directly from metadata — no hardcoded ranges exist in the frontend. `DynamicFormField` also forwards `minValue` and `maxValue` as HTML attributes (`min`, `max`) on `<NumberField>` so the browser provides native range feedback, but Zod is the authoritative validator on submit.

---

## String length constraints

`maxLength` from field metadata maps to Zod's `.max()`:

```tsx
function buildStringSchema(isRequired, label, maxLength) {
  let schema = z.string()
  if (isRequired) schema = schema.min(1, `${label} is required`)
  if (maxLength) schema = schema.max(maxLength, `${label} must be at most ${maxLength} characters`)
  return isRequired ? schema : schema.optional()
}
```

`DynamicFormField` also passes `maxLength` to `<TextField>` as an HTML `maxlength` attribute, providing in-browser character limiting, but the Zod schema validates the constraint on submit as well.

---

## Default values

`defaultValuesFromRecord` (`src/lib/utils/zod-from-metadata.ts`) builds the `defaultValues` object for `useForm`:

```tsx
export function defaultValuesFromRecord(
  tableMetaData: QTableMetaData,
  recordValues: Record<string, unknown>
): Record<string, unknown>
```

For each editable, visible field it applies this priority:
1. Use the record value (from the API response), with type coercion:
   - `DATE`, `TIME`, `DATE_TIME` → `String(value)` (ISO-8601 string for the HTML input).
   - `BOOLEAN` → `Boolean(value)`.
   - All other types → value as-is.
2. Fall back to `field.defaultValue` from metadata.
3. Fall back to `false` for `BOOLEAN` fields.
4. Fall back to `''` (empty string) for everything else.

`EntityForm` calls this inside `useMemo` and passes the result to `useForm({ defaultValues })`. When the record changes (e.g., navigating between records), the form is reset via `reset(defaultValuesFromRecord(...))` in a `useEffect`.

---

## Client vs server validation

### Client-side (Zod)

Zod runs on the client when the user submits the form. React Hook Form calls the Zod resolver, collects all field errors, and populates `formState.errors`. Fields display their error messages inline — `DynamicFormField` renders a `<p role="alert">` with `id="${fieldId}-error"` below each failing input, and the input gains `aria-invalid="true"` and `aria-describedby` pointing at the error element.

```tsx
{fieldError && (
  <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive" role="alert">
    {fieldError.message}
  </p>
)}
```

### Server-side (API)

The backend can return validation errors after a save attempt. `EntityForm` handles this via TanStack Query mutation `onError` callbacks. Currently, API errors are shown as a top-level error banner rather than per-field:

```tsx
const insertMutation = useMutation({
  mutationFn: (values) => insertRecord(tableMetaData.name, values),
  onError: (err: Error) => {
    toast.error(`Failed to create ${tableMetaData.label}: ${err.message}`)
  },
})
```

When the API returns structured per-field errors (a map of `{ fieldName: errorMessage }`), map them to React Hook Form using `form.setError`:

```tsx
onError: (err) => {
  const fieldErrors = parseApiFieldErrors(err)
  if (fieldErrors) {
    for (const [fieldName, message] of Object.entries(fieldErrors)) {
      form.setError(fieldName, { type: 'server', message })
    }
  } else {
    toast.error(err.message)
  }
}
```

This makes server validation errors appear in the same inline error elements as client-side Zod errors, giving the user a consistent experience.

---

## DynamicFormField dispatch

`DynamicFormField` (`src/components/forms/DynamicFormField.tsx`) is the component that renders a single field inside a metadata-driven form. It dispatches to a typed input component based on field properties in this priority order:

1. **`field.possibleValueSourceName` is set** → `<PossibleValueSelect>` (async combobox).
2. **`FILE_UPLOAD` adornment or `BLOB` type** → `<FileUploadField>`.
3. **`field.type` switch** → one of `TextField`, `NumberField`, `BooleanField`, `DateField`, `DateTimeField`, `PasswordField`, or inline `<textarea>` (TEXT), `<RichTextField>` (HTML), `<input type="time">` (TIME).
4. **Default case** → `<TextField>` (treats unknown types as plain text).

Hidden fields (`isHidden: true`) and non-editable fields return `null` immediately.

### Dirty field indicator

When a field's value has changed from its default, `DynamicFormField` wraps the input in a left-border accent:

```tsx
function DirtyWrapper({ isDirty, children }) {
  if (!isDirty) return <>{children}</>
  return (
    <div className="border-l-2 border-primary pl-2">
      {children}
    </div>
  )
}
```

The `isDirty` prop comes from `formState.dirtyFields[fieldName]` in `EntityForm`, which passes the full `dirtyFields` map to `DynamicForm`, which passes each field's individual dirty state to `DynamicFormField`.

---

## Adding custom Zod refinements

The generated schemas cover all constraints that can be expressed in QQQ field metadata. When you need a validation rule that metadata cannot express (for example, cross-field validation or a format check), add a `.superRefine()` or `.refine()` on the schema returned by `zodSchemaFromTableMetadata`:

```tsx
// In the component that builds the form
const baseSchema = zodSchemaFromTableMetadata(tableMetaData)

const schema = baseSchema.superRefine((values, ctx) => {
  // Cross-field: end date must be after start date
  if (values.startDate && values.endDate && values.endDate < values.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'End date must be after start date',
    })
  }
})
```

Prefer `.superRefine()` over `.refine()` when you need to report the error on a specific field path rather than at the root of the object, so React Hook Form can display it inline next to the correct input.

---

## Complete example

### Field metadata (from the API)

```json
{
  "name": "quantity",
  "label": "Quantity",
  "type": "INTEGER",
  "isRequired": true,
  "isEditable": true,
  "isHidden": false,
  "minValue": 1,
  "maxValue": 9999
}
```

### Generated Zod schema for this field

`zodFieldFromMetadata` produces:

```ts
z.coerce.number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(9999, "Quantity must be at most 9999")
```

Because `isRequired` is `true`, this is the final schema (no `z.literal('')` union wrapping). An empty `<input type="number">` submits `""`, `z.coerce.number()` coerces that to `NaN`, and `NaN` fails the `.int()` check — so the required constraint is enforced implicitly.

### Full table schema (example)

```ts
const schema = zodSchemaFromTableMetadata(orderTableMetaData)
// Produces:
z.object({
  customerId: z.string().min(1, 'Customer is required'),   // STRING, required
  quantity:   z.coerce.number().int(...).min(1).max(9999), // INTEGER, required
  notes:      z.string().optional(),                       // TEXT, optional
  shipDate:   z.string().optional(),                       // DATE, optional
  isRush:     z.boolean().optional(),                      // BOOLEAN, always optional
})
```
