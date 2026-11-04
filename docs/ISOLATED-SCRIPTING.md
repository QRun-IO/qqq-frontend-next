# Isolated scripting editor

ScriptViewer routes explicit server-controlled ISOLATED projects before legacy hooks mount. Unknown nonempty modes fail closed. The native scripting extension must be advertised; otherwise isolated source stays unavailable. Developer page provides semantic project creation and opens the same IDE; project names never imply execution mode or actor identity.

The isolated CodeMirror editor supports multi-file TypeScript, immutable source history, explicit save/build/test/publish, server compiler diagnostics, scoped API declarations, JSON context tests and exact-commit GitHub imports with retained provenance. Edits invalidate build/test evidence. Saves and imports carry the observed latest revision. No browser credential fields or background repository synchronization.

## Semantic language service

Pinned editor-only typescript-editor alias6.0.3 powers a same-origin classic worker. It receives a bounded virtual filesystem and host-generated SDK declarations, with57 trusted ES2022 standard-library files bundled at build time. Diagnostics, completion, hover, go-to-definition(F12), formatting(Ctrl+Shift+F), file navigation and compiler diagnostic selection operate on the same workspace. Text remains ordinary undoable editor state. Tab moves focus.

There is no source execution, compiler emit, runtime fetch, arbitrary package loading, filesystem, DOM/Node declarations or user npm hooks. Browser analysis is advisory; authoritative strict builds still use the qualified isolated server. Worker cold deadline10s/warm3s terminates it on timeout; bounded request/result sizes, four pending calls, idle30s termination and recycling after200 requests limit work. The next explicit request may start a new worker; no hidden retry of timed-out source analysis. A browser worker supplies termination responsiveness, not an OS-enforced memory sandbox. Debugging and automatic imports are not implemented.

scripts/build-scripting-worker.mjs assembles only trusted package/compiler and our own session source into public/scripting-generated/typescript-6.0.3.worker.js, with license/notices. Generated9.6MB artifact is ignored and built before dev/build/build:export. Runtime worker requests no other resource. Exact compiler and library dependencies remain independent from server runtime qualification.

The alias package also exports tsc and would shadow the existing compiler under pnpm exec tsc. Use **pnpm typecheck** or **pnpm tsc**: both explicitly call node_modules/typescript/bin/tsc (the existing5.9 build compiler). Existing CI typecheck scripts follow that path. Do not replace frontend build TypeScript with the editor compiler. Compatible CodeMirror versions are pinned through pnpm overrides to avoid duplicate nominal EditorView/state classes.

## Authorization and uncertainty

Server permissions and worker availability control lifecycle actions, with backend checks authoritative. Core/RDBMS must use the reviewed isolated-record-files local artifact; other QQQ modules stayRC20. Project creation and publication use typed core authority; isolated revision/file content and ownership are immutable. Real native HTTP lifecycle succeeds with protocol-only fixture worker; no production provider is implied.

Stop waiting or network timeout makes mutation outcome uncertain and prevents another mutation. History refresh does not prove completion; inspect history/reopen. Creation uncertainty directs the user to Scripts before retrying. Abort does not undo committed work. GitHub import needs a server-installed managed access provider and full immutable commit.

## Verification

2026-10-30: **114 focused tests across12 files**, existing build-compiler typecheck and changed-file ESLint passed. Real Playwright Chromium worker check exercises strict diagnostics, multi-file completion/hover/definition/format, rejects remote types and proves source does not execute or fetch. Final optimized production build with typecheck, static generation and standalone packaging passed at 21:36, including the creation panel (parent run20209, editor-build-verification.log). Native server tests separately cover create/save/build/context-test/publish and permission/association/legacy denials. No live browser-to-deployed-worker end-to-end or production sandbox qualification claim.

Run pnpm scripting:worker:check after generating the worker; this environment uses PLAYWRIGHT_BROWSERS_PATH=C:/Users/james/AppData/Local/ms-playwright. The harness serves only a local trusted page/worker with connect-src none and closes browser/server on completion.
