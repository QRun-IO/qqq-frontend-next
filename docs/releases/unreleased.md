# Next UI — unreleased

[RC14 preparation](1.0.0-RC.14.md) collects every change merged since [RC13](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.13): the record search fix and the Next.js security update. RC13 is published and immutable. Changes merged after the RC14 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Product fixes

- **Record developer view** (`/app/{table}/{id}/dev`): the record screen's navigation (back to the record, record title, Edit, Actions, Audit, breadcrumbs) and a sticky section navigation over Fields (display and raw values, types, possible-value sources and adornments, filterable), **API Access** (the v1 routes this screen uses and every application API that exposes the table, read from its OpenAPI spec and limited to what the user may do, with copyable curl, fetch and Java examples built from the record's values, placeholder credentials only, and links to the API docs and specs), **developer panels** from QQQ's provider contract ([qqq#1076](https://github.com/QRun-IO/qqq/pull/1076): record security, ESB events, and any qbit's panel such as quick search, SQL workbench or the assistant, shown only when installed and active for the table; absent on older backends), Relations, recent Audit, associated scripts, raw JSON and a searchable Table Metadata explorer. Readable from 360 to 3200px with no sideways scrolling. The view loads on demand, keeping the route's first-load JavaScript at 333.5 KB (budget 360 KB).

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
