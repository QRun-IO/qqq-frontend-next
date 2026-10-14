/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'

const gate = path.resolve('scripts/acceptance-gate.mjs')
const directories: string[] = []
const quarantine = [{ id: 'WID-029', issue: 'https://github.com/QRun-IO/qqq-frontend-next/issues/93', reason: 'Known pivot failure' }]

/** Exercise the actual CLI with small reports, independent of browsers and Maven. */
function runGate({ entries = quarantine, quarantineOutcome = '', recordOutcome = 'passed', partial = false, errors = [] as { message: string }[] } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'qqq-acceptance-gate-'))
  directories.push(directory)
  mkdirSync(path.join(directory, 'tests/acceptance/matrix'), { recursive: true })
  mkdirSync(path.join(directory, 'test-results/acceptance'), { recursive: true })
  writeFileSync(path.join(directory, 'tests/acceptance/matrix/fixture.json'), JSON.stringify({
    area: 'fixture', prefixes: ['REC', 'WID'], rows: [
      { id: 'REC-001', feature: 'Record', required: true },
      { id: 'WID-029', feature: 'Pivot', required: true },
    ],
  }))
  writeFileSync(path.join(directory, 'tests/acceptance/quarantine.json'), JSON.stringify(entries))
  const specs = [['REC-001', recordOutcome], ['WID-029', quarantineOutcome]].filter(([, outcome]) => outcome).map(([id, outcome]) => ({
    title: `[${id}] scenario`, file: 'fixture.spec.ts',
    tests: ['chromium', 'mobile'].map((projectName) => ({ projectName, status: outcome === 'skipped' ? 'skipped' : 'expected', results: [{ status: outcome }] })),
  }))
  writeFileSync(path.join(directory, 'test-results/acceptance/report.json'), JSON.stringify({
    config: { projects: [{ name: 'chromium' }, { name: 'mobile' }] }, suites: [{ specs }], errors,
  }))
  const result = spawnSync(process.execPath, [gate, ...(partial ? ['--partial'] : [])], { cwd: directory, encoding: 'utf8' })
  if (result.error) throw result.error
  return { code: result.status, report: JSON.parse(readFileSync(path.join(directory, 'test-results/acceptance/gate.json'), 'utf8')) }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    // Only remove the exact task-owned temporary directories created above.
    if (path.dirname(directory) !== tmpdir() || !path.basename(directory).startsWith('qqq-acceptance-gate-')) throw new Error('Unexpected fixture path')
    rmSync(directory, { recursive: true, force: true })
  }
})

it.each(['', 'passed', 'failed', 'skipped'])('reports quarantine without failing full/touch coverage when outcome is %j', (quarantineOutcome) => {
  const { code, report } = runGate({ quarantineOutcome })
  expect(code).toBe(0)
  expect(report.summary).toMatchObject({ passed: 1, failed: 0, missing: 0, quarantined: 1, phone: { covered: 1, uncovered: 0 } })
  expect(report.quarantine).toEqual(quarantine)
  expect(report.rows.find((row: { id: string }) => row.id === 'WID-029').quarantined).toBe(true)
  expect(report.problems).toEqual([])
})

it.each(['', 'not-a-link'])('rejects a quarantine entry without an issue link: %j', (issue) => {
  const { code, report } = runGate({ entries: [{ ...quarantine[0], issue }] })
  expect(code).toBe(1)
  expect(report.problems).toContain('WID-029 quarantine entry needs an issue link')
})

it('rejects an unknown quarantine ID even in partial mode', () => {
  const { code, report } = runGate({ entries: [{ ...quarantine[0], id: 'WID-999' }], partial: true })
  expect(code).toBe(1)
  expect(report.problems).toContain('Unknown quarantine ID WID-999')
})

it.each(['failed', 'skipped'])('keeps ordinary %s tests blocking', (recordOutcome) => {
  const { code, report } = runGate({ recordOutcome })
  expect(code).toBe(1)
  expect(report.summary.failed).toBe(1)
})

it('requires unselected rows in full mode and allows them in partial mode', () => {
  expect(runGate({ recordOutcome: '' }).code).toBe(1)
  expect(runGate({ recordOutcome: '', partial: true }).code).toBe(0)
})

it('does not hide global runner errors behind passed tests', () => {
  const { code, report } = runGate({ errors: [{ message: 'Worker crashed' }] })
  expect(code).toBe(1)
  expect(report.problems).toContain('Playwright error: Worker crashed')
})
