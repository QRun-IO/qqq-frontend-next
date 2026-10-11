# Next UI — unreleased

[RC12 preparation](1.0.0-RC.12.md) collects every change merged since [RC11](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11): the always-available record Actions menu ([#45](https://github.com/QRun-IO/qqq-frontend-next/issues/45)), private query-state clearing between users, standalone branding and CSP derivation, grid and report focus fixes, and browser-testing hardening. RC11 is published and immutable. Changes merged after the RC12 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## New features

- SQL Workbench: render the `SQL_WORKBENCH` widget of the [qbit-sql-workbench](https://github.com/QRun-IO/qbit-sql-workbench) QBit as a super-user SQL notebook.
  - Personal and shared notebooks with SQL and markdown cells, `:parameters`, versions and pinned results.
  - A CodeMirror 6 editor with dialect highlighting, schema and QQQ-name autocomplete, and formatting.
  - A typed, sortable, paged result grid with CSV/XLSX/JSON export, quick charts, and EXPLAIN plan trees.
  - Read-only runs by default, and a two-step write confirmation for users with the write permission.
  - CodeMirror and the formatter load only on that page (new `lazyChunks` budgets).

## Product fixes

None yet.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
