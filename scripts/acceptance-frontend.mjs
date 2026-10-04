/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Serves the production standalone build exactly as the published image does: through
// standalone/qqq-server.mjs, which adds the dashboard security headers (QRun-IO/qqq#734).
import { spawn } from 'node:child_process'
import { cpSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { BUILD_MARKER } from './acceptance-paths.mjs'

const backend = `http://127.0.0.1:${process.env.QQQ_ACCEPTANCE_BACKEND_PORT ?? '18765'}`
const standalone = path.resolve('.next/standalone')
if (!existsSync(path.join(standalone, 'server.js')) || !existsSync(BUILD_MARKER)
  || readFileSync(BUILD_MARKER, 'utf8').trim() !== backend) {
  console.error(`No production build for ${backend}; run node scripts/acceptance.mjs.`)
  process.exit(1)
}
// Use the JS copy path for owner-readable files on Docker Desktop mounts.
cpSync(path.resolve('.next/static'), path.join(standalone, '.next/static'), { recursive: true, verbatimSymlinks: true, filter: () => true })
cpSync(path.resolve('public'), path.join(standalone, 'public'), { recursive: true, verbatimSymlinks: true, filter: () => true })
for (const file of ['qqq-server.mjs', 'security-headers.mjs', 'branding-assets.mjs', 'backend-prefixes.json']) {
  cpSync(path.resolve('standalone', file), path.join(standalone, file))
}

/**
 * The application's policy additions (its QuickSight embed, custom component bundles and
 * the fixture's loopback service), which the QQQ server derives in javalin mode and a
 * container deployment sets in QQQ_DASHBOARD_CSP_SOURCES.
 *
 * @returns {Promise<string>} The sources, once the acceptance backend is up.
 */
async function dashboardCspSources() {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backend}/acceptance/dashboard-csp-sources`)
      if (response.ok) return (await response.text()).trim()
    } catch {
      // the backend is still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`The acceptance backend at ${backend} did not answer /acceptance/dashboard-csp-sources.`)
}

const sources = await dashboardCspSources()
const server = spawn('node', ['qqq-server.mjs'], {
  cwd: standalone,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: process.env.QQQ_ACCEPTANCE_FRONTEND_PORT ?? '13765',
    QQQ_DASHBOARD_CSP_SOURCES: sources,
  },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill('SIGTERM'))
server.on('exit', (code) => process.exit(code ?? 1))
