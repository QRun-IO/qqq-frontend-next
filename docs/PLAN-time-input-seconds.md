# Plan: TIME block seconds compatibility (#728)

Preserve Next layout while making standalone and process TIME inputs accept and submit seconds, matching the shared form editor and QQQ TIME values.

1. Reproduce native step validation failure with standalone and process tests; retain a regular form control.
2. Apply the existing one-second input step to both plain block paths.
3. Verify edited/seeded values through actual Chromium workflows, including backend process readback; run affected tests and relevant quality gates.
4. Keep this follow-up separate from the unchanged RC6 candidate while its hosted CI runs.

Verification: two focused component regressions failed before the fix (regular form control passed); three real-backend Chromium scenarios failed at native step assertions. After the two-line correction, all 66 affected component tests and eight desktop/mobile backend workflows passed, including independent SQL checks. Full unit suite, type/lint, production build and budgets passed. This is isolated follow-up work, not part of RC6 candidate `7ddf45f`.
