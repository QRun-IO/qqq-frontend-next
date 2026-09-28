# Next UI visual review

Status: in progress, September 28, 2026. This review is a release requirement. Captured screenshots are not approvals or evidence that a surface has passed review.

The visual reference is the working Next UI before the September 26 parity integrations, commit `e42ad2b2bcdc76311e13002a22dd70e3ec437192`. Material Dashboard remains the reference for supported workflows and metadata contracts. The user's September 27–28 correction requires preserving the earlier Next design while completing those workflows.

## Evidence and method

- Current source: `feature/next-1.0`, head `bf97d71`, plus the uncommitted restoration. Both exports were rebuilt on September 28.
- Both builds run the same current sample JAR and acceptance fixture sources, with fresh admin browser contexts and the same Inter font bytes. Historical-reference type checking is skipped only in its isolated build; the current export completes its normal type check.
- Local comparison gallery: <http://127.0.0.1:18770>. Earlier UI: <http://127.0.0.1:18768/app>. Current UI: <http://127.0.0.1:18769/app>.
- Evidence is retained under `../qqq-frontend-next/test-results/visual-review/`: source/build provenance, capture scripts, manifests, screenshot sequences, and server/build logs. It is ignored generated output, not a published artifact.
- Review dimensions: hierarchy, typography and spacing, color and icon treatment, control grouping, responsive layout, and interaction states. Confirm findings against source before changing defaults; preserve explicitly configured metadata behavior.

## Coverage

The initial pass captured 38 scenarios per build at desktop (1440×1000), tablet (810×1080), and phone (393×851): 228 build/state combinations and 447 screenshots, including long-page scroll sequences. Every entry viewport has received a paired visual scan. Detailed review of all scroll sequences, dark/configured themes, keyboard focus, and additional interaction states remains. No whole family is signed off yet. The baseline report-filter editor is unavailable because that functionality did not exist there; its capture is not an equivalent editor state. The desktop baseline delete capture needs a corrected menu-opening step.

| Family | Captured desktop scenarios | Remaining review scope |
|---|---|---|
| Shell and navigation | Dashboard, app home, nested navigation, not found | Search, command menu, notifications, user menu, help, login/session, phone navigation, branding/theme variants |
| Query | Small and wide table, filters, advanced filters, columns, views, export | Populated criteria and groups, quick-filter editing, column menus, density, cards, selection/bulk controls, saved-view states, pagination, empty/error/loading |
| Records | Compact record, person, record lab, audit, delete | Every tab/list/card variant, associations, metadata menus, configured sidebar, collapse, sharing, warnings/errors |
| Forms | Create, edit, copy, field lab | Each field editor, validation, disabled/read-only, dirty state, full copy, file/association editors, modal forms |
| Processes | Wizard, component lab, widget step, bulk load | Subsequent steps, selection, validation review, progress, results, errors, cancellation, upload mapping |
| Reports | Run inputs, saved report, edit, filter/column editor | Filter variables, columns, pivot editor, scheduling, sharing, results/download, validation |
| Widgets | Sample dashboard, gallery, blocks, parents, controls, states, tables/charts, record widgets/editors | Map all 38 dispatcher labels to evidence; inspect every scroll capture, dropdown, tooltip, menu, loading/error/empty state |
| Developer tools | Table and record developer pages | Script editor/viewer, code tabs, dialogs, ESB metadata/tools, responsive layouts |

## Findings

| ID | Severity | Observed difference | Evidence | Status |
|---|---|---|---|---|
| VIS-001 | High | Wide query tables now use very narrow numeric/date/boolean defaults. Header labels are reduced to fragments, dates wrap across lines, and monetary values clip. The reference keeps readable columns and scrolls horizontally. | `desktop/query-person`, `desktop/query-advanced`; `DataGrid.tsx` and `query-columns.ts` | Restored 150px defaults; configured/user widths preserved. Desktop dates/currency verified after rebuild. Long heading truncation remains under review. |
| VIS-002 | Medium | Switching an empty query to Advanced adds a long unsaved-view status and links to the toolbar, moving Export and view controls to another row. The filter panel also grows substantially with separate mode and sort controls. | `desktop/query-advanced` | Open; retain added filter/view capabilities within the earlier compact hierarchy. |
| VIS-003 | Medium | A record with process actions now has separate Copy and Delete buttons plus an Actions menu. The reference groups secondary actions in the menu. | `desktop/record-person`, `tablet/record-person`; `RecordActions.tsx` | Corrected and verified in desktop/tablet/phone record captures. Enabled menu actions suppress duplicate direct buttons, including nested menus. NAV-055 passes all five profiles. |
| VIS-004 | Medium | Record tabs crowd the identity header and field groups have more vertical spacing. The earlier header has a clear gap above tabs. | `desktop/record-person`, `desktop/record-small`; `RecordViewHeader.tsx` display-contents wrapper and field layout | Normal wrapper and 16px field gap restored; desktop/tablet/phone record captures reviewed. |
| VIS-005 | Medium | Widget header icons changed from colored outline glyphs to filled square tiles; the sample pie chart changed from a doughnut to a solid pie. | `desktop/widgets-sample`; `WidgetIconTile` and `QqqChartWidget` | Header glyph colors and doughnut restored; image paths, main-icon tiles, explicit colors, slice links, tooltips and legend toggles retained. Fresh desktop/phone captures reviewed; 30/30 affected five-profile widget cases pass. |
| VIS-006 | High | Phone query pages always expose mode, sort, and quick-filter controls beneath the toolbar, pushing the first Person card from approximately y=474 to y=708. Opening the Filter sheet also adds unsaved-view links behind it. | `phone/query-person`, `phone/query-small`, `phone/query-filters`; `RecordQuery.tsx` unconditional phone controls | Corrected: shared controls now live in the phone Filter sheet; opening preserves mode. Fresh phone captures confirm first card returns to approximately y=474. Affected filtering/focus/record acceptance passes 83/83 across five profiles. |
| VIS-007 | Medium | Phone app-page titles are reduced to a few characters after adding a home breadcrumb and a separate command-palette control. The earlier header preserves substantially more of the page name. | `phone/app-home`, `phone/widgets-sample`, `phone/not-found`; `Header.tsx`, `Breadcrumbs.tsx` | Open; preserve readable page identity and access to the added commands. |
| VIS-008 | Medium | Process widget buttons changed from compact primary buttons to full-width slate bars, with extra margins pushing the footer below the first phone viewport. | `process-widgets` on all sizes; `QqqBlocks.tsx` ButtonBlock defaults `w-full`, `m-2`, `#344767` | Open; distinguish explicit block styling from changed defaults and restore the Next default treatment. |

Existing defects also found in the reference: Views menus run off the right edge on phone/tablet; the phone Export menu opens partly off the left edge; records with many tabs have overlapping tablet labels; sample Big Number context overflows on phone. These are production-quality issues even though they predate the parity changes. They require focused interaction checks and fixes, not preservation as design intent.

Dashboard, app-home content, wizard entry, basic process components, centered Person create/edit/copy forms, blocks/parent widgets, and developer-page structure retain the earlier overall layout in the captured states. Form headings and currency adornments differ. Reports and record-widget forms gained previously missing filter, pivot, dynamic-form, and variable sections; their additional length is functional work that must survive restoration. Typed widget table cells now render values instead of raw markup/object strings. These observations cover entry states only and do not approve the full workflows.

## Current release status (verified September 28)

- Next UI 1.0.0 remains unreleased. PR #14 is open at `bf97d71e22f0a8837863cfc9ddee25d9a22d7fbc`; restoration edits are local and uncommitted.
- GitHub checks on that pushed head: typecheck/lint/unit/coverage, mocked E2E, Storybook, bundle budget, amd64/arm64 image builds and CircleCI passed. All real-backend jobs failed on the same `NAV-055` record-view hooks/delete-confirmation case in Chromium, Firefox, WebKit, phone, and tablet. Logs are retained in the evidence directory. This is not a green release gate.
- Current restoration: full unit suite 1761/1761, production static export including typecheck, source ESLint (0 errors, 5 existing warnings), license headers and bundle budget pass. Two real-server runs passed: 83/83 filter/record cases and 30/30 widget cases across Chromium, Firefox, WebKit, phone and tablet. The old GitHub NAV-055 failure is corrected locally; final full acceptance and fresh PR checks are still required. The current preview was refreshed after these corrections; recaptured desktop query/record pages confirm readable dates/currency and restored spacing/action grouping. Some long grid headings still truncate and remain under review. Original captures are preserved under `initial-capture/`. Final full acceptance and production checks still need to run on the resulting source.
- Functional ledger: 735 Done, 14 Done with different UX, 5 Partial, 2 Missing, 38 N/A (794 rows). Remaining items include base-path hosting, Google Drive picker, embedded query/report editor coverage, complex block input adornments, unmapped icon names, and script autocomplete. Ledger completion does not establish visual acceptance.
- Developer and agent guide audit completed: all 38 dispatcher labels are cataloged and 130 local links resolve. Restored defaults, configuration precedence and additional routes are documented. This is documentation verification, not browser workflow approval.

## Release sequence

1. Complete the screen/state inventory and paired desktop, tablet, and phone evidence, plus theme and accessibility states.
2. Review every capture and record regressions with source causes. Correct shared defaults and verify the affected families together.
3. Reconcile the developer/agent guides and functional parity ledger with the chosen Next interactions.
4. Run the final five-profile real-server acceptance, source, accessibility, security, performance, and packaging gates on the resulting source.
5. Merge and publish Next UI 1.0.0 only after the complete release evidence is green. QQQ 4.1 remains unreleased.

September 28 follow-up: phone filter controls and restored widget styling are in the current preview on port 18769. The initial capture remains archived for comparison; manifests contain refreshed captures only for the scenarios explicitly recaptured. Remaining priority regressions are VIS-002 (dirty-view toolbar), VIS-007 (phone header identity), VIS-008 (process widget button defaults), plus responsive defects and detailed visual states.
