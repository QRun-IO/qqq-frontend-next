# Metadata-driven process result fields

`ViewFormComponent` delegates adorned result fields to the shared `FieldValue` component. Hidden fields remain in the result value map so native metadata can supply display companions; they are not rendered as separate controls. Ordinary process values and validation errors keep their existing behavior.

`LINK` supports either `toRecordFromTable` (a static table name) or `toRecordFromTableField` (the name of another result field containing the table name). The field value is the record identity. Navigation uses the native encoded table/record route. A missing companion table produces no link. Possible-value sources that identify a known instance table also retain native record navigation.

`FILE_DOWNLOAD` can specify `fileNameField` and `deliveryModeField`. If the latter is present, its companion value must be `SIGNED_URL` or `AUTHENTICATED_FETCH`; missing or unknown modes render no access action. Older fields without that metadata retain their existing behavior.

For `AUTHENTICATED_FETCH`, the issued URL is never placed in an `href`, image source or iframe. Download uses the shared authenticated transfer helper, which checks the configured origin, response bounds, exact digest/length and completed durable receipt. An additional `FILE_PREVIEW` adornment enables an explicit preview action. Only verified PDF/raster blobs reach the shared preview component; component-owned blob URLs are revoked when closed or unmounted. Unsupported content and transfer/audit errors remain visible and never fall back to direct access.

`CODE_EDITOR` result fields use the shared read-only source display, including renderer-supplied plain catalog help and HTML/JSON examples. No template or script evaluation occurs in a process result.

Verification for this increment: 178 focused tests across 18 files, owned ESLint and the explicit build-compiler typecheck passed. Each actual transfer creates a fresh correlation UUID only after validating the configured endpoint, preserving the immutable file coordinate and using that same fresh attempt for its receipt. Source changes and unmount abort active body/receipt work. Final integrated production-build/browser acceptance remains pending. These generic components do not embed a QBit name or depend on its backend implementation.
