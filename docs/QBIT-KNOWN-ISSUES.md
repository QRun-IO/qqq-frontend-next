# QBit integration known issues

Updated: 2026-11-04. Unresolved at closeout.

- Requires the compatible Core, Scripting, Record Files and Document Generation APIs; a complete public backend/frontend cohort has not been demonstrated.
- Document/file acceptance through the UI and live UIUX API contract checking remain outstanding. Scanner manual acceptance is not evidence for these document UI flows.
- The existing build:export command uses a POSIX environment prefix and fails under Windows cmd. The equivalent existing sequence succeeded from bash; the command was not changed during this integration.
- Canonical Next 16.4.1 and Zod 3 were preserved. Newer dependency patches in the private client branch were not automatically imported; normal dependency/security review remains needed before release.
- Website-specific sequential-workflow features, unrelated presence/auth changes and a Zod 4 migration were intentionally excluded. Preserve the limited application scope during any future reconciliation.
- Generated PDF/TypeScript worker assets must be built before exporting. No UI JAR, release tag, deployment or final artifact version was produced by this checkpoint.
