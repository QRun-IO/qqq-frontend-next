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

- Show `FILE_PREVIEW`-adorned fields as thumbnails, and open a preview on click or Enter. Thumbnails appear in the query grid and card view, the record view (a larger thumbnail with the file name), associated-record tables, child-record list widgets and record-grid widgets. They load lazily at a fixed size, so loading does not shift the layout, with a loading pulse and a file-type icon fallback. The preview is an accessible dialog: focus is trapped and restored, Escape closes it, and Left/Right/Home/End step through the other previews on the same screen. It offers zoom and fit, open-original and download links, and shows type, size, dimensions and caption. PDFs served by the backend (same-origin `/qqq/` paths) and video/audio play inline; other types, and other or cross-origin PDFs (frames are limited to `'self'`), get a file card or open in a new tab. Thumbnails are shown only for explicitly adorned fields; plain URL values are never auto-detected. URLs are limited to http(s), same-origin paths and inline images. The lightbox loads on demand (about 3.5 KB gzip). Requires the QQQ backend adornment from [qqq#1056](https://github.com/QRun-IO/qqq/issues/1056).

## Product fixes

None yet.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
