# Performance budgets (QRun-IO/qqq#710)

Two automated checks. A breach fails CI. To fix one, make the change smaller or faster. If a
budget really has to rise, put the new measurement and the reason in the commit.

| Check | What it measures | Budget file | Runs in |
|---|---|---|---|
| Bundle budget | First-load JS per route of the static export, total JS, largest chunk, CSS | `perf-budget.json` | `ci.yml` job "Bundle budget (static export)": `pnpm build:export && pnpm perf:budget` |
| Runtime budgets | Large table, heavy dashboard, long process in the production export against the real sample backend | `tests/acceptance/specs/performance/budgets.ts` | `acceptance.yml`: matrix rows PRF-001 to PRF-005 in every browser |

```bash
pnpm build:export && pnpm perf:budget          # bundle; report in test-results/performance/bundle.json
QQQ_ACCEPTANCE_BROWSERS=chromium,firefox,webkit node scripts/acceptance.mjs --skip-build specs/performance
```

## Bundle

First-load JS for a route is every script and stylesheet that the route's exported HTML loads
before hydration, gzip level 9. Next 16 no longer prints these sizes, so the script measures
them from `out/`. `_` stands for a dynamic segment: `/app/_` is `/app/[slug]` (app home, record
query, process, report) and `/app/_/_` is the record view.

| Route | Before (KB gzip) | 1.0 (KB gzip) | Budget |
|---|---|---|---|
| `/`, `/login`, `/callback`, `/token`, `/404` | 218–219 | 218–219 | 230 |
| `/app`, `/app/developer`, `/app/search`, `/app/_/key`, `/app/_/dev`, `/app/_/_/dev` | 309–311 | 309–311 | 330 |
| `/app/_` (app home, record query, process, report) | **562.9** | **448.2** | 470 |
| `/app/_/_` (record view) | 431.6 | 431.5 | 455 |
| `/app/_/create`, `/app/_/_/edit`, `/app/_/_/copy` | 351–356 | 351–356 | 370–375 |
| `/app/_/savedView/_` | 371.2 | 371.1 | 390 |
| Total JS (all chunks) | 689.2 in 54 chunks | 675.0 in 51 chunks | 710 |
| Largest chunk (Recharts + d3, loaded only by chart widgets) | 93.8 | 93.8 | 100 |
| CSS | 16 | 16 | 18 |

Regression fixed: `/app/[slug]` imported `AppHome` from the widgets barrel, and that barrel
re-exports the chart widgets. Recharts was therefore in the first load of every table and
process page, even though `WidgetRenderer` loads charts lazily. The page now imports its
components by module path.

## Runtime

Fixture: `tests/acceptance/fixture/PerformanceFixtures.java`, all synthetic data.

- `prfWide`: 10,000 rows, 40 columns of mixed types, read-only.
- `prfDashboard`: 24 widgets: 6 statistics, 6 bar, 4 line (60 points) and 4 pie charts, and
  4 tables of 100 rows.
- `prfLongRun`: a job that walks all 10,000 rows in 40 pages with a 250 ms pause per page.

Each test measures wall time from the user action until the exact expected content is on
screen, and records it as a `timing` annotation in `test-results/acceptance/report.json`.

| Row | Measurement | Budget (ms) | chromium | firefox | webkit |
|---|---|---|---|---|---|
| PRF-001 | Open the 10,000-row table until the first 25 rows × 40 columns show | 5,000 | 535 | 353 | 602 |
| PRF-002 | Page size 25 → 250 (10,000 cells) | 10,000 | 462 | 665 | 738 |
| PRF-002 | Next page at 250 rows | 10,000 | 636 | 969 | 1,188 |
| PRF-002 | Last page (page 40) at 250 rows | 10,000 | 612 | 1,158 | 1,064 |
| PRF-003 | Sort by Name over 10,000 rows | 3,000 | 155 | 234 | 299 |
| PRF-003 | Filter Count 04 = 0 (40 matches) | 3,000 | 173 | 157 | 150 |
| PRF-004 | Open the 24-widget dashboard until every widget has loaded | 14,000 | 1,086 | 1,567 | 1,760 |
| PRF-005 | Job finished until its result screen shows (10.15 s job, 5 status polls) | 5,000 | 415 | 838 | 521 |

These numbers come from an otherwise idle run of the performance area on an Apple M3 Max
(macOS, Darwin 27), Playwright 1.58.2. Each budget is about 8× the slowest browser's time.
In a full four-project run with other acceptance suites on the same machine, the same steps
took up to about 4× longer: Firefox next page 4,191 ms, dashboard 8,841 ms. Retries are 0,
so a tighter budget would flake. The budgets catch order-of-magnitude regressions. The
structural checks below catch smaller ones, and don't depend on machine load.

The rows also check behavior besides time:

- Only one page of rows is in the DOM: 25 or 250 rows × 40 cells, not the whole table.
- The backend is asked for `skip`/`limit` 250 on each page.
- Each dashboard widget's data is requested exactly once.
- Status polls never overlap, and each poll waits at least 1.5 s (`POLL_INITIAL_MILLIS`)
  after the previous answer. The job never gets more polls than its length allows.

Grid rendering fixed for large pages: body rows are memoized. The grid used to re-render all
10,000 cells before the page request was sent, and again for the URL sync. Date cells no
longer build an `Intl.DateTimeFormat` per cell. A 250-row page turn in chromium, from click to
rendered rows: 659–669 ms → 518–561 ms.

Observed, not changed here:

- Grid columns follow the field order of the metadata map, not the section order, and not
  Material's alphabetical-by-label order. For a 40-column table this looks unordered.
- The pagination range is not locale-formatted, while the total is ("Showing 9751–10000 of
  10,000").
