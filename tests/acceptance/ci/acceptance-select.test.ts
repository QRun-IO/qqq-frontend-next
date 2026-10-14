/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { existsSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import { AREAS, SMOKE, planAcceptance, selectSpecs } from '../../../scripts/acceptance-select.mjs'

const allAreas = AREAS.map((area: string) => `tests/acceptance/specs/${area}`)

it('keeps smoke paths and the area inventory aligned with the real suite', () => {
  expect(SMOKE).toHaveLength(5)
  for (const file of SMOKE) expect(existsSync(file), file).toBe(true)
  expect(readdirSync('tests/acceptance/specs', { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()).toEqual(AREAS)
})

it('runs smoke for docs-only changes, unit-only changes and an empty diff', () => {
  expect(selectSpecs(['README.md', 'docs/acceptance/browser-matrix.md', 'tests/acceptance/README.md', '.github/README.md'])).toEqual(SMOKE)
  expect(selectSpecs(['tests/a11y/components.test.tsx'])).toEqual(SMOKE)
  expect(selectSpecs([])).toEqual(SMOKE)
})

it.each(AREAS)('selects the %s area for a changed acceptance spec or helper', (area) => {
  const selected = selectSpecs([`tests/acceptance/specs/${area}/example.spec.ts`])
  expect(selected).toContain(`tests/acceptance/specs/${area}`)
  expect(selected).not.toContain(`tests/acceptance/specs/${area}/example.spec.ts`)
  for (const file of SMOKE) expect(selected.some((path: string) => file === path || file.startsWith(`${path}/`))).toBe(true)
})

it.each([
  ['src/components/widgets/Chart.tsx', 'widgets'],
  ['src/components/query/DataGrid.tsx', 'query'],
  ['src/types/table.ts', 'query'],
  ['src/components/records/RecordView.tsx', 'records'],
  ['src/components/forms/TextField.tsx', 'records'],
  ['src/types/processes.ts', 'processes'],
  ['src/components/navigation/Nav.tsx', 'navigation'],
  ['src/components/Sidebar.tsx', 'navigation'],
  ['src/lib/theme/tokens.ts', 'navigation'],
  ['src/components/auth/Login.tsx', 'security'],
  ['src/components/esb/Queue.tsx', 'esb'],
])('maps %s to %s while retaining smoke', (file, area) => {
  const selected = selectSpecs([file])
  expect(selected).toContain(`tests/acceptance/specs/${area}`)
  expect(selected).not.toEqual(allAreas)
  for (const smoke of SMOKE) expect(selected.some((path: string) => smoke === path || smoke.startsWith(`${path}/`))).toBe(true)
})

it.each([
  'package.json', 'pnpm-lock.yaml', 'next.config.ts', 'next.config.mjs', 'playwright.config.ts',
  'tests/acceptance/playwright.config.ts', 'tests/acceptance/support/fixtures.ts',
  'tests/acceptance/fixture/AcceptanceSampleServer.java', 'tests/acceptance/matrix/records.json',
  'tests/acceptance/quarantine.json', 'scripts/acceptance-select.mjs', 'scripts/acceptance-backend.mjs',
  '.github/workflows/acceptance.yml', 'src/lib/api/client.ts', 'src/lib/api/widgets.ts',
  'src/lib/query-client.ts', 'src/lib/core/new-code.ts', 'src/lib/context/q-context.tsx',
  'src/components/ui/button.tsx', 'src/styles/globals.css', 'pom.xml',
])('selects all areas for shared infrastructure or unmapped production code: %s', (file) => {
  expect(selectSpecs([file])).toEqual(allAreas)
})

it('unions renamed paths and normalizes Windows paths without duplicating smoke', () => {
  const selected = selectSpecs(['tests/acceptance/specs/records/old.spec.ts', 'tests\\acceptance\\specs\\widgets\\new.spec.ts'])
  expect(selected).toContain('tests/acceptance/specs/records')
  expect(selected).toContain('tests/acceptance/specs/widgets')
  expect(selected).not.toContain('tests/acceptance/specs/records/crud.spec.ts')
  expect(new Set(selected).size).toBe(selected.length)
})

it('uses two isolated shards each for Chromium and mobile on ordinary PRs', () => {
  const plan = planAcceptance({ eventName: 'pull_request', paths: ['README.md'] })
  expect(plan.mode).toBe('pr')
  expect(plan.specs).toEqual(SMOKE)
  expect(plan.matrix.include).toEqual([
    { project: 'chromium', browser: 'chromium', shard: 1, total: 2 },
    { project: 'chromium', browser: 'chromium', shard: 2, total: 2 },
    { project: 'mobile', browser: 'chromium', shard: 1, total: 2 },
    { project: 'mobile', browser: 'chromium', shard: 2, total: 2 },
  ])
})

it.each([
  { eventName: 'push' },
  { eventName: 'workflow_dispatch' },
  { eventName: 'pull_request', labels: ['full-acceptance'] },
])('uses every project and spec in full mode: %j', (event) => {
  const plan = planAcceptance(event)
  expect(plan.mode).toBe('full')
  expect(plan.specs).toEqual([])
  expect(plan.matrix.include).toHaveLength(18)
  for (const [project, count] of Object.entries({ chromium: 3, firefox: 3, webkit: 4, mobile: 4, tablet: 4 })) {
    const cells = plan.matrix.include.filter((cell: { project: string }) => cell.project === project)
    expect(cells.map((cell: { shard: number }) => cell.shard)).toEqual(Array.from({ length: count }, (_, i) => i + 1))
    expect(cells.every((cell: { browser: string; total: number }) => cell.total === count && cell.browser === (project === 'mobile' ? 'chromium' : project === 'tablet' ? 'webkit' : project))).toBe(true)
  }
})

it('shared infrastructure still uses PR browsers unless the exact full label is set', () => {
  const plan = planAcceptance({ eventName: 'pull_request', labels: ['full-acceptance-later'], paths: ['package.json'] })
  expect(plan.mode).toBe('pr')
  expect(plan.specs).toEqual(allAreas)
  expect(plan.matrix.include).toHaveLength(4)
})
