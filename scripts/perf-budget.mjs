/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Bundle budget for the static export (QRun-IO/qqq#710). Run after `pnpm build:export`:
//
//   node scripts/perf-budget.mjs            # check out/ against perf-budget.json, exit 1 on a breach
//   node scripts/perf-budget.mjs --json     # also print the measurement as JSON
//
// First-load JS of a route is every script the route's HTML loads before hydration (script src
// and preload links), gzip-compressed the way the server sends it. Next 16 no longer prints these
// sizes, so they are measured from out/. The report lands in test-results/performance/bundle.json.
import { gzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.env.QQQ_EXPORT_DIR ?? 'out')
const BUDGET_FILE = path.resolve('perf-budget.json')
const REPORT = path.resolve('test-results/performance/bundle.json')

/** Recursively lists files under a directory. */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

const sizeCache = new Map()
/** Raw and gzip size (bytes) of an exported asset. */
function sizes(file) {
  if (!sizeCache.has(file)) {
    const bytes = readFileSync(file)
    sizeCache.set(file, { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length })
  }
  return sizeCache.get(file)
}

/** The route an exported HTML file serves ("_" is the placeholder of a dynamic segment). */
function routeOf(file) {
  const rel = path.relative(OUT, file).split(path.sep).join('/')
  if (rel === 'index.html') return '/'
  return '/' + rel.replace(/\/index\.html$/, '')
}

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10

/** Measures every exported route. */
function measure() {
  const files = walk(OUT)
  const html = files.filter((f) => f.endsWith('.html'))
  const routes = html.map((file) => {
    const text = readFileSync(file, 'utf8')
    const refs = new Set()
    for (const match of text.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+\.(?:js|css))"/g)) refs.add(match[1])
    const js = [...refs].filter((r) => r.endsWith('.js'))
    const css = [...refs].filter((r) => r.endsWith('.css'))
    const sum = (list, key) => list.reduce((total, ref) => total + sizes(path.join(OUT, ref))[key], 0)
    return {
      route: routeOf(file),
      scripts: js.length,
      firstLoadJsGzipKB: kb(sum(js, 'gzip')),
      firstLoadJsRawKB: kb(sum(js, 'raw')),
      cssGzipKB: kb(sum(css, 'gzip')),
      htmlGzipKB: kb(sizes(file).gzip),
    }
  }).sort((a, b) => a.route.localeCompare(b.route))

  const chunks = files.filter((f) => f.includes(`${path.sep}_next${path.sep}static${path.sep}`) && f.endsWith('.js'))
  const largest = chunks.map((f) => ({ file: path.relative(OUT, f), ...sizes(f) })).sort((a, b) => b.gzip - a.gzip)
  return {
    routes,
    totalJsGzipKB: kb(largest.reduce((t, c) => t + c.gzip, 0)),
    totalJsRawKB: kb(largest.reduce((t, c) => t + c.raw, 0)),
    chunkCount: largest.length,
    largestChunks: largest.slice(0, 5).map((c) => ({ file: c.file, gzipKB: kb(c.gzip), rawKB: kb(c.raw) })),
  }
}

/** Compares a measurement with the budget; returns the breaches. */
function check(result, budget) {
  const problems = []
  const over = (label, actual, limit) => {
    if (actual > limit) problems.push(`${label}: ${actual} KB > budget ${limit} KB`)
  }
  for (const route of result.routes) {
    const limit = budget.routes?.[route.route] ?? budget.firstLoadJsGzipKB
    over(`${route.route} first-load JS (gzip)`, route.firstLoadJsGzipKB, limit)
    over(`${route.route} CSS (gzip)`, route.cssGzipKB, budget.cssGzipKB)
  }
  for (const route of Object.keys(budget.routes ?? {})) {
    if (!result.routes.some((r) => r.route === route)) problems.push(`${route}: budgeted route missing from the export`)
  }
  over('total JS (gzip)', result.totalJsGzipKB, budget.totalJsGzipKB)
  over(`largest chunk ${result.largestChunks[0]?.file} (gzip)`, result.largestChunks[0]?.gzipKB ?? 0, budget.largestChunkGzipKB)
  return problems
}

const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'))
const result = measure()
if (!result.routes.length) {
  console.error(`No exported HTML under ${OUT}; run \`pnpm build:export\` first.`)
  process.exit(1)
}
const problems = check(result, budget)

console.log('Route                          scripts  first-load JS gzip (raw)   CSS gzip')
for (const r of result.routes) {
  const limit = budget.routes?.[r.route] ?? budget.firstLoadJsGzipKB
  console.log(`${r.route.padEnd(30)} ${String(r.scripts).padStart(7)}  ${`${r.firstLoadJsGzipKB} KB (${r.firstLoadJsRawKB} KB)`.padStart(20)} / ${limit} KB  ${r.cssGzipKB} KB`)
}
console.log(`Total JS: ${result.totalJsGzipKB} KB gzip (${result.totalJsRawKB} KB raw) in ${result.chunkCount} chunks; budget ${budget.totalJsGzipKB} KB`)
console.log(`Largest chunks: ${result.largestChunks.map((c) => `${c.file} ${c.gzipKB} KB`).join(', ')}; budget ${budget.largestChunkGzipKB} KB`)

mkdirSync(path.dirname(REPORT), { recursive: true })
writeFileSync(REPORT, JSON.stringify({ budget, result, problems }, null, 2) + '\n')
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2))

if (problems.length) {
  console.error(`\nPerformance budget exceeded (${problems.length}):\n- ${problems.join('\n- ')}`)
  console.error('Reduce the bundle, or raise the budget in perf-budget.json with the reason in the commit.')
  process.exit(1)
}
console.log('\nPerformance budget: OK')
