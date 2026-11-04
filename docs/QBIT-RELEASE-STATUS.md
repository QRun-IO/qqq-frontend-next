# Next UI QBit integration status

Updated: 2026-11-04. Implementation and local integration verification complete for this branch. No published release or deployment is claimed.

## Changes

The canonical Next UI integration renders file preview/download adornments, retained-transfer receipts, isolated TypeScript editing and generic process results through QQQ metadata and UIUX APIs. It adds no table-specific application routes. The completion pass fixes Windows static-export execution, local PDF reads under dashboard CSP, and ordinary signed-storage PDF previews. Signed storage reads omit credentials, refuse redirects and enforce byte/time limits before canvas rendering. Retained transfers preserve their receipt/hash checks. Tests now use four workers by default to avoid high-core host contention; no timeout or coverage threshold was relaxed.

## Verified dependencies

- Core `feat/standalone-scripting-api`, code commit `d384d1c753cb0ac2ee4d0f6ccd564a3e47488a1c`, locally installed as `4.1.0-SNAPSHOT`.
- Collaboration `feat/record-files-standalone`, `53bd8f00d8a180b0fa4eb6cd029dc31044b6d4b3`, locally installed as `0.1.0-SNAPSHOT`.
- Next UI retains canonical Next 16.4.1, Zod 3 and existing dependencies. Local packaging explicitly overrides Maven revision to `1.0.0-SNAPSHOT`; it does not replace public RC.36.

## Completed verification

| Check | Result |
| --- | --- |
| Full `pnpm test:coverage` | 359 files; **3,784 passed**, 1 existing skip; all coverage gates passed |
| Coverage | 93.14% statements, 87.00% branches, 94.57% functions, 94.95% lines; API/utility sub-gates also passed |
| Lint and license headers | Zero errors, six existing warnings in unchanged files; Apache headers passed |
| Typecheck | Passed |
| Offline TypeScript worker in Chromium | Strict diagnostics, multi-file completion/hover/definition and formatting passed; no source execution or external fetch |
| Windows production static export | Passed using `pnpm build:export` |
| Local Maven snapshot JAR | Built successfully with PDF/TypeScript workers included |
| Browser file/process regressions | **12 passed** against the packaged production UI; API fixtures exercise PDF canvas, separate audit receipts, incomplete-receipt refusal and keyboard ordering |
| Live Core + Collaboration file workflow | Upload, thumbnail, preview, open, exact-byte download, rename/describe, reload and delete passed with synthetic data |
| Live PDF and authorization | Signed PDF canvas/page controls and download passed; another session was denied access to the parent record |
| Live UI API specification check | Bundled 1.8.0 compatible with running Core 1.10.0 |

The live tests used the existing disposable `CollaborationDevServer`, synthetic Alice/Bob sessions and the current UI JAR on loopback. No API mocks were used for those file/permission checks. The separate 12-case browser suite uses its existing API fixtures, not a deployed Record Files or scripting worker. Test-owned services and browsers were stopped after verification.

## Reproduce

```shell
pnpm install --frozen-lockfile
pnpm test:coverage
pnpm lint
pnpm typecheck
pnpm scripting:worker:check
pnpm build:export
mvn -B -Drevision=1.0.0-SNAPSHOT package
pnpm ui-api:check --server-url http://localhost:18098
```

Start the matching Collaboration demo using its README and place the resulting UI JAR first on its classpath. The live check used port 18098. The standard `pnpm test:e2e` owns its frontend fixture for the browser scenarios. Maven was invoked through the sibling Collaboration wrapper during this Windows run.

Local JAR SHA-256: `0626B33DF49569476E17FA080E2777A7AD9C7AF717CB75DFABF9EB40BE0A46A8`.

## Release boundary

See [known issues and release requirements](QBIT-KNOWN-ISSUES.md). Compatible public artifact publication, the complete application acceptance matrix and deployed document/script worker qualification are not implied by these source and local integration results.
