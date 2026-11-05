/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * @file Stage the versioned, precompiled QSequentialWorkflow editor bundle (the qbit-workflows `QSequentialWorkflow` editor)
 * under `public/dynamic-qfmd-components/`, which is where qbit-workflows' widget metadata points
 * (`/dynamic-qfmd-components/q-sequential-workflow.bundle.js`) and where the single-origin host serves the UI from.
 * The bundle and its map are tracked library assets in `dynamic-components/q-sequential-workflow/`, compiled from the
 * canonical component repository (source commit and toolchain recorded in `dynamic-components.lock.json`). Nothing is
 * downloaded or built here, and a file is refused unless its sha256 matches the lock. A missing or altered bundle fails the
 * build, so a release can never silently omit the workflow editor.
 */
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** Copies every locked file from `assetDir` to `outDir`; throws on a missing file or a hash mismatch. */
export async function stageDynamicComponents({ assetDir, lock, outDir }) {
  await mkdir(outDir, { recursive: true })
  const staged = []
  for (const [name, expected] of Object.entries(lock.files)) {
    if (path.basename(name) !== name) throw new Error(`Locked file name must be a plain file name: ${name}`)
    if (!/^[0-9a-f]{64}$/.test(expected ?? '')) throw new Error(`${name} has no sha256 in the dynamic component lock`)
    const source = path.join(assetDir, name)
    const actual = sha256(await readFile(source).catch(() => { throw new Error(`Missing ${name} in ${assetDir}`) }))
    if (actual !== expected) throw new Error(`${name} sha256 ${actual} does not match the lock ${expected}`)
    await copyFile(source, path.join(outDir, name))
    staged.push(name)
  }
  return staged
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(await readFile(path.join(here, 'dynamic-components.lock.json'), 'utf8'))
  const staged = await stageDynamicComponents({ assetDir: path.join(here, '..', lock.assetDirectory), lock, outDir: path.join(here, '../public/dynamic-qfmd-components') })
  console.log(`Staged dynamic components compiled from ${lock.component.repository}@${lock.component.sourceCommit.slice(0, 8)}: ${staged.join(', ')}`)
}
