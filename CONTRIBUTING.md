# Contributing

## Branching: trunk-based on `main`

`main` is the only long-lived branch. There is no `develop`, `release/*` or `hotfix/*` branch.

1. Branch from the current `main` (`feature/...`, `fix/...`, `docs/...`, `chore/...`).
2. Keep the branch current by merging `main` into it; do not rebase or force-push a branch
   that is under review.
3. Open a pull request into `main`. Every commit must be signed.
4. A pull request merges when the required checks pass and the code owner approves.
   Head branches are deleted automatically after the merge.

### Required checks

| Check | Source |
|-------|--------|
| `Typecheck, lint, unit tests and coverage` | `.github/workflows/ci.yml` |
| `Mocked e2e (Playwright, chromium)` | `.github/workflows/ci.yml` |
| `Bundle budget (static export)` | `.github/workflows/ci.yml` |
| `Storybook build` | `.github/workflows/ci.yml` |
| `ci/circleci: qqq-orb/node_app_test_only` | `.circleci/config.yml` |

The real-backend acceptance matrix (`.github/workflows/acceptance.yml`) runs on every pull request
and on `main`. Treat a red row as a release blocker and investigate it; never re-run it until it passes.

## Releases

A release is a signed `v<version>` tag on `main` (for example `v1.0.0-RC.14`), where `package.json`
and `pom.xml` carry that version. The tag publishes the dashboard jar to Maven Central (CircleCI
`publish_dashboard_jar`) and the dashboard container image (`.github/workflows/dashboard-image.yml`).
Release notes live in `docs/releases/`.

## Dependencies

Dependabot opens grouped weekly updates for npm, GitHub Actions and Maven (`.github/dependabot.yml`),
plus security updates as they are published.

## UI API calls (merge order)
Next calls the backend only through operations described in the vendored UI API documents:
`src/lib/api/openapi/qqq-v1.json`, plus one JSON file per extension in `extensions/`.
`ui-api-contract.test.ts` fails on any other call.

A feature that needs new backend calls lands in this order:
1. The qbit or module ships the operations as a UI API extension, with spec classes and its
   committed `openapi/qqq-v1/<name>.yaml`.
2. That document is vendored here, as `extensions/<name>.json` or a re-vendored `qqq-v1.json`.
3. The UI PR that calls them.

`OFF_SPEC_CALLS` in `ui-api-calls.ts` is a shrinking list of calls that predate the extension point.
`OFF_SPEC_CEILING` caps it: lower the ceiling as entries move onto specs, and never raise it.
