# UI API 1.6 adoption

Adopts QQQ UI API 1.6.0 (QQQ 4.1.0-RC.15): table clientCapabilities, field validation, BasicErrorResponseV1, /qqq/v1/branding.

- Vendors the supplied core, api-aware, ESB, alerts, collaboration, data-analysis and EDI documents; regenerates EDI types. Assistant, quick-search, secured-data and sql-workbench documents are unchanged.
- Saved views, audits, sharing and bulk actions use per-user table capabilities. Legacy discovery is used only when `clientCapabilities` is absent; a missing or unavailable feature in a present capability object does not enable legacy access.
- Forms use `field.validation` for required values, length policies, inclusive/exclusive bounds and whole-value patterns. Existing record-write error mapping remains intact.
- Errors prefer `message` over legacy error fields. Global error toasts and process error details expose the trace identifier. Session-expiration handling remains in place.
- Standalone branding aliases call `/qqq/v1/branding/{role}` and retry the old public route only after a 404. Instance consumers prefer `supplementalInstanceMetaData.uiSettings`, with deprecated settings as a fallback.

The app version is unchanged. No commit, push, PR or deployment was made.

## Verification

The supplied server specification comparison passes at 1.6.0. `OFF_SPEC_CALLS` remains empty and `OFF_SPEC_CEILING` remains 0.

Vitest startup is blocked by this session's Windows sandbox (`spawn EPERM` launching esbuild), so no Vitest pass count is claimed. The production bundle compiles, but `pnpm build` stops at its TypeScript child-process launch with `spawn EPERM`; no completed build or bundle-budget delta is available. Standalone `pnpm typecheck` passes. `pnpm lint` passes with six pre-existing warnings. Twelve direct Node smoke checks pass: seven lossless JSON vendoring comparisons and five branding status/fallback cases. The focused contract/extension Vitest invocation and full `pnpm test` both stop before running tests.
