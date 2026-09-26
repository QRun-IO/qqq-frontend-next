/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Runtime performance budgets (QRun-IO/qqq#710), in milliseconds of wall time that the test
// measures from a user action until the exact expected content is on screen.
//
// Each budget is about 8x the slowest browser's time on an idle machine
// (docs/acceptance/performance.md). A full four-project run on a busy machine measured up to
// 4x, and retries are 0, so a tighter budget would flake. At 8x the budgets catch
// order-of-magnitude regressions, such as rendering the whole table, fetching widgets one
// after another, or polling late. The structural checks in each spec catch smaller ones:
// DOM size, request counts, poll spacing. A breach is a regression: fix it, or raise the
// budget with the measurement in the commit.
import { test } from '../../support/fixtures'

export const PERFORMANCE_BUDGET = {
  /** Navigation to a 10,000-row, 40-column table until its first page (25 rows) is shown. Idle: <= 0.6 s. */
  firstPageMs: 5_000,
  /** A page size change or page turn on that table until the new 250-row page is shown. Idle: <= 1.2 s. */
  pageMs: 10_000,
  /** A sort or filter on that table until the exact result is shown. Idle: <= 0.3 s. */
  queryMs: 3_000,
  /** Navigation to the 24-widget dashboard until every widget has loaded. Idle: <= 1.8 s. */
  dashboardMs: 14_000,
  /** The long job finishing until its result screen is shown (one 1.5 s poll interval plus rendering). Idle: <= 0.85 s. */
  processResultMs: 5_000,
} as const

/** Runs an action and returns how long it took until `until` resolved, attached to the report. */
export async function timed(label: string, action: () => Promise<unknown>, until: () => Promise<unknown>): Promise<number> {
  const started = Date.now()
  await action()
  await until()
  const elapsed = Date.now() - started
  test.info().annotations.push({ type: 'timing', description: `${label}: ${elapsed} ms (${test.info().project.name})` })
  return elapsed
}
