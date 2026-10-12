# Next UI — unreleased

[RC12 preparation](1.0.0-RC.12.md) collects every change merged since [RC11](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11): the always-available record Actions menu ([#45](https://github.com/QRun-IO/qqq-frontend-next/issues/45)), private query-state clearing between users, standalone branding and CSP derivation, grid and report focus fixes, and browser-testing hardening. RC11 is published and immutable. Changes merged after the RC12 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## New features

- SQL Workbench: render the `SQL_WORKBENCH` widget of the [qbit-sql-workbench](https://github.com/QRun-IO/qbit-sql-workbench) QBit as a super-user SQL notebook.
  - Personal and shared notebooks with SQL and markdown cells, `:parameters`, versions and pinned results.
  - A CodeMirror 6 editor with dialect highlighting, schema and QQQ-name autocomplete, and formatting.
  - A typed, sortable, paged result grid with CSV/XLSX/JSON export, quick charts, and EXPLAIN plan trees.
  - Read-only runs by default, and a two-step write confirmation for users with the write permission.
  - CodeMirror and the formatter load only on that page (new `lazyChunks` budgets).

## Features

- Support an instance home app. When the backend designates one with `QInstance.homeAppName` ([qqq#1059](https://github.com/QRun-IO/qqq/issues/1059)), and the user may open it, `/app` shows that app's dashboard (a client-side redirect, matching backends that redirect full page loads of `/app/`), the sidebar logo and the breadcrumb Home crumb link there, and the sidebar drops its separate Dashboard entry. Without a home app, or with one the user may not open, `/app` remains Next's overview.
- Show `FILE_PREVIEW`-adorned fields as thumbnails, and open a preview on click or Enter. Thumbnails appear in the query grid and card view, the record view (a larger thumbnail with the file name), associated-record tables, child-record list widgets and record-grid widgets. They load lazily at a fixed size, so loading does not shift the layout, with a loading pulse and a file-type icon fallback. The preview is an accessible dialog: focus is trapped and restored, Escape closes it, and Left/Right/Home/End step through the other previews on the same screen. It offers zoom and fit, open-original and download links, and shows type, size, dimensions and caption. PDFs served by the backend (same-origin `/qqq/` paths) and video/audio play inline; other types, and other or cross-origin PDFs (frames are limited to `'self'`), get a file card or open in a new tab. Thumbnails are shown only for explicitly adorned fields; plain URL values are never auto-detected. URLs are limited to http(s), same-origin paths and inline images. The lightbox loads on demand (about 3.5 KB gzip). Requires the QQQ backend adornment from [qqq#1056](https://github.com/QRun-IO/qqq/issues/1056).

## Product fixes

- Size record-view cards, dashboard widgets and form fields by the width of their own grid (container queries) rather than the viewport: table panels sit side by side only when each is readable and otherwise stack, cards keep their own height, fields share a row only when they fit, and very wide screens use the room. No horizontal page scroll from 360px up.
- Make child-record lists in record-view panels readable: they show the columns that matter most and fit (the record name, status and boolean columns, the most recently changed date; the key and long text last), with `+N more columns` and View All for the rest. Cells align to the top and long text is clamped with the full text on hover. A widget's `onlyIncludeFieldNames` order is respected.
- Show dates compactly everywhere: `6:33 PM` today, `Jul 5, 6:33 PM` this year, `Jul 5, 2025` before, on one line with the full zoned timestamp on hover, in the viewer's zone and locale. DATE values are no longer shifted a day west of UTC. Exports are unchanged.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
