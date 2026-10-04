/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/** @file Stages and validates an immutable standalone build for an authentication backend. */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const prefixes = createRequire(path.resolve('package.json'))('./standalone/backend-prefixes.json')

/** Rejects a missing or differently routed build, regardless of any retained Javalin export. */
export function assertStandaloneTarget(directory, backend) {
  if (!existsSync(path.join(directory, 'server.js')) || !existsSync(path.join(directory, 'qqq-server.mjs'))
    || readFileSync(path.join(directory, 'acceptance-backend.txt'), 'utf8').trim() !== backend) {
    throw new Error(`No standalone security build for ${backend}; run acceptance without --skip-build.`)
  }
  const { rewrites } = JSON.parse(readFileSync(path.join(directory, '.next/routes-manifest.json'), 'utf8'))
  const routes = Array.isArray(rewrites) ? rewrites : [...rewrites.beforeFiles, ...rewrites.afterFiles, ...rewrites.fallback]
  for (const prefix of prefixes) {
    if (!routes.some(({ source, destination }) => source === `/${prefix}/:path*` && destination === `${backend}/${prefix}/:path*`)) {
      throw new Error(`Standalone security build has the wrong backend rewrite for ${prefix}.`)
    }
  }
}

/** Copies the same standalone payload as the container image, before the next clean build. */
export function stageStandalone(directory, backend, source = process.cwd()) {
  rmSync(directory, { recursive: true, force: true })
  // The JS copy path preserves readable files on Docker Desktop mounts; relative links
  // must remain relative so deleting the original build cannot invalidate this stage.
  cpSync(path.join(source, '.next/standalone'), directory, { recursive: true, verbatimSymlinks: true, filter: () => true })
  cpSync(path.join(source, '.next/static'), path.join(directory, '.next/static'), { recursive: true, verbatimSymlinks: true, filter: () => true })
  cpSync(path.join(source, 'public'), path.join(directory, 'public'), { recursive: true, verbatimSymlinks: true, filter: () => true })
  for (const file of ['qqq-server.mjs', 'security-headers.mjs', 'backend-prefixes.json']) {
    cpSync(path.join(source, 'standalone', file), path.join(directory, file))
  }
  writeFileSync(path.join(directory, 'acceptance-backend.txt'), `${backend}\n`)
  assertStandaloneTarget(directory, backend)
}
