# Next UI — unreleased

Browser stability [PR #18](https://github.com/QRun-IO/qqq-frontend-next/pull/18) is merged and its changes are assigned to [RC10 preparation](1.0.0-RC.10.md), together with merged ESB integration. RC10 is not yet published; [RC9](1.0.0-RC.9.md) remains immutable and does not contain these fixes. Central tracking: [qqq#713](https://github.com/QRun-IO/qqq/issues/713), [browser investigations #985](https://github.com/QRun-IO/qqq/issues/985), and [QQQ Roadmap Project 12](https://github.com/orgs/QRun-IO/projects/12).

## Product fixes

- Preserve focus on the search dialog's Clear control when keyboard interaction occurs before its scheduled initial focus. [#950](https://github.com/QRun-IO/qqq/issues/950)
- Preserve a clicked possible-value option in WebKit when blurring its search input would scroll the form between mousedown and mouseup. The selected value now reaches process submission and generated output. [#978](https://github.com/QRun-IO/qqq/issues/978)
- Keep authentication loading until explicit logout finishes, so a late logout response cannot erase cookies from a subsequent successful sign-in. [#984](https://github.com/QRun-IO/qqq/issues/984)

## Browser testing and infrastructure

- Pin the official Playwright runner containing the fixed Linux WebKit network library, and retain native browser diagnostics for navigation failures. The previous bundle's heap corruption was reproduced; migration to a stable runner remains tracked separately. [#904](https://github.com/QRun-IO/qqq/issues/904), [#973](https://github.com/QRun-IO/qqq/issues/973)
- Correlate interrupted Firefox font diagnostics with real request and decode evidence, wait for initial fonts before the deliberate redirect, and observe transient feedback during the action that produces it. [#951](https://github.com/QRun-IO/qqq/issues/951), [#953](https://github.com/QRun-IO/qqq/issues/953), [#967](https://github.com/QRun-IO/qqq/issues/967)
- Wait for nested report metadata and the destination's owned iframe before advancing acceptance navigation. [#961](https://github.com/QRun-IO/qqq/issues/961), [#972](https://github.com/QRun-IO/qqq/issues/972)
- Verify Linux WebKit's downloaded filename normalization while retaining file-content and cleanup assertions. [#979](https://github.com/QRun-IO/qqq/issues/979)
- Verify actual browser refusal of disallowed framing with a control that renders when the protective headers are removed. [#981](https://github.com/QRun-IO/qqq/issues/981)
- Recognize Firefox's network-error diagnostic for the gallery's intentionally missing extension only after that same script request returns HTTP 404; preserve the raw evidence and reject unrelated failures. [#983](https://github.com/QRun-IO/qqq/issues/983)
- Select all ten ESB scenarios for both phone and tablet acceptance, retaining real broker delivery, lifecycle, replay, SQL and permission checks. Matrix references now use the central QQQ tickets. [#986](https://github.com/QRun-IO/qqq/issues/986), [#990](https://github.com/QRun-IO/qqq/issues/990)

## Verification and remaining work

The [combined acceptance run](https://github.com/QRun-IO/qqq-frontend-next/actions/runs/36942612338) on head `7ff90f1` (the same tree as merge `289eca19`) passed all 2,972 executed cases: 614 each in Chromium, Firefox and WebKit, and 565 each on phone and tablet. All desktop gates covered 401 required rows. The workflow still failed its touch coverage gate because ten ESB rows were not selected; that original failure remains retained under [#990](https://github.com/QRun-IO/qqq/issues/990). After adding the selection markers, a separate native Linux run passed all 20 ESB phone/tablet cases, with zero retries, skips, flaky outcomes or report errors. Its frozen frontend export is unchanged; its freshly rebuilt backend is `55b33e6`. Complete touch collection is now 575 cases per profile. These separate scopes do not constitute a fresh full hosted workflow pass.

Each linked issue and PR records the source commit, reproduction and scoped verification. Preserve failed full-run snapshots separately from later focused passes. The broader historical navigation inventory [#904](https://github.com/QRun-IO/qqq/issues/904), same-user session stall [#952](https://github.com/QRun-IO/qqq/issues/952), legacy process-navigation stall [#960](https://github.com/QRun-IO/qqq/issues/960), and original toast-paint uncertainty [#967](https://github.com/QRun-IO/qqq/issues/967) remain open. Current combined-source results are recorded in the [RC10 preparation notes](1.0.0-RC.10.md); no final-release approval is claimed by these results.

Final 1.0 remains held for real-application soak and explicit owner approval under [#712](https://github.com/QRun-IO/qqq/issues/712). This work does not authorize a QQQ 4.1 release. See the [testing-period policy](1.0-testing.md) and [issue lifecycle](../ISSUE-TRACKING.md).
