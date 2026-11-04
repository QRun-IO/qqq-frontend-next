# Record Files client integration

2026-10-30. Working branch `feat/record-files-client`, based on `ada9946eea643eed6e2c6edb42e2446a185761b4`. Original `qqq-frontend-next` checkout is unchanged. These changes are not committed or released.

## Implemented

- Attachment metadata now has independent optional `canEdit` and `canDelete`. The API normalizer and FilesTab fall back to the legacy deletion capability only if `canEdit` is absent; explicit false/null/malformed values deny editing. Retained files can therefore remain editable while deletion is denied. Server authorization remains authoritative.
- The generic lightbox accepts an optional asynchronous `onDownload` action. FilesTab supplies an adapter that calls the existing authorized attachment download API and navigates to its fresh URL. Pending/failure states are accessible. A refused action never falls back to the preview URL. Generic preview consumers retain their existing URL behavior and do not depend on Collaboration or Record Files.
- Script tests accept an AbortSignal and configurable waiting duration (five minutes by default, positive and at most 30 minutes). Cancellation propagates to the initial request, polling delay and in-flight status request. The test panel aborts observation when unmounted and offers Stop waiting. Messages explicitly say the server test may still be running; no server cancellation is claimed.
- The vendored optional `canEdit` schema matches the local server schema in `qbit-collaboration-wt-record-files/src/main/resources/openapi/qqq-v1/collaboration.yaml`. This coordinated server/client change must ship in backend-first order. Existing endpoint names and permissions are unchanged.

## Verification

- Nine focused component/API suites: **164 tests passed**. Includes permission separation/legacy fallback, authorized download failure, cancellation before start/during delay/during request, deadlines, component unmount and successful retry after stopping observation.
- UI API contract suite: **7 tests passed**.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed with **six pre-existing warnings in untouched files** (EntityForm, BrandedHeaderBar, BlockWidget, analytics/google, process-utils tests). Changed files separately passed ESLint with no warnings. License headers passed.
- Whitespace check passed with `git -c core.whitespace=cr-at-eol diff --check`, preserving the vendored JSON's existing CRLF format rather than rewriting the entire document.

Dependencies were installed from the existing local cache with the frozen lockfile and lifecycle scripts disabled. No dependency versions changed.

## Remaining scope

This is not the Record Files application or the full TypeScript IDE. It does not implement quarantine, collection capture/resumable uploads, record-file HTTP workflows, durable server audits, script compilation/isolation or draft/build/publish semantics. Legacy script save-process polling is unchanged; cancellation/deadline applies to script tests only.

The standard FilesTab download control now requests the authorized endpoint. Generic metadata-driven preview/download fields still require an explicit audited access contract from their owner; a reusable presigned URL cannot provide an audit event for every transfer without proxying or trusted storage telemetry. Open original remains a preview/open action. No UI event claims bytes were saved or a file was physically printed.

The independent review's broad unsandboxed PDF framing finding remains open. Browser/deployed end-to-end acceptance, production build/coverage matrix, storage/printer/scanner qualification and the final integrated security review remain release gates. No SESSION-STATE.md or TODO.md existed in this frontend baseline; this scoped note records the handoff.
