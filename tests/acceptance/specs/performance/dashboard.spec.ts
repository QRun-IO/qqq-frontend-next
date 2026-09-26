/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Heavy-dashboard budget: prfDashboard has 24 widgets (PerformanceFixtures.java).
import { expect, open, test } from '../../support/fixtures'
import { chartTable, widget } from '../widgets/widget-support'
import { PERFORMANCE_BUDGET, timed } from './budgets'

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1)
const STATISTICS = range(6).map((n) => `prfStatistics${n}`)
const CHARTS: Array<[string, number]> = [
  ...range(6).map((n): [string, number] => [`prfBar${n}`, 12]),
  ...range(4).map((n): [string, number] => [`prfLine${n}`, 60]),
  ...range(4).map((n): [string, number] => [`prfPie${n}`, 6]),
]
const TABLES = range(4).map((n) => `prfTable${n}`)
const ALL = [...STATISTICS, ...CHARTS.map(([name]) => name), ...TABLES]

/** The chart points PerformanceWidgetRenderer returns for a widget. */
function points(name: string, count: number): string[][] {
  const n = Number(name.replace(/\D/g, ''))
  return range(count).map((p) => [`P${p}`, String(((n * 7 + p * 13) % 50) + 1)])
}

test('[PRF-004] 24 widgets (statistics, bar, line and pie charts, 100-row tables) load once each within budget', async ({ page, diagnostics }) => {
  void diagnostics
  const requests = new Map<string, number>()
  page.on('request', (request) => {
    const match = new URL(request.url()).pathname.match(/\/widget\/([^/]+)$/)
    if (match) requests.set(match[1], (requests.get(match[1]) ?? 0) + 1)
  })
  const elapsed = await timed('dashboard', () => open(page, '/app/prfDashboard'), async () => {
    for (const name of ALL) await expect(widget(page, name)).toHaveAttribute('aria-busy', 'false')
  })

  for (const [i, name] of STATISTICS.entries()) {
    await expect(page.locator(`[data-qqq-id="statistics-count-${name}"]`)).toHaveText(((i + 1) * 1000).toLocaleString('en-US'))
  }
  for (const [name, count] of CHARTS) {
    expect(await chartTable(page, name), name).toEqual(points(name, count))
    await expect(widget(page, name).locator('svg.recharts-surface').first()).toBeVisible()
  }
  for (const name of TABLES) {
    const n = name.replace(/\D/g, '')
    const rows = page.locator(`[data-qqq-id="table-widget-${name}"] tbody tr`)
    await expect(rows).toHaveCount(100)
    await expect(rows.first()).toHaveText(range(6).map((c) => `T${n} R1 C${c}`).join(''))
    await expect(rows.last()).toHaveText(range(6).map((c) => `T${n} R100 C${c}`).join(''))
  }

  expect(Object.fromEntries(requests), 'each widget fetched once').toEqual(Object.fromEntries(ALL.map((name) => [name, 1])))
  expect(elapsed, '24-widget dashboard').toBeLessThan(PERFORMANCE_BUDGET.dashboardMs)
})
