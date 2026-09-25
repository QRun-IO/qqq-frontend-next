/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Fails unless every required matrix row has at least one acceptance test and every test for it
// passed on the first attempt in every configured browser. Unknown IDs, skips and flakes fail.
// --partial checks only the rows exercised by a filtered run and never reports acceptance.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const partial = process.argv.includes('--partial')
const matrixFiles = readdirSync('tests/acceptance/matrix').filter((name) => name.endsWith('.json')).sort()
const matrix = { rows: matrixFiles.flatMap((name) => {
  const area = JSON.parse(readFileSync(`tests/acceptance/matrix/${name}`, 'utf8'))
  return area.rows.map((row) => {
    if (!area.prefixes.some((prefix) => row.id.startsWith(prefix + '-'))) throw new Error(`${row.id} does not belong to ${name}`)
    return { ...row, area: area.area }
  })
}) }
const duplicates = matrix.rows.map((row) => row.id).filter((id, index, ids) => ids.indexOf(id) !== index)
if (duplicates.length) throw new Error(`Duplicate matrix IDs: ${duplicates.join(', ')}`)
const report = JSON.parse(readFileSync('test-results/acceptance/report.json', 'utf8'))
const rows = new Map(matrix.rows.map((row) => [row.id, row]))
const results = new Map()
const problems = []

function walk(suite, titles = []) {
  for (const child of suite.suites ?? []) walk(child, [...titles, child.title])
  for (const spec of suite.specs ?? []) {
    const ids = [...`${titles.join(' ')} ${spec.title}`.matchAll(/\[([A-Z]{3}-\d{3})\]/g)].map((match) => match[1])
    if (ids.length === 0) problems.push(`Test without a matrix ID: ${spec.file} ${spec.title}`)
    for (const test of spec.tests) {
      const attempts = test.results ?? []
      const outcome = test.status === 'skipped' ? 'skipped'
        : attempts.length === 1 && attempts[0].status === 'passed' ? 'passed'
          : attempts.some((attempt) => attempt.status === 'passed') ? 'flaky' : 'failed'
      for (const id of ids) {
        if (!rows.has(id)) problems.push(`Unknown matrix ID ${id} in ${spec.file}`)
        const list = results.get(id) ?? []
        list.push({ title: spec.title, project: test.projectName, outcome })
        results.set(id, list)
      }
    }
  }
}
for (const suite of report.suites ?? []) walk(suite)

const summary = { passed: 0, failed: 0, missing: 0, excluded: 0 }
for (const row of matrix.rows) {
  if (row.required === false) {
    summary.excluded++
    if (!row.approval) problems.push(`${row.id} is excluded without a recorded approval`)
    continue
  }
  const list = results.get(row.id)
  if (!list) {
    if (partial) continue
    summary.missing++
    problems.push(`${row.id} ${row.feature}: no acceptance test`)
    continue
  }
  const bad = list.filter(({ outcome }) => outcome !== 'passed')
  if (bad.length) {
    summary.failed++
    for (const { title, project, outcome } of bad) problems.push(`${row.id} ${outcome} [${project}] ${title}`)
  } else summary.passed++
}

const status = { partial, generatedAt: new Date().toISOString(), summary, problems,
  rows: matrix.rows.map((row) => ({ id: row.id, results: results.get(row.id) ?? [] })) }
writeFileSync('test-results/acceptance/gate.json', JSON.stringify(status, null, 2) + '\n')
console.log(`Acceptance gate${partial ? ' (partial run, not an acceptance result)' : ''}:`, JSON.stringify(summary))
for (const problem of problems) console.log(`  FAIL ${problem}`)
process.exit(problems.length ? 1 : 0)
