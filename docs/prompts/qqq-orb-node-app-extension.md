# Prompt: Add `node_app_*` jobs to kingsrook/qqq-orb

## Context

You are working in the `kingsrook/qqq-orb` CircleCI orb repo at:
`/Users/james.maes/Git.Local/QRun-IO/qqq-orb`

The orb currently supports:
- `mvn_*` — Maven Java libraries
- `mvn_frontend_*` — Maven + bundled frontend
- `node_*` — npm-published TypeScript libraries

You are adding a new project type: **`node_app_*`** — pnpm-based Node.js
applications (Next.js, Vite, etc.) that are _deployed_, not published to npm.

---

## Step 1: Read these files before writing anything

### qqq-orb existing patterns (understand before touching)

```
src/@orb.yml                              ← orb-level imports (browser-tools, node orbs already imported)
src/executors/default.yml                 ← Docker executor (cimg/node)
src/jobs/node_test_only.yml               ← existing node job structure
src/jobs/node_publish.yml                 ← existing node publish job
src/commands/node_install_dependencies.yml
src/commands/node_run_tests.yml
src/commands/node_build_package.yml
src/scripts/node_npm_auth.sh              ← existing script style/conventions
src/scripts/node_version_commit.sh        ← existing script style/conventions
CLAUDE.md                                 ← orb architecture, make commands, linting rules
```

### Munitor reference orb (copy engineering patterns from here)

These files live at `/Users/james.maes/Git.Local/Kof22/Munitor/`. Read them
to understand the patterns you must replicate — **not to copy content**, but
to adopt the same engineering discipline.

```
src/scripts/munitor_helpers.sh            ← shared helper library pattern
src/scripts/install_node.sh              ← nvm-based node install with BASH_ENV export
src/scripts/npm_install.sh              ← lockfile validation before install
src/scripts/npm_test.sh                 ← JSON test_commands array override pattern
src/scripts/npm_lint.sh                 ← lint with JSON artifact output
src/scripts/run_e2e_playwright.sh       ← Playwright install + JUnit reporter
src/commands/restore_npm_cache.yml      ← cache key pattern
src/commands/save_npm_cache.yml
src/jobs/npm_build_and_test.yml         ← two-job pipeline with workspace handoff
src/jobs/npm_e2e_test.yml               ← E2E job that attaches workspace
```

---

## Step 2: Create a shared helper script

### `src/scripts/qqq_helpers.sh`

Model this on Munitor's `munitor_helpers.sh`. It must provide:

- `qqq_header <step_name>` — prints a banner with step name, date (UTC),
  hostname, and current directory. Format to match qqq style (not Munitor branding).
- `qqq_check_tool <command> [version_flag]` — verifies tool is in PATH,
  prints its version. Exits 1 with clear error if missing.
- Guard against double-sourcing (`[[ -n "${_QQQ_HELPERS_LOADED:-}" ]] && return 0`)

Sourcing pattern every script must use at the top:
```bash
QQQ_HELPERS="${QQQ_HELPERS:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/qqq_helpers.sh}"
[[ -f "${QQQ_HELPERS}" ]] && source "${QQQ_HELPERS}"
```

With a fallback stub if helpers are missing (same pattern as Munitor):
```bash
elif ! type qqq_header &>/dev/null; then
  qqq_header() { echo "=== QQQ: ${1:-unknown} ==="; }
  qqq_check_tool() { command -v "$1" &>/dev/null || { echo "ERROR: $1 not found"; exit 1; }; }
fi
```

---

## Step 3: Create shell scripts

All scripts: `#!/usr/bin/env bash`, `set -euo pipefail`, source `qqq_helpers.sh`
at top. Clear section headers. Descriptive error messages. Print summaries.

### `src/scripts/node_app_install.sh`

Purpose: Enable pnpm via corepack, validate lockfile exists, install deps.

Environment variables consumed:
- `NODE_PKG_MANAGER` — `pnpm` (default), `npm`, or `yarn`

Logic:
1. Call `qqq_header "node_app_install"`
2. Check tool: node, npm (for corepack)
3. If `NODE_PKG_MANAGER=pnpm`:
   - Run `corepack enable`
   - Run `corepack prepare pnpm@latest --activate`
   - Verify `pnpm --version`
   - Validate `pnpm-lock.yaml` exists; exit 1 with clear message if not
   - Run `pnpm install --frozen-lockfile`
4. If `NODE_PKG_MANAGER=npm`:
   - Validate `package-lock.json` exists
   - Print lockfile version + npm version compatibility warning (copy logic from
     Munitor's `npm_install.sh`)
   - Run `npm ci`
5. If `NODE_PKG_MANAGER=yarn`:
   - Validate `yarn.lock` exists
   - Run `yarn install --frozen-lockfile`
6. Print count of installed packages

### `src/scripts/node_app_test.sh`

Purpose: Run type check, lint, and unit tests. Each step is individually
skippable. Supports custom test commands via JSON array (replaces default test
runner when provided).

Environment variables consumed:
- `NODE_PKG_MANAGER` — pnpm | npm | yarn (default: pnpm)
- `TYPE_CHECK_SCRIPT` — npm script name, or empty to skip (default: `tsc`)
- `TYPE_CHECK_ARGS` — extra args (default: `--noEmit`)
- `LINT_SCRIPT` — npm script name, or empty to skip (default: `lint`)
- `TEST_SCRIPT` — npm script name (default: `test`)
- `QQQ_TEST_COMMANDS_JSON` — JSON array of shell commands; if set and non-empty,
  runs these instead of the default test command (same pattern as Munitor's
  `MUNITOR_TEST_COMMANDS_JSON`)

Logic:
1. `qqq_header "node_app_test"`
2. If `TYPE_CHECK_SCRIPT` is non-empty: run `<pkg_manager> run <TYPE_CHECK_SCRIPT> <TYPE_CHECK_ARGS>`
3. If `LINT_SCRIPT` is non-empty: run `<pkg_manager> run <LINT_SCRIPT>`
4. If `QQQ_TEST_COMMANDS_JSON` is set and not `[]`/`null`:
   - Parse JSON array using `jq` and run each command in sequence
5. Else: run `<pkg_manager> run <TEST_SCRIPT>`
6. Print pass/fail summary

### `src/scripts/node_app_build.sh`

Purpose: Run the production build. For Next.js this is `pnpm build`. Exits
non-zero on failure with clear output.

Environment variables consumed:
- `NODE_PKG_MANAGER` — default: pnpm
- `BUILD_SCRIPT` — npm script name (default: `build`)

Logic:
1. `qqq_header "node_app_build"`
2. Check pkg manager is available
3. Run `<pkg_manager> run <BUILD_SCRIPT>`
4. Print success with timing

### `src/scripts/node_app_e2e.sh`

Purpose: Install Playwright browsers and run E2E tests. Reports results in
JUnit format for CircleCI test analytics.

Environment variables consumed:
- `NODE_PKG_MANAGER` — default: pnpm
- `E2E_TEST_DIR` — default: `e2e`
- `PLAYWRIGHT_BROWSERS` — comma-separated browsers (default: `chromium`)

Logic:
1. `qqq_header "node_app_e2e"`
2. Install Playwright browsers: `npx playwright install --with-deps <browsers>`
3. Run: `npx playwright test --reporter=junit --output=e2e-results`
   - If `E2E_TEST_DIR/playwright.config.ts` exists, pass `--config=<path>`
4. On failure: print "E2E tests failed. See playwright-report artifact." and
   re-exit with the original exit code
5. Print pass summary

---

## Step 4: Create commands

### `src/commands/node_app_install.yml`

Parameters:
- `pkg_manager` — string, default: `"pnpm"` — package manager (pnpm | npm | yarn)

Steps:
1. Restore cache with keys:
   - `node-app-v1-{{ checksum "pnpm-lock.yaml" }}-{{ checksum "package-lock.json" }}-{{ checksum "yarn.lock" }}`
   - `node-app-v1-`
2. Run `node_app_install.sh` with environment `NODE_PKG_MANAGER: << parameters.pkg_manager >>`
3. Save cache key (same composite key as restore), paths: `node_modules`

### `src/commands/node_app_test.yml`

Parameters:
- `pkg_manager` — string, default: `"pnpm"`
- `type_check_script` — string, default: `"tsc"` — set empty to skip
- `type_check_args` — string, default: `"--noEmit"`
- `lint_script` — string, default: `"lint"` — set empty to skip
- `test_script` — string, default: `"test"`
- `test_commands` — string, default: `""` — JSON array of custom test commands

Steps:
1. Run `node_app_test.sh` with environment:
   ```
   NODE_PKG_MANAGER: << parameters.pkg_manager >>
   TYPE_CHECK_SCRIPT: << parameters.type_check_script >>
   TYPE_CHECK_ARGS: << parameters.type_check_args >>
   LINT_SCRIPT: << parameters.lint_script >>
   TEST_SCRIPT: << parameters.test_script >>
   QQQ_TEST_COMMANDS_JSON: << parameters.test_commands >>
   ```
2. store_artifacts: path: `test-results`, destination: `test-results` (if exists)

### `src/commands/node_app_build_step.yml`

Parameters:
- `pkg_manager` — string, default: `"pnpm"`
- `build_script` — string, default: `"build"`

Steps:
1. Run `node_app_build.sh` with environment:
   ```
   NODE_PKG_MANAGER: << parameters.pkg_manager >>
   BUILD_SCRIPT: << parameters.build_script >>
   ```

### `src/commands/node_app_e2e.yml`

Parameters:
- `pkg_manager` — string, default: `"pnpm"`
- `test_dir` — string, default: `"e2e"`
- `browsers` — string, default: `"chromium"`

Steps:
1. Run `node_app_e2e.sh` with environment:
   ```
   NODE_PKG_MANAGER: << parameters.pkg_manager >>
   E2E_TEST_DIR: << parameters.test_dir >>
   PLAYWRIGHT_BROWSERS: << parameters.browsers >>
   ```
2. store_test_results: path: `e2e-results`
3. store_artifacts: path: `e2e-results`, destination: `e2e-results`
4. store_artifacts: path: `test-results/traces`, destination: `playwright-traces`
   (use `when: always` so traces are captured even on failure)

---

## Step 5: Create jobs

### `src/jobs/node_app_test_only.yml`

For feature/non-protected branches. Run install + test only (no build).

Executor: `default` (existing `cimg/node` Docker executor)
- Use `default` executor, tag parameter: `<< parameters.node_version >>`

Parameters:
- `node_version` — string, default: `"lts"`
- `pkg_manager` — string, default: `"pnpm"`
- `type_check_script` — string, default: `"tsc"`
- `type_check_args` — string, default: `"--noEmit"`
- `lint_script` — string, default: `"lint"`
- `test_script` — string, default: `"test"`
- `test_commands` — string, default: `""`

Steps:
1. `git_full_checkout`
2. `node_app_install` (pass `pkg_manager`)
3. `node_app_test` (pass all test params)

### `src/jobs/node_app_build.yml`

For protected branches (develop, release/*, main, hotfix/*). Run install +
test + production build. Persists workspace for a downstream E2E job.

Executor: `default` (cimg/node Docker)

Parameters: (same as node_app_test_only PLUS:)
- `branch_type` — string, default: `"snapshot"` — reserved for future deploy hooks
- `build_script` — string, default: `"build"`

Steps:
1. `git_full_checkout`
2. `node_app_install` (pass `pkg_manager`)
3. `node_app_test` (pass all test params)
4. `node_app_build_step` (pass `pkg_manager`, `build_script`)
5. `persist_to_workspace` — root: `.`, paths: `["."]`
   (full workspace so E2E job gets built artifacts)

### `src/jobs/node_app_e2e.yml`

Separate E2E job. Attaches workspace from `node_app_build` and runs Playwright.

Executor: `default` (cimg/node Docker) — browsers are installed by the script
using `npx playwright install --with-deps`, which works in Docker with root.

Parameters:
- `node_version` — string, default: `"lts"`
- `pkg_manager` — string, default: `"pnpm"`
- `test_dir` — string, default: `"e2e"`
- `browsers` — string, default: `"chromium"`

Steps:
1. `attach_workspace` — at: `.`
2. `node_app_e2e` (pass all E2E params)

---

## Step 6: Do NOT modify any existing files

These must be completely unchanged:
- All `mvn_*` jobs, commands, and scripts
- All `mvn_frontend_*` jobs, commands, and scripts
- All `node_*` jobs (node_test_only, node_publish), commands, and scripts
- `src/@orb.yml` — do NOT add new orb imports; existing `browser-tools`,
  `node`, and `slack` orbs are already available
- `src/executors/default.yml`

---

## Step 7: Validate your work

After creating all files, run these commands from the orb root:

```bash
make lint     # yamllint + shellcheck + circleci validate
make pack     # pack to target/qqq-orb-packed.yml
make validate # pack + validate
```

Fix any yamllint, shellcheck, or orb validation errors before finishing.

---

## Target usage (what consuming repos will write)

After your changes, a pnpm Next.js app at `QRun-IO/qqq-frontend-next` writes:

```yaml
version: 2.1

orbs:
  qqq-orb: qrun-io/qqq-orb@<new-version>

workflows:

  test_only:
    jobs:
      - qqq-orb/node_app_test_only:
          context: [ qqq-maven-registry-credentials ]
          filters:
            branches:
              ignore: /(develop|main|release\/.*|hotfix\/.*|integration.*)/
            tags:
              only: []

  publish_snapshot:
    jobs:
      - qqq-orb/node_app_build:
          branch_type: snapshot
          context: [ qqq-maven-registry-credentials ]
          filters:
            branches:
              only: [ develop ]

  publish_release_candidate:
    jobs:
      - qqq-orb/node_app_build:
          branch_type: release_candidate
          context: [ qqq-maven-registry-credentials ]
          filters:
            branches:
              only: [ /release\/.*/ ]

  publish_release:
    jobs:
      - qqq-orb/node_app_build:
          branch_type: release
          context: [ qqq-maven-registry-credentials ]
          filters:
            branches:
              only: [ main ]
            tags:
              only: [ /v.*/ ]

  publish_hotfix_release:
    jobs:
      - qqq-orb/node_app_build:
          branch_type: hotfix
          context: [ qqq-maven-registry-credentials ]
          filters:
            branches:
              only: [ /hotfix\/.*/ ]
```

All parameters use defaults that work for any standard pnpm Next.js project
with `tsc`, `lint`, `test`, and `build` scripts — zero configuration needed
unless the project deviates from those conventions.

---

## Engineering quality bar

Every script must meet the standard set by Munitor's scripts:
- `#!/usr/bin/env bash` + `set -euo pipefail`
- `qqq_helpers.sh` sourced at top with fallback stub
- `qqq_header` called as first real step
- `qqq_check_tool` used to validate required tools before using them
- Clear, actionable error messages with fix instructions
- Summary output at the end (what ran, pass/fail, counts)
- shellcheck-clean (no SC warnings)
