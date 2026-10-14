# Help everywhere — implementation and verification

Backend: QRun-IO/qqq#1177 (`docs/HELP-CONTENT.md`).

## Implementation

- Vendored the supplied help-core `openapi.yaml` as the existing one-space-indented JSON document. The prior vendoring commits are `01dd7e9` and `8a0fbbd`; neither contains a generator script. Conversion uses the installed ESLint dependency `js-yaml`, then `JSON.stringify(document, null, 1)` with a final newline. The full core document is retained, including its other changes within UI API 1.2.0.
- Added `summary` to `QHelpContent`, reused that type for widget slots, and added app/process/report slot maps. `src/lib/api/help.ts` uses the typed API client and checks the advertised `help` feature before calling search. No off-spec exception was added. Search and coverage are optional spec operations; coverage is not called.
- `src/components/help/HelpIcon.tsx` selects role-specific help, shows the plain summary, and opens the shared long-help panel by click, Enter, or Space. Existing customization IDs are retained on the corresponding control or tooltip. Input descriptions remain available while the tooltip is closed.
- `HelpPanelProvider` is mounted in the authenticated dashboard. One `next/dynamic` panel renders sanitized long content using the existing `HelpContent` renderer, with related help, safe navigation, Escape dismissal, focus trapping, and return focus. Help controls use theme tokens and coarse-pointer touch targets.
- Existing field, section, grid-column, widget-title, widget-column, and process-step help now uses the shared icon. New placements cover app, table query/view/edit/create/copy, process, report, and record/table action headers or labels. Action help is a sibling of the action control; Radix menu help participates in roving focus.
- `HelpSearchResults` provides 200 ms debouncing, a two-character minimum, feature gating, and loading/error/empty states. Both `CommandMenu` and the global `SearchPage` use it. The page's existing grouped-results area is a natural place for help; the compact header/search-dialog listbox retains its current record/navigation model. The palette also offers **Search help…**.
- Author mode retains key suffixes. **Add help** / **Edit help** links require the core table's insert permission and use `/app/helpContent/create#/defaultValues=…` with `key` and the most specific `role`. `HELP_CONTENT_TABLE` is the one production constant for that core-defined table.

## Tests and fixtures

- New Vitest tests cover the API gate, role precedence, summaries, keyboard controls, author URL presets and permission checks, panel sanitization/focus, and palette help search.
- `tests/acceptance/fixture/HelpFixtures.java` defines synthetic Help Lab metadata, Markdown bodies and distinct summaries, an owned data table, and the core authoring table. It is wired into the normal define/reset lifecycle.
- `tests/acceptance/specs/help/help.spec.ts` and `matrix/help.json` add HLP-001 through HLP-006, light/dark cases, mobile tags, and 320/1920-pixel panel checks. Column/table-menu coverage remains desktop-only because mobile query results use cards. The area is registered in `acceptance-select.mjs`.
- Existing REC-039/040, PRC-015, and widget-column assertions now focus the help button and inspect formatted long content in the panel. This is necessary because tooltips now contain plain summaries and touch opens the panel. Existing scenarios and matrix requirements remain; none was waived.
- Historical results in `docs/acceptance/feature-matrix.md` are preserved. The new help rows are appended as **not run**.
