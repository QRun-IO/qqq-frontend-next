# Next UI — unreleased

[RC12 preparation](1.0.0-RC.12.md) collects every change merged since [RC11](https://github.com/QRun-IO/qqq-frontend-next/releases/tag/v1.0.0-RC.11): the always-available record Actions menu ([#45](https://github.com/QRun-IO/qqq-frontend-next/issues/45)), private query-state clearing between users, standalone branding and CSP derivation, grid and report focus fixes, and browser-testing hardening. RC11 is published and immutable. Changes merged after the RC12 preparation commit are listed below. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Product fixes

- Size record-view cards, dashboard widgets and form fields by the width of their own grid (container queries) rather than the viewport: table panels sit side by side only when each is readable and otherwise stack, cards keep their own height, fields share a row only when they fit, and very wide screens use the room. No horizontal page scroll from 360px up.
- Make child-record lists in record-view panels readable: they show the columns that matter most and fit (the record name, status and boolean columns, the most recently changed date; the key and long text last), with `+N more columns` and View All for the rest. Cells align to the top and long text is clamped with the full text on hover. A widget's `onlyIncludeFieldNames` order is respected.
- Show dates compactly everywhere: `6:33 PM` today, `Jul 5, 6:33 PM` this year, `Jul 5, 2025` before, on one line with the full zoned timestamp on hover, in the viewer's zone and locale. DATE values are no longer shifted a day west of UTC. Exports are unchanged.

## Browser testing and infrastructure

None yet.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
